import { getObject, saveToStorage } from './storage';

interface RouteHistoryEntry {
    destination: string;
    count: number;
    lastUsed: number;
}

const STORAGE_KEY = 'route_history';
const FREQUENT_THRESHOLD = 3;

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

    await saveToStorage(STORAGE_KEY, history);
}

export async function getFrequentRoutes(): Promise<{ destination: string; count: number }[]> {
    const history = (await getObject<RouteHistoryEntry[]>(STORAGE_KEY)) || [];
    return history
        .filter(e => e.count >= FREQUENT_THRESHOLD)
        .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
        .slice(0, 3)
        .map(e => ({ destination: e.destination, count: e.count }));
}
