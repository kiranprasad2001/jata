import express from 'express';
import cors from 'cors';
import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
    console.log(`JATA Relay Server running on http://localhost:${PORT}`);
    console.log('Endpoints: /api/health, /api/vehicles, /api/nearby, /api/alerts, /api/predictions');
});
