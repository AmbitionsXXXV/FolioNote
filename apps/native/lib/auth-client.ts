import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import Constants from 'expo-constants'
import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store'

export const authClient = createAuthClient({
	baseURL: process.env.EXPO_PUBLIC_SERVER_URL,
	plugins: [
		expoClient({
			scheme: Constants.expoConfig?.scheme as string,
			storagePrefix: Constants.expoConfig?.scheme as string,
			storage: {
				getItem: getItemAsync,
				setItem: setItemAsync,
				deleteItem: deleteItemAsync,
			},
		}),
	],
})
