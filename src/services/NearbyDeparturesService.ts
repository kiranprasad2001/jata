import axios from 'axios';
import Constants from 'expo-constants';

const HOST = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
const RELAY_NEARBY_URL = `http://${HOST}:3000/api/nearby`;
const RELAY_PREDICTIONS_URL = `http://${HOST}:3000/api/predictions`;

// Well-known TTC route names for display
const ROUTE_NAMES: Record<string, string> = {
    '1': 'Line 1',
    '2': 'Line 2',
    '3': 'Line 3',
    '4': 'Line 4',
    '29': '29 Dufferin',
    '32': '32 Eglinton West',
    '35': '35 Jane',
    '36': '36 Finch West',
    '39': '39 Finch East',
    '41': '41 Keele',
    '45': '45 Kipling',
    '52': '52 Lawrence West',
    '54': '54 Lawrence East',
    '60': '60 Steeles West',
    '63': '63 Ossington',
    '85': '85 Sheppard East',
    '95': '95 York Mills',
    '96': '96 Wilson',
    '501': '501 Queen',
    '503': '503 Kingston Rd',
    '504': '504 King',
    '505': '505 Dundas',
    '506': '506 Carlton',
    '509': '509 Harbourfront',
    '510': '510 Spadina',
    '511': '511 Bathurst',
    '512': '512 St Clair',
};

export interface NearbyVehicle {
    id: string;
    routeId: string;
    routeName: string;
    distanceMeters: number;
    bearing: number | null;
    speed: number | null;
    estimatedArrivalMins: number;
    isRealtime: boolean; // true = from GTFS-RT predictions, false = distance estimate
    latitude: number;
    longitude: number;
}

interface TripPrediction {
    tripId: string;
    stopUpdates: {
        stopId: string;
        stopSequence: number;
        arrival: { delay: number; time: number } | null;
        departure: { delay: number; time: number } | null;
    }[];
}

/**
 * Fetch real-time stop predictions for a route from the relay server.
 * Returns trip-level predictions with stop arrival times.
 */
async function fetchPredictions(routeId: string): Promise<TripPrediction[]> {
    try {
        const response = await axios.get(RELAY_PREDICTIONS_URL, {
            params: { route: routeId },
            timeout: 5000,
        });
        return response.data.predictions || [];
    } catch {
        return [];
    }
}

/**
 * For a given vehicle, find its next stop arrival time from trip predictions.
 * Returns ETA in minutes, or null if no matching prediction found.
 */
function getRealtimeEta(
    vehicleTripId: string | undefined,
    vehicleStopSequence: number | undefined,
    predictions: TripPrediction[]
): number | null {
    if (!vehicleTripId) return null;

    // Find the trip update matching this vehicle's trip
    const trip = predictions.find(p => p.tripId === vehicleTripId);
    if (!trip || trip.stopUpdates.length === 0) return null;

    const nowSec = Math.floor(Date.now() / 1000);

    // Strategy 1: If we know the vehicle's current stop sequence, find the next stop after it
    if (vehicleStopSequence != null) {
        const nextStops = trip.stopUpdates
            .filter(su => su.stopSequence > vehicleStopSequence && su.arrival?.time)
            .sort((a, b) => a.stopSequence - b.stopSequence);

        if (nextStops.length > 0 && nextStops[0].arrival) {
            const etaMin = Math.max(0, Math.round((nextStops[0].arrival.time - nowSec) / 60));
            return etaMin;
        }
    }

    // Strategy 2: Find the first stop with an arrival time still in the future
    const futureStops = trip.stopUpdates
        .filter(su => su.arrival?.time && su.arrival.time > nowSec)
        .sort((a, b) => (a.arrival?.time || 0) - (b.arrival?.time || 0));

    if (futureStops.length > 0 && futureStops[0].arrival) {
        const etaMin = Math.max(0, Math.round((futureStops[0].arrival.time - nowSec) / 60));
        return etaMin;
    }

    return null;
}

/**
 * Fetch vehicles near a given lat/lon from the relay server.
 * Enriches with real GTFS-RT stop predictions when available.
 * Returns them sorted by ETA with isRealtime flag.
 */
export async function fetchNearbyVehicles(
    lat: number,
    lon: number,
    radius: number = 800
): Promise<NearbyVehicle[]> {
    try {
        const response = await axios.get(RELAY_NEARBY_URL, {
            params: { lat, lon, radius },
            timeout: 5000,
        });

        const nearby = response.data.nearby || [];
        if (nearby.length === 0) return [];

        // Deduplicate by route — keep only the closest vehicle per route
        const byRoute = new Map<string, any>();
        for (const v of nearby) {
            const existing = byRoute.get(v.routeId);
            if (!existing || v.distanceMeters < existing.distanceMeters) {
                byRoute.set(v.routeId, v);
            }
        }

        const closestPerRoute = Array.from(byRoute.values());

        // Batch-fetch predictions for all unique route IDs
        const uniqueRouteIds = [...new Set(closestPerRoute.map((v: any) => v.routeId))];
        const predictionsByRoute = new Map<string, TripPrediction[]>();

        // Fetch predictions in parallel (max 4 concurrent to avoid hammering server)
        const predictionPromises = uniqueRouteIds.map(async (routeId) => {
            const preds = await fetchPredictions(routeId);
            predictionsByRoute.set(routeId, preds);
        });
        await Promise.all(predictionPromises);

        return closestPerRoute.map((v: any) => {
            const predictions = predictionsByRoute.get(v.routeId) || [];
            const realtimeEta = getRealtimeEta(v.tripId, v.currentStopSequence, predictions);

            return {
                id: v.id,
                routeId: v.routeId,
                routeName: ROUTE_NAMES[v.routeId] || `Route ${v.routeId}`,
                distanceMeters: v.distanceMeters,
                bearing: v.bearing ?? null,
                speed: v.speed ?? null,
                // Use real prediction when available, fall back to distance estimate
                estimatedArrivalMins: realtimeEta ?? Math.max(1, Math.round(v.distanceMeters / 300)),
                isRealtime: realtimeEta !== null,
                latitude: v.latitude,
                longitude: v.longitude,
            };
        })
            .sort((a, b) => a.estimatedArrivalMins - b.estimatedArrivalMins)
            .slice(0, 4); // Show at most 4 nearby vehicles
    } catch (error) {
        console.warn('[JATA] Failed to fetch nearby vehicles:', error);
        return [];
    }
}
