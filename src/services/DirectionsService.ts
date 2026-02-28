import axios from 'axios';
import { ENDPOINTS } from '../config/api';

export interface TransitRoute {
    totalTimeText: string;
    totalTimeValue: number; // in seconds
    mode: string; // e.g. 'SUBWAY', 'BUS', 'STREETCAR'
    fare?: string;
    steps: RouteStep[];
    isLive?: boolean;
    etaMins?: number;
    coordinates?: { latitude: number; longitude: number }[];
}

export interface RouteStep {
    htmlInstructions: string;
    distanceText: string;
    durationText: string;
    durationValue: number; // seconds
    travelMode: string; // 'TRANSIT' or 'WALKING'
    startLocation?: { lat: number; lng: number };
    endLocation?: { lat: number; lng: number };
    transitDetails?: {
        departureStop: string;
        arrivalStop: string;
        departureTime: string;
        departureTimeValue?: number;
        arrivalTimeValue?: number;
        lineName: string;
        lineColor?: string;
        vehicleType: string;
        numStops: number;
    };
}

/**
 * Fetch transit routes from the backend API gateway.
 * Backend proxies to Transitous (MOTIS) and transforms the response.
 * No Google API key needed — zero cost, fully self-hostable.
 */
export const fetchTransitRoutes = async (
    origin: string,
    destination: string
): Promise<TransitRoute[]> => {
    try {
        const response = await axios.post(ENDPOINTS.directions, {
            origin,
            destination,
        }, { timeout: 20000 });

        return response.data.routes || [];
    } catch (error) {
        console.error('[JATA] Error fetching directions:', error);
        throw error;
    }
};
