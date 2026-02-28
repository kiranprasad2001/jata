import axios from 'axios';
import { TransitRoute } from './GoogleDirectionsService';
import Constants from 'expo-constants';

// Relay Server (Dynamically uses dev machine IP for physical device testing)
const HOST = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
const RELAY_VEHICLES_URL = `http://${HOST}:3000/api/vehicles`;

export const fetchLiveStatus = async (routes: TransitRoute[]): Promise<TransitRoute[]> => {
    let vehicles: any[] = [];

    try {
        // Fetch pre-parsed JSON from our Relay Server
        const response = await axios.get(RELAY_VEHICLES_URL, {
            timeout: 5000
        });
        vehicles = response.data.vehicles || [];
    } catch (error) {
        console.warn("Relay Server unreachable. Falling back to SCHEDULED times.");
        return routes.map(route => ({ ...route, isLive: false }));
    }

    return routes.map(route => {
        let isLive = false;

        // Extract the route short name (e.g. "504" from "504 King Streetcar" or "1" from "Line 1 Yonge-University")
        const firstTransitStep = route.steps.find(s => s.travelMode === 'TRANSIT');
        let shortLineName = '';

        if (firstTransitStep?.transitDetails) {
            const rawName = firstTransitStep.transitDetails.lineName;
            // Best-effort regex to pull out the route number, TTC route ids are numeric
            const match = rawName.match(/\d+/);
            if (match) {
                shortLineName = match[0];
            } else if (rawName.toLowerCase().includes('subway') || rawName.toLowerCase().includes('line')) {
                // Hardcode major subway lines if numbers aren't clear
                if (rawName.includes('1')) shortLineName = '1';
                if (rawName.includes('2')) shortLineName = '2';
                if (rawName.includes('4')) shortLineName = '4';
            }
        }

        // If we found a valid route ID representation, scan the decoded GTFS entities!
        if (shortLineName) {
            const activeVehiclesOnRoute = vehicles.filter(v =>
                v.vehicle?.trip?.routeId === shortLineName
            );

            // If there's at least one actively reporting vehicle on this route right now, it's live!
            if (activeVehiclesOnRoute.length > 0) {
                isLive = true;
            }
        }

        return {
            ...route,
            isLive,
            // TTC doesn't natively support OccupancyStatus perfectly yet, keeping mock logic here
            crowdLevel: ['Low', 'Med', 'High'][Math.floor(Math.random() * 3)] as 'Low' | 'Med' | 'High',
        };
    });
};

export interface ServiceAlert {
    id: string;
    headerText: string;
    descriptionText: string;
    affectedRouteIds: string[];
}

const RELAY_ALERTS_URL = `http://${HOST}:3000/api/alerts`;

export const fetchServiceAlerts = async (routeIds: string[]): Promise<ServiceAlert[]> => {
    try {
        const response = await axios.get(RELAY_ALERTS_URL, { timeout: 5000 });
        const alerts: ServiceAlert[] = response.data.alerts || [];
        if (routeIds.length === 0) return alerts;
        return alerts.filter(alert =>
            alert.affectedRouteIds.some(id => routeIds.includes(id))
        );
    } catch {
        return [];
    }
};
