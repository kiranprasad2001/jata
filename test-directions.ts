import { fetchTransitRoutes } from './src/services/GoogleDirectionsService';
import dotenv from 'dotenv';
dotenv.config();

fetchTransitRoutes('Union Station Toronto', 'CN Tower Toronto').then(res => {
    console.log("Routes:", res.length);
    console.log("Has coordinates:", res[0]?.coordinates?.length > 0);
}).catch(console.error);
