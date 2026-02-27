import axios from 'axios';
import { TransitRoute } from './GoogleDirectionsService';
import { transit_realtime } from '../proto/gtfs-realtime';

// TTC GTFS-Realtime Feeds (Free/Open without auth)
const TTC_TRIP_UPDATES_URL = 'https://bustime.ttc.ca/gtfsrt/trips';
const TTC_VEHICLE_POSITIONS_URL = 'https://bustime.ttc.ca/gtfsrt/vehicles';

export const fetchLiveStatus = async (routes: TransitRoute[]): Promise<TransitRoute[]> => {
    let vehicles: transit_realtime.IFeedEntity[] = [];

    try {
        // Fetch the raw binary protobuf block
        const response = await axios.get(TTC_VEHICLE_POSITIONS_URL, {
            responseType: 'arraybuffer',
            timeout: 8000
        });

        // Use the compiled static module to decode the Uint8Array into a typed FeedMessage
        const feed = transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
        vehicles = feed.entity;
    } catch (error) {
        console.warn("TTC GTFS-RT is unreachable or decoding failed. Falling back to SCHEDULED times.");
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
