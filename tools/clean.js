#!/usr/bin/env bun

/**
 * Cross-platform clean script for the Vodhorizon project using Bun Shell.
 * Usage:
 *   - Basic: bun tools/clean.js
 *   - With target directory: bun tools/clean.js target
 *   - With multiple directories: bun tools/clean.js dist node_modules .turbo
 *
 * This script cleans specified directories in the project root and in each
 * workspace package defined in the root package.json.
 */

import { join } from 'node:path'
import { cwd } from 'node:process'
import { $ } from 'bun'

// Default directories to clean if none specified
const DEFAULT_DIRS = [
	'dist',
	'node_modules',
	'.turbo',
	'build',
	'*.zip',
	'.tanstack',
]

// Get directories to clean from command line arguments
const args = Bun.argv.slice(2)
const dirsToClean = args.length > 0 ? args : DEFAULT_DIRS

const projectRoot = cwd()

/**
 * Retrieves the paths of all workspace packages.
 * @param {string} rootDir - The project root directory.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute paths to workspace packages.
 */
async function getWorkspacePackagePaths(rootDir) {
	try {
		const packageJsonPath = join(rootDir, 'package.json')
		const packageJson = await Bun.file(packageJsonPath).json()

		let workspacePatterns = []
		if (Array.isArray(packageJson.workspaces)) {
			workspacePatterns = packageJson.workspaces
		} else if (
			packageJson.workspaces &&
			Array.isArray(packageJson.workspaces.packages)
		) {
			workspacePatterns = packageJson.workspaces.packages
		} else {
			console.warn(
				"⚠️ Could not find 'workspaces' array in package.json. Only cleaning project root."
			)
			return []
		}

		if (workspacePatterns.length === 0) {
			return []
		}

		const collectedPaths = []
		for (const pattern of workspacePatterns) {
			const glob = new Bun.Glob(pattern)
			// Scan for directories matching the pattern within the rootDir
			// onlyFiles: false ensures that directories are included.
			// For workspace patterns like "packages/*", this should yield directory paths.
			for await (const path of glob.scan({
				cwd: rootDir,
				absolute: true,
				onlyFiles: false,
				followSymlinks: false,
			})) {
				collectedPaths.push(path)
			}
		}
		// Deduplicate paths in case of overlapping patterns
		const packagePaths = [...new Set(collectedPaths)]
		return packagePaths
	} catch (error) {
		console.error(
			`❌ Error reading or parsing root package.json or scanning workspaces: ${error.message}`
		)
		console.warn('⚠️ Proceeding to clean only the project root.')
		return []
	}
}

/**
 * Cleans a specific directory or pattern within a given base path.
 * @param {string} basePath - The base path where the directory to clean is located.
 * @param {string} dirName - The name of the directory or pattern to clean (supports wildcards).
 */
async function cleanDirInPath(basePath, dirName) {
	// Check if the dirName contains wildcards
	if (dirName.includes('*') || dirName.includes('?')) {
		try {
			console.log(`  Attempting to remove pattern '${dirName}' in '${basePath}'...`)
			const glob = new Bun.Glob(dirName)
			let foundFiles = false

			// Scan for files/directories matching the pattern
			for await (const path of glob.scan({
				cwd: basePath,
				absolute: true,
				onlyFiles: false,
				followSymlinks: false,
			})) {
				foundFiles = true
				try {
					await $`rm -rf ${path}`.quiet()
					console.log(`    ✅ Removed: ${path}`)
				} catch (removeError) {
					console.error(`    ❌ Error removing '${path}': ${removeError.message}`)
				}
			}

			if (foundFiles) {
				console.log(
					`    ✅ Successfully processed pattern '${dirName}' in '${basePath}'`
				)
			} else {
				console.log(
					`    ℹ️ No files matching pattern '${dirName}' found in '${basePath}'`
				)
			}
		} catch (error) {
			console.error(
				`    ❌ Error processing pattern '${dirName}' in '${basePath}': ${error.message}`
			)
		}
	} else {
		// Handle non-wildcard paths (original logic)
		const fullPath = join(basePath, dirName)
		try {
			console.log(`  Attempting to remove '${dirName}' in '${basePath}'...`)
			await $`rm -rf ${fullPath}`.quiet()
			console.log(
				`    ✅ Successfully processed '${dirName}' in '${basePath}' (removed if it existed).`
			)
		} catch (error) {
			console.error(
				`    ❌ Error removing '${dirName}' in '${basePath}': ${error.message}`
			)
		}
	}
}

/**
 * Main function to orchestrate the cleaning process.
 */
async function main() {
	console.log(
		`🧹 Starting clean process. Directories to target: [${dirsToClean.join(', ')}]`
	)

	const workspacePaths = await getWorkspacePackagePaths(projectRoot)
	const allPathsToScan = [projectRoot, ...workspacePaths]

	for (const basePath of allPathsToScan) {
		console.log(`
ℹ️ Scanning in: ${basePath}`)
		for (const dir of dirsToClean) {
			await cleanDirInPath(basePath, dir)
		}
	}

	console.log(`
🎉 Clean completed!`)
}

// Run the cleaner
main().catch((error) => {
	console.error('An unexpected error occurred during the clean process:', error)
	process.exit(1)
})
