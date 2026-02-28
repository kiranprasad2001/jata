import { getObject, saveToStorage } from './storage';

/**
 * Commute Pattern Detection
 *
 * Tracks when users search for routes and detects recurring patterns.
 * Example: "User searches for Union Station every weekday around 8:15 AM"
 * → Triggers "Leave now to catch the 8:22 Line 1" notification
 *
 * No account needed — all data stays on-device.
 */

interface CommuteDeparture {
    destination: string;
    dayOfWeek: number;  // 0=Sun, 6=Sat
    hour: number;       // 0-23
    minute: number;     // 0-59
    timestamp: number;
}

export interface CommutePattern {
    destination: string;
    dayOfWeek: number;
    avgHour: number;
    avgMinute: number;
    occurrences: number;
    lastUsed: number;
}

const STORAGE_KEY = 'commute_departures';
const PATTERNS_KEY = 'commute_patterns';
const MIN_OCCURRENCES = 3; // Need 3+ trips at similar time to detect pattern
const TIME_WINDOW_MINUTES = 45; // Trips within 45 min window = same commute

/**
 * Record a route search with timestamp for pattern detection.
 * Called whenever user searches or selects a destination.
 */
export async function recordCommuteDeparture(destination: string): Promise<void> {
    const now = new Date();
    const departures = (await getObject<CommuteDeparture[]>(STORAGE_KEY)) || [];

    departures.push({
        destination: destination.trim(),
        dayOfWeek: now.getDay(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        timestamp: Date.now(),
    });

    // Keep only last 60 days of data
    const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
    const trimmed = departures.filter(d => d.timestamp > sixtyDaysAgo);

    await saveToStorage(STORAGE_KEY, trimmed);

    // Recompute patterns after each recording
    await computePatterns(trimmed);
}

/**
 * Analyze recorded departures and extract recurring patterns.
 * Groups by destination + day of week + time window.
 */
async function computePatterns(departures: CommuteDeparture[]): Promise<void> {
    const patterns: CommutePattern[] = [];

    // Group by normalized destination
    const byDest = new Map<string, CommuteDeparture[]>();
    for (const d of departures) {
        const key = d.destination.trim().toLowerCase();
        const existing = byDest.get(key) || [];
        existing.push(d);
        byDest.set(key, existing);
    }

    for (const [, trips] of byDest) {
        // Sub-group by day of week
        const byDay = new Map<number, CommuteDeparture[]>();
        for (const t of trips) {
            const existing = byDay.get(t.dayOfWeek) || [];
            existing.push(t);
            byDay.set(t.dayOfWeek, existing);
        }

        for (const [day, dayTrips] of byDay) {
            // Cluster by time window
            const clusters = clusterByTime(dayTrips);
            for (const cluster of clusters) {
                if (cluster.length >= MIN_OCCURRENCES) {
                    const avgMin = cluster.reduce((sum, d) => sum + d.hour * 60 + d.minute, 0) / cluster.length;
                    patterns.push({
                        destination: cluster[0].destination,
                        dayOfWeek: day,
                        avgHour: Math.floor(avgMin / 60),
                        avgMinute: Math.round(avgMin % 60),
                        occurrences: cluster.length,
                        lastUsed: Math.max(...cluster.map(d => d.timestamp)),
                    });
                }
            }
        }
    }

    await saveToStorage(PATTERNS_KEY, patterns);
}

/**
 * Cluster departures that fall within TIME_WINDOW_MINUTES of each other.
 */
function clusterByTime(departures: CommuteDeparture[]): CommuteDeparture[][] {
    if (departures.length === 0) return [];

    // Sort by time of day
    const sorted = [...departures].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

    const clusters: CommuteDeparture[][] = [[sorted[0]]];

    for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i].hour * 60 + sorted[i].minute;
        const lastCluster = clusters[clusters.length - 1];
        const lastTime = lastCluster[lastCluster.length - 1].hour * 60 + lastCluster[lastCluster.length - 1].minute;

        if (curr - lastTime <= TIME_WINDOW_MINUTES) {
            lastCluster.push(sorted[i]);
        } else {
            clusters.push([sorted[i]]);
        }
    }

    return clusters;
}

/**
 * Get commute patterns that apply to today.
 * Returns patterns sorted by how soon they'll occur.
 */
export async function getTodaysPatterns(): Promise<CommutePattern[]> {
    const patterns = (await getObject<CommutePattern[]>(PATTERNS_KEY)) || [];
    const today = new Date().getDay();
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    return patterns
        .filter(p => p.dayOfWeek === today)
        // Only show patterns that are coming up (within next 2 hours) or just passed (within 30 min)
        .filter(p => {
            const patternMinutes = p.avgHour * 60 + p.avgMinute;
            return patternMinutes >= (nowMinutes - 30) && patternMinutes <= (nowMinutes + 120);
        })
        .sort((a, b) => {
            const aMin = a.avgHour * 60 + a.avgMinute;
            const bMin = b.avgHour * 60 + b.avgMinute;
            return aMin - bMin;
        });
}

/**
 * Get the next upcoming commute pattern (if any) for notification scheduling.
 * Returns the next pattern that hasn't happened yet today.
 */
export async function getNextCommute(): Promise<CommutePattern | null> {
    const patterns = (await getObject<CommutePattern[]>(PATTERNS_KEY)) || [];
    const today = new Date().getDay();
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    const upcoming = patterns
        .filter(p => p.dayOfWeek === today)
        .filter(p => {
            const patternMinutes = p.avgHour * 60 + p.avgMinute;
            // Pattern is 10-60 min from now
            return patternMinutes > nowMinutes + 10 && patternMinutes <= nowMinutes + 60;
        })
        .sort((a, b) => {
            const aMin = a.avgHour * 60 + a.avgMinute;
            const bMin = b.avgHour * 60 + b.avgMinute;
            return aMin - bMin;
        });

    return upcoming[0] || null;
}

/**
 * Format a pattern for display.
 * Returns something like "Leave at 8:15 AM" or "Your 5:30 PM commute"
 */
export function formatPatternTime(pattern: CommutePattern): string {
    const h = pattern.avgHour % 12 || 12;
    const m = pattern.avgMinute.toString().padStart(2, '0');
    const ampm = pattern.avgHour >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
}

/**
 * Get short destination name from full address
 */
export function shortDestination(destination: string): string {
    return destination.split(',')[0].trim();
}
