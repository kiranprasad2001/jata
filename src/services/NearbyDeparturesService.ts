import axios from 'axios';
import Constants from 'expo-constants';

const HOST = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
const RELAY_NEARBY_URL = `http://${HOST}:3000/api/nearby`;

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
    latitude: number;
    longitude: number;
}

/**
 * Fetch vehicles near a given lat/lon from the relay server.
 * Returns them sorted by distance with estimated arrival times.
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

        // Deduplicate by route — keep only the closest vehicle per route
        const byRoute = new Map<string, any>();
        for (const v of nearby) {
            const existing = byRoute.get(v.routeId);
            if (!existing || v.distanceMeters < existing.distanceMeters) {
                byRoute.set(v.routeId, v);
            }
        }

        return Array.from(byRoute.values()).map((v: any) => ({
            id: v.id,
            routeId: v.routeId,
            routeName: ROUTE_NAMES[v.routeId] || `Route ${v.routeId}`,
            distanceMeters: v.distanceMeters,
            bearing: v.bearing ?? null,
            speed: v.speed ?? null,
            // Rough ETA: walking speed ~1.4m/s for buses approaching at ~5m/s avg in city
            estimatedArrivalMins: Math.max(1, Math.round(v.distanceMeters / 300)),
            latitude: v.latitude,
            longitude: v.longitude,
        }))
            .sort((a, b) => a.estimatedArrivalMins - b.estimatedArrivalMins)
            .slice(0, 4); // Show at most 4 nearby vehicles
    } catch (error) {
        console.warn('[JATA] Failed to fetch nearby vehicles:', error);
        return [];
    }
}
