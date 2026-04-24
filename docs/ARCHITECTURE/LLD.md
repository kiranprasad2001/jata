# Low-Level Design (LLD)

## 1. Expo and React Native Setup

The application uses the Managed Expo workflow (with custom dev clients if necessary, leveraging `react-native-nitro-modules`).

### Navigation
- `@react-navigation/native-stack` is used for screen transitions.
- The routing state is likely linked to deep linking configurations in `app.json` to allow opening the app to specific transit stops.

### Map Rendering
Given the presence of `react-native-webview` and `@mapbox/polyline`, the app either uses a WebView-bridged mapping solution (like Leaflet injected into a webview) for maximum compatibility with existing web logic, or it decodes polylines in JS and passes them to a native map module.

## 2. Data Decoding & Performance

Parsing massive JSON payloads on the React Native JS thread causes severe frame drops.
- **Protobuf Decoding**: Jata uses `protobufjs` to decode GTFS-Realtime binary payloads. Binary decoding is faster and uses significantly less memory than JSON parsing.
- **MMKV**: Standard `AsyncStorage` is asynchronous and slow. `react-native-mmkv` uses JSI (JavaScript Interface) to read/write to disk synchronously in C++, providing 30x faster read speeds for large static datasets (like Stop IDs and Route Shapes).

## 3. Backend Proxy (`backend/`)

The repository includes a `backend/` folder and a `docker-compose.yml`.
This implies that Jata relies on a custom backend service (likely running locally during development via Docker) to proxy and filter transit APIs, preventing the mobile client from having to download the entire multi-megabyte GTFS-RT feed.
