import Constants from 'expo-constants';

/**
 * Centralized backend API configuration.
 *
 * In dev: auto-detects the Expo dev server's host IP so physical devices
 * can reach the backend running on the same machine.
 *
 * In production / self-hosted: set EXPO_PUBLIC_BACKEND_URL env var.
 */
const HOST = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
const PORT = '3000';

export const API_BASE_URL =
    process.env.EXPO_PUBLIC_BACKEND_URL || `http://${HOST}:${PORT}`;

export const ENDPOINTS = {
    directions: `${API_BASE_URL}/api/directions`,
    search: `${API_BASE_URL}/api/search`,
    vehicles: `${API_BASE_URL}/api/vehicles`,
    nearby: `${API_BASE_URL}/api/nearby`,
    alerts: `${API_BASE_URL}/api/alerts`,
    predictions: `${API_BASE_URL}/api/predictions`,
    health: `${API_BASE_URL}/api/health`,
};
