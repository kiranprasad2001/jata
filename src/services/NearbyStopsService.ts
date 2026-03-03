import axios from 'axios';
import { ENDPOINTS } from '../config/api';

export interface NearbyStop {
    stopId: string;
    name: string;
    distanceMeters: number;
    lat: number;
    lon: number;
}

export interface StopDeparture {
    routeId: string;
    routeName: string;
    arrivalMins: number;
    isRealtime: boolean;
    direction: string;
}

/**
 * Fetch bus/streetcar stops near a given lat/lon from the backend.
 * The backend serves these from the static stops.json (updated daily by CI).
 */
export async function fetchNearbyStops(
    lat: number,
    lon: number,
    radius: number = 400
): Promise<NearbyStop[]> {
    try {
        const response = await axios.get(ENDPOINTS.stopsNearby, {
            params: { lat, lon, radius },
            timeout: 5000,
        });
        return response.data.stops || [];
    } catch {
        return [];
    }
}

/**
 * Fetch upcoming departures at a specific stop.
 * Primary: NextBus/UmoIQ API (real predictions, always real-time).
 * Fallback: GTFS-RT vehicle proximity (when NextBus index not ready).
 */
export async function fetchStopDepartures(stopId: string): Promise<StopDeparture[]> {
    try {
        const response = await axios.get(ENDPOINTS.stopDepartures(stopId), {
            timeout: 10000, // NextBus API can be a bit slow
        });
        return (response.data.departures || []).map((d: any) => ({
            routeId: d.routeId,
            routeName: d.routeTitle || `Route ${d.routeId}`,
            arrivalMins: d.arrivalMins,
            isRealtime: d.isRealtime ?? true,
            direction: d.direction || '',
        }));
    } catch {
        return [];
    }
}
