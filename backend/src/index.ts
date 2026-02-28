import express from 'express';
import cors from 'cors';
import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import polyline from '@mapbox/polyline';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── External API URLs (configurable for self-hosting) ───
const ROUTING_API_URL = process.env.ROUTING_API_URL || 'https://api.transitous.org/api';
const GEOCODING_API_URL = process.env.GEOCODING_API_URL || 'https://photon.komoot.io';

// TTC GTFS-RT Feed URLs
const TTC_VEHICLE_POSITIONS_URL = 'https://bustime.ttc.ca/gtfsrt/vehicles';
const TTC_SERVICE_ALERTS_URL = 'https://bustime.ttc.ca/gtfsrt/alerts';
const TTC_TRIP_UPDATES_URL = 'https://bustime.ttc.ca/gtfsrt/tripupdates';

// ── In-Memory Caches ──────────────────────────────────────
let vehicleCache: any[] = [];
let alertsCache: any[] = [];
let tripUpdatesCache: any[] = [];
let lastVehicleFetch: Date | null = null;
let lastAlertsFetch: Date | null = null;
let lastTripUpdatesFetch: Date | null = null;
let isFetchingVehicles = false;
let isFetchingAlerts = false;
let isFetchingTripUpdates = false;

// ── Haversine distance (meters) ──────────────────────────
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Polling: Vehicle Positions (every 15s) ───────────────
const updateVehicleCache = async () => {
    if (isFetchingVehicles) return;
    isFetchingVehicles = true;

    try {
        console.log(`[${new Date().toISOString()}] Fetching TTC vehicle positions...`);
        const response = await axios.get(TTC_VEHICLE_POSITIONS_URL, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // @ts-ignore
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
        vehicleCache = feed.entity;
        lastVehicleFetch = new Date();
        console.log(`Cached ${vehicleCache.length} vehicles.`);
    } catch (error: any) {
        console.error("Error fetching vehicles:", error.message);
    } finally {
        isFetchingVehicles = false;
    }
};

// ── Polling: Service Alerts (every 60s) ──────────────────
const updateAlertsCache = async () => {
    if (isFetchingAlerts) return;
    isFetchingAlerts = true;

    try {
        console.log(`[${new Date().toISOString()}] Fetching TTC service alerts...`);
        const response = await axios.get(TTC_SERVICE_ALERTS_URL, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // @ts-ignore
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
        alertsCache = feed.entity;
        lastAlertsFetch = new Date();
        console.log(`Cached ${alertsCache.length} service alerts.`);
    } catch (error: any) {
        console.error("Error fetching alerts:", error.message);
    } finally {
        isFetchingAlerts = false;
    }
};

// ── Polling: Trip Updates (every 30s) ────────────────────
const updateTripUpdatesCache = async () => {
    if (isFetchingTripUpdates) return;
    isFetchingTripUpdates = true;

    try {
        console.log(`[${new Date().toISOString()}] Fetching TTC trip updates...`);
        const response = await axios.get(TTC_TRIP_UPDATES_URL, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // @ts-ignore
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
        tripUpdatesCache = feed.entity;
        lastTripUpdatesFetch = new Date();
        console.log(`Cached ${tripUpdatesCache.length} trip updates.`);
    } catch (error: any) {
        console.error("Error fetching trip updates:", error.message);
    } finally {
        isFetchingTripUpdates = false;
    }
};

// Start polling
setInterval(updateVehicleCache, 15000);
setInterval(updateAlertsCache, 60000);
setInterval(updateTripUpdatesCache, 30000);

// Initial fetches
updateVehicleCache();
updateAlertsCache();
updateTripUpdatesCache();

// ── Health Endpoint ──────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        vehicles: { count: vehicleCache.length, lastFetch: lastVehicleFetch },
        alerts: { count: alertsCache.length, lastFetch: lastAlertsFetch },
        tripUpdates: { count: tripUpdatesCache.length, lastFetch: lastTripUpdatesFetch },
    });
});

// ── Vehicles Endpoint (existing) ─────────────────────────
app.get('/api/vehicles', (req, res) => {
    const routeId = req.query.route as string;

    if (!routeId) {
        return res.json({ vehicles: vehicleCache });
    }

    const activeVehiclesOnRoute = vehicleCache.filter(v =>
        v.vehicle?.trip?.routeId === routeId
    );

    res.json({ vehicles: activeVehiclesOnRoute });
});

// ── Nearby Vehicles Endpoint (NEW) ───────────────────────
// Returns vehicles within `radius` meters of a given lat/lon
// Used for "where's my bus?" countdown on HomeScreen
app.get('/api/nearby', (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseFloat(req.query.radius as string) || 800;

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: 'lat and lon are required' });
    }

    const nearby: any[] = [];

    for (const entity of vehicleCache) {
        const v = entity.vehicle;
        if (!v?.position?.latitude || !v?.position?.longitude) continue;

        const dist = haversineMeters(lat, lon, v.position.latitude, v.position.longitude);
        if (dist <= radius) {
            nearby.push({
                id: entity.id,
                routeId: v.trip?.routeId || 'Unknown',
                tripId: v.trip?.tripId,
                latitude: v.position.latitude,
                longitude: v.position.longitude,
                bearing: v.position.bearing,
                speed: v.position.speed,
                distanceMeters: Math.round(dist),
                timestamp: v.timestamp?.low || v.timestamp,
                currentStopSequence: v.currentStopSequence,
                currentStatus: v.currentStatus,
            });
        }
    }

    // Sort by distance
    nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);

    res.json({ nearby: nearby.slice(0, 10), total: nearby.length });
});

// ── Service Alerts Endpoint (NEW) ────────────────────────
// Parses real TTC GTFS-RT alerts feed
app.get('/api/alerts', (req, res) => {
    const routeFilter = req.query.routes as string; // comma-separated route IDs

    const alerts = alertsCache.map(entity => {
        const alert = entity.alert;
        if (!alert) return null;

        // Extract header text
        const headerText = alert.headerText?.translation?.[0]?.text
            || alert.headerText?.translation?.find((t: any) => t.language === 'en')?.text
            || 'Service Alert';

        // Extract description
        const descriptionText = alert.descriptionText?.translation?.[0]?.text
            || alert.descriptionText?.translation?.find((t: any) => t.language === 'en')?.text
            || '';

        // Extract affected route IDs
        const affectedRouteIds = (alert.informedEntity || [])
            .filter((e: any) => e.routeId)
            .map((e: any) => e.routeId);

        // Extract active period
        const activePeriod = (alert.activePeriod || []).map((p: any) => ({
            start: p.start?.low || p.start,
            end: p.end?.low || p.end,
        }));

        return {
            id: entity.id,
            headerText,
            descriptionText,
            affectedRouteIds,
            activePeriod,
            cause: alert.cause,
            effect: alert.effect,
        };
    }).filter(Boolean);

    // Filter by routes if specified
    if (routeFilter) {
        const filterIds = routeFilter.split(',');
        const filtered = alerts.filter((a: any) =>
            a.affectedRouteIds.length === 0 || // System-wide alerts always included
            a.affectedRouteIds.some((id: string) => filterIds.includes(id))
        );
        return res.json({ alerts: filtered });
    }

    res.json({ alerts });
});

// ── Trip Updates Endpoint (NEW) ──────────────────────────
// Returns real-time stop predictions for a given route
app.get('/api/predictions', (req, res) => {
    const routeId = req.query.route as string;

    if (!routeId) {
        return res.status(400).json({ error: 'route query parameter is required' });
    }

    const predictions: any[] = [];

    for (const entity of tripUpdatesCache) {
        const tu = entity.tripUpdate;
        if (!tu?.trip?.routeId || tu.trip.routeId !== routeId) continue;

        const stopUpdates = (tu.stopTimeUpdate || []).map((stu: any) => ({
            stopId: stu.stopId,
            stopSequence: stu.stopSequence,
            arrival: stu.arrival ? {
                delay: stu.arrival.delay,
                time: stu.arrival.time?.low || stu.arrival.time,
            } : null,
            departure: stu.departure ? {
                delay: stu.departure.delay,
                time: stu.departure.time?.low || stu.departure.time,
            } : null,
        }));

        predictions.push({
            tripId: tu.trip.tripId,
            routeId: tu.trip.routeId,
            directionId: tu.trip.directionId,
            startTime: tu.trip.startTime,
            vehicle: tu.vehicle?.id,
            stopUpdates,
            delay: tu.delay,
            timestamp: tu.timestamp?.low || tu.timestamp,
        });
    }

    res.json({ predictions, count: predictions.length });
});

// ── Helpers: Formatting + MOTIS mode mapping ────────────
function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} hr ${rem} mins` : `${hrs} hr`;
}

function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function mapMotisMode(mode: string): string {
    const m: Record<string, string> = {
        'TRAM': 'STREETCAR', 'BUS': 'BUS', 'SUBWAY': 'SUBWAY',
        'RAIL': 'RAIL', 'FERRY': 'FERRY', 'WALK': 'WALKING',
        'BIKE': 'BIKE', 'CAR': 'CAR',
    };
    return m[mode] || mode;
}

// Decode MOTIS polyline (precision 6, not Google's precision 5)
function decodeMotisPolyline(encoded: string): { latitude: number; longitude: number }[] {
    // @mapbox/polyline uses precision 5 by default. MOTIS uses precision 6.
    // We decode manually with precision 6.
    const factor = 1e6;
    const coords: { latitude: number; longitude: number }[] = [];
    let lat = 0, lng = 0, index = 0;
    while (index < encoded.length) {
        let shift = 0, result = 0, byte: number;
        do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coords.push({ latitude: lat / factor, longitude: lng / factor });
    }
    return coords;
}

// ── Geocode helper (Photon) ─────────────────────────────
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const resp = await axios.get(`${GEOCODING_API_URL}/api/`, {
            params: { q: query, lat: 43.6532, lon: -79.3832, limit: 1 },
            headers: { 'User-Agent': 'JATA-Transit-App/1.0' },
            timeout: 5000,
        });
        const features = resp.data?.features || [];
        if (features.length === 0) return null;
        const [lon, lat] = features[0].geometry.coordinates;
        return { lat, lng: lon };
    } catch {
        return null;
    }
}

// Parse "lat,lng" string or geocode a place name
async function resolveCoords(input: string): Promise<{ lat: number; lng: number } | null> {
    const parts = input.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])
        && Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180) {
        return { lat: parts[0], lng: parts[1] };
    }
    return geocode(input);
}

// ── Transit Directions Endpoint ─────────────────────────
// POST /api/directions { origin: string, destination: string }
// Calls Transitous (MOTIS) API and returns TransitRoute[] matching frontend interface
app.post('/api/directions', async (req, res) => {
    const { origin, destination } = req.body;
    if (!origin || !destination) {
        return res.status(400).json({ error: 'origin and destination are required' });
    }

    try {
        // Resolve coordinates
        const [fromCoords, toCoords] = await Promise.all([
            resolveCoords(origin),
            resolveCoords(destination),
        ]);

        if (!fromCoords || !toCoords) {
            return res.status(400).json({ error: 'Could not resolve origin or destination coordinates' });
        }

        // Call Transitous MOTIS API
        const motisResp = await axios.get(`${ROUTING_API_URL}/v5/plan`, {
            params: {
                fromPlace: `${fromCoords.lat},${fromCoords.lng}`,
                toPlace: `${toCoords.lat},${toCoords.lng}`,
                transitModes: 'BUS,SUBWAY,TRAM,RAIL',
                preTransitModes: 'WALK',
                postTransitModes: 'WALK',
                numItineraries: 5,
                time: new Date().toISOString(),
            },
            headers: { 'User-Agent': 'JATA-Transit-App/1.0' },
            timeout: 15000,
        });

        const itineraries = motisResp.data?.itineraries || [];

        // Transform MOTIS itineraries → TransitRoute[]
        const routes = itineraries.map((itin: any) => {
            const legs = itin.legs || [];

            // Build steps from legs
            const steps = legs.map((leg: any) => {
                const isTransit = leg.mode !== 'WALK' && leg.mode !== 'BIKE' && leg.mode !== 'CAR';

                let htmlInstructions: string;
                if (isTransit) {
                    const name = leg.routeShortName || leg.routeLongName || leg.displayName || leg.mode;
                    const headsign = leg.headsign || leg.to?.name || '';
                    htmlInstructions = `${name} towards ${headsign}`;
                } else {
                    htmlInstructions = `Walk to ${leg.to?.name || 'destination'}`;
                }

                let transitDetails = undefined;
                if (isTransit) {
                    const intermediateCount = (leg.intermediateStops || []).length;
                    transitDetails = {
                        departureStop: leg.from?.name || '',
                        arrivalStop: leg.to?.name || '',
                        departureTime: formatTime(leg.startTime),
                        departureTimeValue: Math.floor(new Date(leg.startTime).getTime() / 1000),
                        arrivalTimeValue: Math.floor(new Date(leg.endTime).getTime() / 1000),
                        lineName: [leg.routeShortName, leg.routeLongName].filter(Boolean).join(' ') || leg.displayName || 'Transit',
                        lineColor: leg.routeColor ? `#${leg.routeColor}` : undefined,
                        vehicleType: mapMotisMode(leg.mode),
                        numStops: intermediateCount + 1,
                    };
                }

                return {
                    htmlInstructions,
                    distanceText: formatDistance(leg.distance || 0),
                    durationText: formatDuration(leg.duration || 0),
                    durationValue: leg.duration || 0,
                    travelMode: isTransit ? 'TRANSIT' : 'WALKING',
                    startLocation: leg.from ? { lat: leg.from.lat, lng: leg.from.lon } : undefined,
                    endLocation: leg.to ? { lat: leg.to.lat, lng: leg.to.lon } : undefined,
                    transitDetails,
                };
            });

            // Find primary transit mode
            const transitSteps = steps.filter((s: any) => s.travelMode === 'TRANSIT');
            const primaryMode = transitSteps.length > 0
                ? (transitSteps[0].transitDetails?.vehicleType || 'TRANSIT')
                : 'WALKING';

            // Compute ETA minutes for first transit departure
            let etaMins = undefined;
            if (transitSteps.length > 0 && transitSteps[0].transitDetails?.departureTimeValue) {
                const depMs = transitSteps[0].transitDetails.departureTimeValue * 1000;
                etaMins = Math.max(0, Math.floor((depMs - Date.now()) / 60000));
            }

            // Decode all leg polylines and merge
            let coordinates: { latitude: number; longitude: number }[] = [];
            for (const leg of legs) {
                if (leg.polyline) {
                    coordinates = coordinates.concat(decodeMotisPolyline(leg.polyline));
                }
            }

            return {
                totalTimeText: formatDuration(itin.duration || 0),
                totalTimeValue: itin.duration || 0,
                mode: primaryMode,
                fare: '$3.35', // TTC flat fare
                steps,
                etaMins,
                coordinates: coordinates.length > 0 ? coordinates : undefined,
            };
        });

        res.json({ routes });
    } catch (error: any) {
        console.error('[JATA] Directions error:', error.message);
        res.status(502).json({ error: 'Failed to fetch transit directions', details: error.message });
    }
});

// ── Search / Geocoding Endpoint ─────────────────────────
// GET /api/search?q=union+station&lat=43.65&lon=-79.38
// Calls Photon and returns PlacePrediction[] matching frontend interface
app.get('/api/search', async (req, res) => {
    const query = req.query.q as string;
    const lat = parseFloat(req.query.lat as string) || 43.6532;
    const lon = parseFloat(req.query.lon as string) || -79.3832;

    if (!query || query.length < 2) {
        return res.json({ predictions: [] });
    }

    try {
        const photonResp = await axios.get(`${GEOCODING_API_URL}/api/`, {
            params: { q: query, lat, lon, limit: 5 },
            headers: { 'User-Agent': 'JATA-Transit-App/1.0' },
            timeout: 5000,
        });

        const features = photonResp.data?.features || [];

        const predictions = features.map((f: any) => {
            const p = f.properties || {};
            const coords = f.geometry?.coordinates; // [lon, lat]

            // Build description parts
            const name = p.name || p.street || 'Unknown';
            const parts = [p.street, p.city || p.county, p.state].filter(Boolean);
            const secondaryText = parts.join(', ') || 'Ontario, Canada';
            const description = [name, p.city || p.county, p.state || 'ON'].filter(Boolean).join(', ');

            return {
                place_id: `photon_${p.osm_id || Math.random().toString(36).slice(2)}`,
                description,
                structured_formatting: {
                    main_text: name,
                    secondary_text: secondaryText,
                },
                coordinates: coords ? { lat: coords[1], lng: coords[0] } : undefined,
            };
        });

        res.json({ predictions });
    } catch (error: any) {
        console.error('[JATA] Search error:', error.message);
        res.json({ predictions: [] });
    }
});

app.listen(PORT, () => {
    console.log(`JATA Relay Server running on http://localhost:${PORT}`);
    console.log(`Routing: ${ROUTING_API_URL}`);
    console.log(`Geocoding: ${GEOCODING_API_URL}`);
    console.log('Endpoints: /api/health, /api/vehicles, /api/nearby, /api/alerts, /api/predictions, /api/directions, /api/search');
});
