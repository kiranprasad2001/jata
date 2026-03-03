import axios from 'axios';
import { ENDPOINTS } from '../config/api';

// Well-known TTC route names — keep in sync with NearbyDeparturesService
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
 * Fetch upcoming departures at a specific stop from the live GTFS-RT cache.
 */
export async function fetchStopDepartures(stopId: string): Promise<StopDeparture[]> {
    try {
        const response = await axios.get(ENDPOINTS.stopDepartures(stopId), {
            timeout: 5000,
        });
        return (response.data.departures || []).map((d: { routeId: string; arrivalMins: number }) => ({
            routeId: d.routeId,
            routeName: ROUTE_NAMES[d.routeId] || `Route ${d.routeId}`,
            arrivalMins: d.arrivalMins,
        }));
    } catch {
        return [];
    }
}
