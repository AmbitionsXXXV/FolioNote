import type { ExpoConfig } from "expo/config"

import pkg from "./package.json"

const config: ExpoConfig = {
  owner: "etcetera",
  scheme: "folio-note",
  userInterfaceStyle: "automatic",
  orientation: "default",
  web: {
    bundler: "metro",
    favicon: "./assets/images/favicon.png"
  },
  icon: "./assets/images/icon.png",
  name: "FolioNote",
  slug: "folio-note",
  version: pkg.version,
  plugins: [
    ["expo-font", { fonts: ["./assets/fonts/LeckerliOne.ttf"] }],
    "expo-router",
    "expo-web-browser",
    "expo-notifications",
    "expo-localization",
    "expo-sqlite",
    [
      "expo-secure-store",
      {
        configureAndroidBackup: true,
        faceIDPermission:
          "Allow $(PRODUCT_NAME) to access your Face ID biometric data."
      }
    ],
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#211E19",
        dark: {
          backgroundColor: "#211E19",
          image: "./assets/images/splash-icon.png"
        },
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain"
      }
    ]
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  },
  ios: {
    icon: "./assets/images/icon.png",
    bundleIdentifier: "com.etcetera.folio-note",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
      // 注意：不要设置 UIDesignRequiresCompatibility: true
      // 这会禁用 iOS 26 的 Liquid Glass 效果，并且 IOS27 会被移除
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#211E19",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png"
    },
    icon: "./assets/images/icon.png",
    package: "com.etcetera.folionote"
  },
  updates: {
    enabled: true,
    url: "https://u.expo.dev/4a9c4ba0-2493-42f5-8c0d-8bfda5ab0dd1"
  },
  extra: {
    router: {},
    eas: {
      projectId: "4a9c4ba0-2493-42f5-8c0d-8bfda5ab0dd1"
    }
  },
  runtimeVersion: {
    policy: "appVersion"
  }
}

export default config
