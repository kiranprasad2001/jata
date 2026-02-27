const { fetchTransitRoutes } = require('./src/services/GoogleDirectionsService');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const key = env.split('=')[1].trim();
process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY = key;

fetchTransitRoutes('Union Station Toronto', 'CN Tower Toronto').then(res => {
    console.log("Routes:", res.length);
    if (res.length > 0) {
        console.log("Has coordinates:", res[0].coordinates ? res[0].coordinates.length : 0);
    }
}).catch(console.error);
