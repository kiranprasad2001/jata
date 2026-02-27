import express from 'express';
import cors from 'cors';
import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const TTC_VEHICLE_POSITIONS_URL = 'https://bustime.ttc.ca/gtfsrt/vehicles';

// In-Memory Cache
let vehicleCache: any[] = [];
let lastFetchTime: Date | null = null;
let isFetching = false;

// Polling function to download and decode the GTFS-RT feed
const updateGtfsCache = async () => {
    if (isFetching) return;
    isFetching = true;

    try {
        console.log(`[${new Date().toISOString()}] Fetching TTC GTFS-RT feed...`);
        const response = await axios.get(TTC_VEHICLE_POSITIONS_URL, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // @ts-ignore
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));

        vehicleCache = feed.entity;
        lastFetchTime = new Date();
        console.log(`Successfully cached ${vehicleCache.length} vehicles.`);
    } catch (error: any) {
        console.error("Error updating GTFS cache:", error.message);
    } finally {
        isFetching = false;
    }
};

// Start polling every 15 seconds
setInterval(updateGtfsCache, 15000);
// Initial fetch
updateGtfsCache();

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', lastFetchTime, vehiclesInCache: vehicleCache.length });
});

// Main endpoint for JATA App
app.get('/api/vehicles', (req, res) => {
    const routeId = req.query.route as string;

    if (!routeId) {
        return res.json({ vehicles: vehicleCache });
    }

    // Filter by route short name
    const activeVehiclesOnRoute = vehicleCache.filter(v =>
        v.vehicle?.trip?.routeId === routeId
    );

    res.json({ vehicles: activeVehiclesOnRoute });
});

app.listen(PORT, () => {
    console.log(`Relay Server running on http://localhost:${PORT}`);
});
