/**
 * Static TTC subway data for offline-first mode.
 * Bundled into the app so it works underground where there's no data connection.
 *
 * Source: TTC published schedules (approximate headways)
 * Last updated: 2026-02
 */

export interface SubwayStation {
    name: string;
    lat: number;
    lon: number;
}

export interface SubwayLine {
    id: string;
    name: string;
    color: string;
    stations: SubwayStation[];
    // Approximate headway in minutes by time period
    headways: {
        peak: number;     // Weekday 7-9am, 4-7pm
        midday: number;   // Weekday 9am-4pm
        evening: number;  // Weekday 7-11pm
        weekend: number;  // Sat/Sun
        lateNight: number; // After 11pm
    };
    hours: { start: string; end: string }; // e.g. "6:00 AM" to "1:30 AM"
}

// Determine which headway period we're currently in
export function getCurrentHeadway(line: SubwayLine): { minutes: number; period: string } {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0=Sun, 6=Sat

    const isWeekend = day === 0 || day === 6;

    if (hour >= 23 || hour < 6) {
        return { minutes: line.headways.lateNight, period: 'Late night' };
    }
    if (isWeekend) {
        return { minutes: line.headways.weekend, period: 'Weekend' };
    }
    if ((hour >= 7 && hour < 9) || (hour >= 16 && hour < 19)) {
        return { minutes: line.headways.peak, period: 'Rush hour' };
    }
    if (hour >= 9 && hour < 16) {
        return { minutes: line.headways.midday, period: 'Midday' };
    }
    return { minutes: line.headways.evening, period: 'Evening' };
}

// Find the nearest subway station to a lat/lon
export function findNearestStation(lat: number, lon: number): { line: SubwayLine; station: SubwayStation; distanceMeters: number } | null {
    let closest: { line: SubwayLine; station: SubwayStation; distanceMeters: number } | null = null;

    for (const line of SUBWAY_LINES) {
        for (const station of line.stations) {
            const dist = haversine(lat, lon, station.lat, station.lon);
            if (!closest || dist < closest.distanceMeters) {
                closest = { line, station, distanceMeters: dist };
            }
        }
    }

    return closest;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const SUBWAY_LINES: SubwayLine[] = [
    {
        id: '1',
        name: 'Line 1 Yonge-University',
        color: '#FFCC00',
        headways: { peak: 3, midday: 5, evening: 5, weekend: 5, lateNight: 10 },
        hours: { start: '6:00 AM', end: '1:30 AM' },
        stations: [
            { name: 'Finch', lat: 43.7806, lon: -79.4147 },
            { name: 'North York Centre', lat: 43.7675, lon: -79.4128 },
            { name: 'Sheppard-Yonge', lat: 43.7612, lon: -79.4107 },
            { name: 'York Mills', lat: 43.7440, lon: -79.4066 },
            { name: 'Lawrence', lat: 43.7254, lon: -79.4025 },
            { name: 'Eglinton', lat: 43.7066, lon: -79.3984 },
            { name: 'Davisville', lat: 43.6972, lon: -79.3975 },
            { name: 'St Clair', lat: 43.6881, lon: -79.3934 },
            { name: 'Summerhill', lat: 43.6822, lon: -79.3912 },
            { name: 'Rosedale', lat: 43.6770, lon: -79.3883 },
            { name: 'Bloor-Yonge', lat: 43.6709, lon: -79.3857 },
            { name: 'Wellesley', lat: 43.6654, lon: -79.3840 },
            { name: 'College', lat: 43.6613, lon: -79.3830 },
            { name: 'Dundas', lat: 43.6562, lon: -79.3810 },
            { name: 'Queen', lat: 43.6522, lon: -79.3791 },
            { name: 'King', lat: 43.6490, lon: -79.3779 },
            { name: 'Union', lat: 43.6452, lon: -79.3806 },
            { name: 'St Andrew', lat: 43.6476, lon: -79.3846 },
            { name: 'Osgoode', lat: 43.6508, lon: -79.3869 },
            { name: 'St Patrick', lat: 43.6547, lon: -79.3883 },
            { name: 'Queen\'s Park', lat: 43.6600, lon: -79.3903 },
            { name: 'Museum', lat: 43.6671, lon: -79.3933 },
            { name: 'Spadina (Line 1)', lat: 43.6676, lon: -79.4036 },
            { name: 'Dupont', lat: 43.6747, lon: -79.4067 },
            { name: 'St Clair West', lat: 43.6840, lon: -79.4152 },
            { name: 'Eglinton West', lat: 43.6994, lon: -79.4358 },
            { name: 'Glencairn', lat: 43.7085, lon: -79.4406 },
            { name: 'Lawrence West', lat: 43.7161, lon: -79.4444 },
            { name: 'Yorkdale', lat: 43.7245, lon: -79.4478 },
            { name: 'Wilson', lat: 43.7336, lon: -79.4502 },
            { name: 'Sheppard West', lat: 43.7497, lon: -79.4625 },
            { name: 'Downsview Park', lat: 43.7537, lon: -79.4782 },
            { name: 'Finch West', lat: 43.7654, lon: -79.4910 },
            { name: 'Pioneer Village', lat: 43.7776, lon: -79.5093 },
            { name: 'Highway 407', lat: 43.7846, lon: -79.5233 },
            { name: 'Vaughan Metropolitan Centre', lat: 43.7942, lon: -79.5275 },
        ],
    },
    {
        id: '2',
        name: 'Line 2 Bloor-Danforth',
        color: '#00A54F',
        headways: { peak: 3, midday: 5, evening: 5, weekend: 5, lateNight: 10 },
        hours: { start: '6:00 AM', end: '1:30 AM' },
        stations: [
            { name: 'Kipling', lat: 43.6372, lon: -79.5362 },
            { name: 'Islington', lat: 43.6374, lon: -79.5243 },
            { name: 'Royal York', lat: 43.6378, lon: -79.5109 },
            { name: 'Old Mill', lat: 43.6381, lon: -79.4949 },
            { name: 'Jane', lat: 43.6499, lon: -79.4840 },
            { name: 'Runnymede', lat: 43.6519, lon: -79.4755 },
            { name: 'High Park', lat: 43.6538, lon: -79.4676 },
            { name: 'Keele', lat: 43.6555, lon: -79.4602 },
            { name: 'Dundas West', lat: 43.6567, lon: -79.4527 },
            { name: 'Lansdowne', lat: 43.6594, lon: -79.4429 },
            { name: 'Dufferin', lat: 43.6602, lon: -79.4355 },
            { name: 'Ossington', lat: 43.6621, lon: -79.4265 },
            { name: 'Christie', lat: 43.6637, lon: -79.4183 },
            { name: 'Bathurst', lat: 43.6658, lon: -79.4113 },
            { name: 'Spadina (Line 2)', lat: 43.6672, lon: -79.4041 },
            { name: 'St George', lat: 43.6680, lon: -79.3997 },
            { name: 'Bay', lat: 43.6705, lon: -79.3901 },
            { name: 'Bloor-Yonge', lat: 43.6709, lon: -79.3857 },
            { name: 'Sherbourne', lat: 43.6724, lon: -79.3766 },
            { name: 'Castle Frank', lat: 43.6736, lon: -79.3687 },
            { name: 'Broadview', lat: 43.6770, lon: -79.3586 },
            { name: 'Chester', lat: 43.6785, lon: -79.3519 },
            { name: 'Pape', lat: 43.6802, lon: -79.3449 },
            { name: 'Donlands', lat: 43.6815, lon: -79.3380 },
            { name: 'Greenwood', lat: 43.6832, lon: -79.3305 },
            { name: 'Coxwell', lat: 43.6843, lon: -79.3235 },
            { name: 'Woodbine', lat: 43.6863, lon: -79.3128 },
            { name: 'Main Street', lat: 43.6893, lon: -79.3018 },
            { name: 'Victoria Park', lat: 43.6953, lon: -79.2893 },
            { name: 'Warden', lat: 43.7116, lon: -79.2793 },
            { name: 'Kennedy', lat: 43.7324, lon: -79.2637 },
        ],
    },
    {
        id: '4',
        name: 'Line 4 Sheppard',
        color: '#A020F0',
        headways: { peak: 5, midday: 6, evening: 6, weekend: 6, lateNight: 0 },
        hours: { start: '6:00 AM', end: '1:00 AM' },
        stations: [
            { name: 'Sheppard-Yonge', lat: 43.7612, lon: -79.4107 },
            { name: 'Bayview', lat: 43.7668, lon: -79.3864 },
            { name: 'Bessarion', lat: 43.7686, lon: -79.3760 },
            { name: 'Leslie', lat: 43.7713, lon: -79.3657 },
            { name: 'Don Mills', lat: 43.7758, lon: -79.3461 },
        ],
    },
];
