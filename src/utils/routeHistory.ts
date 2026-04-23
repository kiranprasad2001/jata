import { getObject, saveToStorage } from './storage';

interface RouteHistoryEntry {
    destination: string;
    count: number;
    lastUsed: number;
}

const STORAGE_KEY = 'route_history';
const FREQUENT_THRESHOLD = 3;
const MAX_ENTRIES = 200;
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export async function recordRouteSearch(destination: string): Promise<void> {
    const history = (await getObject<RouteHistoryEntry[]>(STORAGE_KEY)) || [];
    const normalized = destination.trim().toLowerCase();
    const existing = history.find(e => e.destination.trim().toLowerCase() === normalized);

    if (existing) {
        existing.count += 1;
        existing.lastUsed = Date.now();
    } else {
        history.push({ destination, count: 1, lastUsed: Date.now() });
    }

    // Drop entries older than MAX_AGE_MS, then cap by most-recently-used to MAX_ENTRIES.
    const cutoff = Date.now() - MAX_AGE_MS;
    const trimmed = history
        .filter(e => e.lastUsed >= cutoff)
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, MAX_ENTRIES);

    await saveToStorage(STORAGE_KEY, trimmed);
}

export async function getFrequentRoutes(): Promise<{ destination: string; count: number }[]> {
    const history = (await getObject<RouteHistoryEntry[]>(STORAGE_KEY)) || [];
    return history
        .filter(e => e.count >= FREQUENT_THRESHOLD)
        .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
        .slice(0, 3)
        .map(e => ({ destination: e.destination, count: e.count }));
}
