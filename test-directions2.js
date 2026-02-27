const { fetchTransitRoutes } = require('./src/services/GoogleDirectionsService');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const key = env.split('=')[1].trim();
process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY = key;

fetchTransitRoutes('Union Station Toronto', 'Eaton Centre Toronto').then(res => {
    console.log("Routes:", res.length);
}).catch(console.error);
