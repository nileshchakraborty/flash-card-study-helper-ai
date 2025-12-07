import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = () => {
    // Check for extra configuration from app.json/app.config.js first
    const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;

    console.log('[env.ts] Platform:', Platform.OS);
    console.log('[env.ts] __DEV__:', __DEV__);

    // Default to localhost for development if not specified
    // Note: localhost on Android emulator is 10.0.2.2
    // On iOS simulator it is localhost
    // On physical device it needs to be your machine's LAN IP
    if (!extraApiUrl) {
        if (__DEV__) {
            const devUrl = Platform.OS === 'android'
                ? 'http://10.0.2.2:3000/api'
                : 'http://localhost:3000/api';
            console.log('[env.ts] Using dev API URL:', devUrl);
            return devUrl;
        }
        console.log('[env.ts] Using production API URL');
        return 'https://mindflipai.vercel.app/api';
    }

    console.log('[env.ts] Using configured API URL:', extraApiUrl);
    return extraApiUrl;
};

export const ENV = {
    API_URL: getApiUrl(),
};
