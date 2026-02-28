// Global settings config for background location tracking and proximity logic

export const LOCATION_SETTINGS = {
    // Distance in meters to trigger the "Approaching Stop" alert
    // Standard block is ~100m. 400m gives about 45 seconds warning on subway.
    TRIGGER_DISTANCE_METERS: 400,

    // TaskManager background task name
    BACKGROUND_LOCATION_TASK: 'JATA_BACKGROUND_LOCATION_TASK',

    // Expo Location tracking configuration
    TRACKING_OPTIONS: {
        accuracy: 4, // Balanced power/accuracy (Approx 100 meters)
        timeInterval: 10000, // Poll every 10 seconds
        distanceInterval: 50, // Or every 50 meters moved
        showsBackgroundLocationIndicator: true, // Required for iOS
        foregroundService: {
            notificationTitle: 'JATA Active Route',
            notificationBody: 'Tracking your progress to alert you of your stop.',
            notificationColor: '#FFCC00'
        }
    }
};

/**
 * Haversine formula to calculate the distance between two lat/long points in meters.
 * Since GTFS only gives coordinates, we need to compare our current GPS to the target stop GPS.
 */
export const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;

    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;

    const lat1Rad = lat1 * rad;
    const lat2Rad = lat2 * rad;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/** Calculate cardinal direction (N/NE/E/SE/S/SW/W/NW) from point A to point B. */
export const calculateCardinalDirection = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const rad = Math.PI / 180;
    const dLon = (lon2 - lon1) * rad;
    const y = Math.sin(dLon) * Math.cos(lat2 * rad);
    const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
              Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    bearing = (bearing + 360) % 360;

    const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    return directions[Math.round(bearing / 45) % 8];
};
