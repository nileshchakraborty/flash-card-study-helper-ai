import { ENV } from '../config/env';

export const apiClient = {
    get: async (endpoint: string) => {
        try {
            const url = `${ENV.API_URL}${endpoint}`;
            console.log('[API] GET:', url);
            const response = await fetch(url);
            console.log('[API] Response status:', response.status);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();
            console.log('[API] Response data:', data);
            return data;
        } catch (error) {
            console.error('[API] GET request failed:', error);
            throw error;
        }
    },
    post: async (endpoint: string, body: any) => {
        try {
            const url = `${ENV.API_URL}${endpoint}`;
            console.log('[API] POST:', url, 'Body:', body);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            console.log('[API] Response status:', response.status);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();
            console.log('[API] Response data:', data);
            return data;
        } catch (error) {
            console.error('[API] POST request failed:', error);
            throw error;
        }
    }
};
