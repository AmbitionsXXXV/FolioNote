#!/usr/bin/env tsx
/**
 * CI script to check that all locale files have consistent keys.
 * Run with: pnpm run check-keys
 *
 * This script dynamically loads all locale files from the resources directory
 * and validates that all locales have consistent keys with the default locale (en-US).
 */

import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = resolve(__dirname, '../src/resources')
const DEFAULT_LOCALE = 'en-US'

type JsonObject = { [key: string]: string | JsonObject }
type LocaleData = { name: string; keys: string[] }

function getAllKeys(obj: JsonObject, prefix = ''): string[] {
	const keys: string[] = []

	for (const key of Object.keys(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		const value = obj[key]

		if (typeof value === 'object' && value !== null) {
			keys.push(...getAllKeys(value as JsonObject, fullKey))
		} else {
			keys.push(fullKey)
		}
	}

	return keys.sort()
}

function findDifferences(
	sourceKeys: string[],
	targetKeys: string[]
): { missing: string[]; extra: string[] } {
	const sourceSet = new Set(sourceKeys)
	const targetSet = new Set(targetKeys)

	const missing = sourceKeys.filter((key) => !targetSet.has(key))
	const extra = targetKeys.filter((key) => !sourceSet.has(key))

	return { missing, extra }
}

async function loadLocales(): Promise<LocaleData[]> {
	const files = readdirSync(resourcesDir).filter((file) => file.endsWith('.json'))
	const locales: LocaleData[] = []

	for (const file of files) {
		const name = file.replace('.json', '')
		const filePath = join(resourcesDir, file)
		const data = await import(filePath)
		const keys = getAllKeys(data.default as JsonObject)
		locales.push({ name, keys })
	}

	return locales
}

function printLocaleStats(locales: LocaleData[]): void {
	console.log('\n📊 Locale Key Check\n')
	for (const locale of locales) {
		console.log(`${locale.name}: ${locale.keys.length} keys`)
	}
	console.log()
}

function printMissingKeys(localeName: string, missing: string[]): void {
	console.error(`❌ Missing in ${localeName} (${missing.length}):`)
	for (const key of missing) {
		console.error(`   - ${key}`)
	}
	console.log()
}

function printExtraKeys(
	localeName: string,
	defaultName: string,
	extra: string[]
): void {
	console.error(
		`❌ Extra in ${localeName} (not in ${defaultName}) (${extra.length}):`
	)
	for (const key of extra) {
		console.error(`   - ${key}`)
	}
	console.log()
}

function validateLocale(locale: LocaleData, defaultLocale: LocaleData): boolean {
	const { missing, extra } = findDifferences(defaultLocale.keys, locale.keys)
	let hasErrors = false

	if (missing.length > 0) {
		hasErrors = true
		printMissingKeys(locale.name, missing)
	}

	if (extra.length > 0) {
		hasErrors = true
		printExtraKeys(locale.name, defaultLocale.name, extra)
	}

	return hasErrors
}

async function main() {
	const locales = await loadLocales()

	if (locales.length === 0) {
		console.error('❌ No locale files found in resources directory\n')
		process.exit(1)
	}

	const defaultLocale = locales.find((l) => l.name === DEFAULT_LOCALE)
	if (!defaultLocale) {
		console.error(`❌ Default locale (${DEFAULT_LOCALE}) not found\n`)
		process.exit(1)
	}

	printLocaleStats(locales)

	let hasErrors = false
	for (const locale of locales) {
		if (locale.name === defaultLocale.name) {
			continue
		}
		if (validateLocale(locale, defaultLocale)) {
			hasErrors = true
		}
	}

	if (hasErrors) {
		console.error('❌ Locale key check failed!\n')
		process.exit(1)
	}

	console.log('✅ All locale files have consistent keys!\n')
	process.exit(0)
}

main()
