import axios from 'axios';

// In Phase 2, this key should be moved to app.json extra config or a .env file
// and restricted via Google Cloud Console to the iOS Bundle ID / Android Package Name.
// WARNING: Do not commit a raw unrestricted API key.
const GOOGLE_DIRECTIONS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || 'PLACEHOLDER_KEY';

export interface TransitRoute {
    totalTimeText: string;
    totalTimeValue: number; // in seconds
    mode: string; // e.g. 'SUBWAY', 'BUS', 'STREETCAR'
    fare?: string;
    steps: RouteStep[];
    // For Phase 2 Mock
    crowdLevel?: 'Low' | 'Med' | 'High';
    isLive?: boolean;
    etaMins?: number;
}

export interface RouteStep {
    htmlInstructions: string;
    distanceText: string;
    durationText: string;
    travelMode: string; // 'TRANSIT' or 'WALKING'
    transitDetails?: {
        departureStop: string;
        arrivalStop: string;
        departureTime: string;
        departureTimeValue?: number;
        lineName: string;
        lineColor?: string;
        vehicleType: string;
        numStops: number;
    };
}

export const fetchTransitRoutes = async (
    origin: string,
    destination: string
): Promise<TransitRoute[]> => {
    // if (GOOGLE_DIRECTIONS_API_KEY === 'PLACEHOLDER_KEY') {
    //     console.warn("Using placeholder API key! Returning mock data.");
    //     return [
    //         {
    //             totalTimeText: '25 mins',
    //             totalTimeValue: 1500,
    //             mode: 'SUBWAY',
    //             fare: '$3.35',
    //             crowdLevel: 'Low',
    //             isLive: true,
    //             steps: [
    //                 {
    //                     htmlInstructions: 'Walk to Union Station',
    //                     distanceText: '0.5 km',
    //                     durationText: '6 mins',
    //                     travelMode: 'WALKING'
    //                 },
    //                 {
    //                     htmlInstructions: 'Subway towards Finch',
    //                     distanceText: '5 km',
    //                     durationText: '15 mins',
    //                     travelMode: 'TRANSIT',
    //                     transitDetails: {
    //                         departureStop: 'Union Station',
    //                         arrivalStop: 'Bloor-Yonge Station',
    //                         departureTime: '10:05 AM',
    //                         lineName: 'Line 1 Yonge-University',
    //                         lineColor: '#FFCC00',
    //                         vehicleType: 'SUBWAY',
    //                         numStops: 5
    //                     }
    //                 },
    //                 {
    //                     htmlInstructions: `Walk to ${destination}`,
    //                     distanceText: '0.3 km',
    //                     durationText: '4 mins',
    //                     travelMode: 'WALKING'
    //                 }
    //             ]
    //         },
    //         {
    //             totalTimeText: '38 mins',
    //             totalTimeValue: 2280,
    //             mode: 'STREETCAR',
    //             fare: '$3.35',
    //             crowdLevel: 'Med',
    //             isLive: false,
    //             steps: [
    //                 {
    //                     htmlInstructions: 'Walk to King St West at Bay St',
    //                     distanceText: '0.2 km',
    //                     durationText: '3 mins',
    //                     travelMode: 'WALKING'
    //                 },
    //                 {
    //                     htmlInstructions: '504 King Streetcar towards Broadview Station',
    //                     distanceText: '4.2 km',
    //                     durationText: '31 mins',
    //                     travelMode: 'TRANSIT',
    //                     transitDetails: {
    //                         departureStop: 'King St W at Bay St',
    //                         arrivalStop: 'King St E at Parliament St',
    //                         departureTime: '10:12 AM',
    //                         lineName: '504 King',
    //                         lineColor: '#ED1C24', // TTC Red
    //                         vehicleType: 'STREETCAR',
    //                         numStops: 12
    //                     }
    //                 },
    //                 {
    //                     htmlInstructions: `Walk to ${destination}`,
    //                     distanceText: '0.4 km',
    //                     durationText: '4 mins',
    //                     travelMode: 'WALKING'
    //                 }
    //             ]
    //         },
    //         {
    //             totalTimeText: '41 mins',
    //             totalTimeValue: 2460,
    //             mode: 'BUS',
    //             fare: '$3.35',
    //             crowdLevel: 'High',
    //             isLive: true,
    //             steps: [
    //                 {
    //                     htmlInstructions: 'Walk to Bay St at Front St West',
    //                     distanceText: '0.3 km',
    //                     durationText: '4 mins',
    //                     travelMode: 'WALKING'
    //                 },
    //                 {
    //                     htmlInstructions: '19 Bay Bus towards Dupont',
    //                     distanceText: '3.8 km',
    //                     durationText: '28 mins',
    //                     travelMode: 'TRANSIT',
    //                     transitDetails: {
    //                         departureStop: 'Bay St at Front St W',
    //                         arrivalStop: 'Bay St at Bloor St W',
    //                         departureTime: '10:08 AM',
    //                         lineName: '19 Bay',
    //                         lineColor: '#ED1C24', // TTC Red
    //                         vehicleType: 'BUS',
    //                         numStops: 14
    //                     }
    //                 },
    //                 {
    //                     htmlInstructions: `Walk to ${destination}`,
    //                     distanceText: '0.8 km',
    //                     durationText: '9 mins',
    //                     travelMode: 'WALKING'
    //                 }
    //             ]
    //         }
    //     ];
    // }

    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/directions/json`,
            {
                params: {
                    origin,
                    destination,
                    mode: 'transit',
                    alternatives: true,
                    region: 'ca', // Bias establishment searches to Canada/Toronto
                    departure_time: 'now', // Force Google to use real-time scheduling / delays!
                    key: GOOGLE_DIRECTIONS_API_KEY,
                },
            }
        );

        if (response.data.status !== 'OK') {
            throw new Error(`Directions API Error: ${response.data.status}`);
        }

        const routes: TransitRoute[] = response.data.routes.map((route: any) => {
            const leg = route.legs[0];

            // Extract steps
            const steps: RouteStep[] = leg.steps.map((step: any) => {
                let transitDetails;
                if (step.travel_mode === 'TRANSIT') {
                    transitDetails = {
                        departureStop: step.transit_details.departure_stop.name,
                        arrivalStop: step.transit_details.arrival_stop.name,
                        departureTime: step.transit_details.departure_time.text,
                        departureTimeValue: step.transit_details.departure_time.value,
                        lineName: step.transit_details.line.name || step.transit_details.line.short_name,
                        lineColor: step.transit_details.line.color,
                        vehicleType: step.transit_details.line.vehicle.type,
                        numStops: step.transit_details.num_stops,
                    };
                }

                return {
                    htmlInstructions: step.html_instructions,
                    distanceText: step.distance.text,
                    durationText: step.duration.text,
                    travelMode: step.travel_mode,
                    transitDetails,
                };
            });

            // Find primary transit mode
            const transitSteps = steps.filter(s => s.travelMode === 'TRANSIT');
            const primaryMode = transitSteps.length > 0
                ? transitSteps[0].transitDetails?.vehicleType || 'TRANSIT'
                : 'WALKING';

            // Extract Fare if available
            const fare = response.data.routes[0].fare?.text;

            let etaMins = undefined;
            if (transitSteps.length > 0 && transitSteps[0].transitDetails?.departureTimeValue) {
                const depTimeMs = transitSteps[0].transitDetails.departureTimeValue * 1000;
                etaMins = Math.max(0, Math.floor((depTimeMs - Date.now()) / 60000));
            }

            return {
                totalTimeText: leg.duration.text,
                totalTimeValue: leg.duration.value,
                mode: primaryMode,
                fare,
                steps,
                etaMins,
                // Mock data for Phase 2 as per spec
                crowdLevel: ['Low', 'Med', 'High'][Math.floor(Math.random() * 3)] as 'Low' | 'Med' | 'High',
                isLive: Math.random() > 0.3, // 70% chance of being live
            };
        });

        return routes;
    } catch (error) {
        console.error("Error fetching directions:", error);
        throw error;
    }
};
