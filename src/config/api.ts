import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Centralized backend API configuration.
 *
 * Default: auto-detects Expo dev server IP (dev) or uses EXPO_PUBLIC_BACKEND_URL (production).
 * Runtime: user can override backend URL and set a Google API Key in Settings > Advanced.
 */

const DEFAULT_HOST = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
const DEFAULT_PORT = '3000';
const DEFAULT_BASE_URL =
    process.env.EXPO_PUBLIC_BACKEND_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

// ── Mutable state (loaded from AsyncStorage at startup) ───────────
let _baseUrl: string = DEFAULT_BASE_URL;
let _googleApiKey: string | null = null;

/**
 * Load saved config from AsyncStorage. Call once at app startup.
 */
export const initApiConfig = async () => {
    try {
        // Restore user-overridden backend URL (set in Settings > Advanced)
        const savedUrl = await AsyncStorage.getItem('backend_url');
        if (savedUrl) _baseUrl = savedUrl;

        let savedKey = await SecureStore.getItemAsync('google_api_key');

        // Migration: If not in SecureStore, check AsyncStorage
        if (!savedKey) {
            const legacyKey = await AsyncStorage.getItem('google_api_key');
            if (legacyKey) {
                // Move it to SecureStore and remove from AsyncStorage
                await SecureStore.setItemAsync('google_api_key', legacyKey);
                await AsyncStorage.removeItem('google_api_key');
                savedKey = legacyKey;
            }
        }

        if (savedKey) _googleApiKey = savedKey;
    } catch (e) {
        console.warn('[JATA] Failed to load API config from storage:', e);
    }
};

// ── Getters (synchronous, read in-memory) ─────────────────────────
export const getBaseUrl = (): string => _baseUrl;
export const getGoogleApiKey = (): string | null => _googleApiKey;

// ── Setters (update in-memory + persist) ──────────────────────────
export const setBackendUrl = async (url: string) => {
    const trimmed = url.trim();
    _baseUrl = trimmed || DEFAULT_BASE_URL;
    try {
        if (trimmed) {
            await AsyncStorage.setItem('backend_url', trimmed);
        } else {
            await AsyncStorage.removeItem('backend_url');
        }
    } catch (e) {
        console.warn('[JATA] Failed to save backend URL:', e);
    }
};

export const setGoogleApiKey = async (key: string) => {
    const trimmed = key.trim();
    _googleApiKey = trimmed || null;
    try {
        if (trimmed) {
            await SecureStore.setItemAsync('google_api_key', trimmed);
        } else {
            await SecureStore.deleteItemAsync('google_api_key');
        }
    } catch (e) {
        console.warn('[JATA] Failed to save Google API key:', e);
    }
};

// ── Dynamic endpoints (getters resolve against current _baseUrl) ──
export const ENDPOINTS = {
    get directions() { return `${_baseUrl}/api/directions`; },
    get search() { return `${_baseUrl}/api/search`; },
    get vehicles() { return `${_baseUrl}/api/vehicles`; },
    get nearby() { return `${_baseUrl}/api/nearby`; },
    get stopsNearby() { return `${_baseUrl}/api/stops/nearby`; },
    stopDepartures: (stopId: string) => `${_baseUrl}/api/stops/${encodeURIComponent(stopId)}/departures`,
    get alerts() { return `${_baseUrl}/api/alerts`; },
    get predictions() { return `${_baseUrl}/api/predictions`; },
    get health() { return `${_baseUrl}/api/health`; },
};
