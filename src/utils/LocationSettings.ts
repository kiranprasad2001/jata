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
