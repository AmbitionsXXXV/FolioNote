import type { ExpoConfig } from 'expo/config'
import pkg from './package.json'

const config: ExpoConfig = {
	scheme: 'folio-note',
	userInterfaceStyle: 'automatic',
	orientation: 'default',
	web: {
		bundler: 'metro',
	},
	name: 'FolioNote',
	slug: 'folio-note',
	version: pkg.version,
	plugins: [
		'expo-font',
		'expo-router',
		'expo-web-browser',
		'expo-notifications',
		'expo-localization',
		[
			'expo-secure-store',
			{
				configureAndroidBackup: true,
				faceIDPermission:
					'Allow $(PRODUCT_NAME) to access your Face ID biometric data.',
			},
		],
	],
	experiments: {
		typedRoutes: true,
		reactCompiler: true,
	},
	ios: {
		bundleIdentifier: 'com.etcetera.folio-note',
	},
	android: {
		package: 'com.etcetera.folio-note',
	},
	updates: {
		enabled: true,
		url: 'https://u.expo.dev/c556a12d-ec22-44e6-950b-3fb286b4252f',
	},
	extra: {
		router: {},
		eas: {
			projectId: 'c556a12d-ec22-44e6-950b-3fb286b4252f',
		},
	},
}

export default config
