# Technical Reference

## 1. App Configuration (`app.json`)
The `app.json` file configures the Expo build process. Key fields include:
- `bundleIdentifier` (iOS) / `package` (Android): The unique store IDs for the app.
- `plugins`: Specifies native plugins required by Expo, such as `expo-location` (to inject necessary iOS Info.plist location rationale) and `expo-secure-store`.

## 2. Environment Variables (`.env`)
Environment variables are injected into the React Native app using `expo-constants` or `.env` plugins.
- `EXPO_PUBLIC_API_URL`: The URL of the `backend/` proxy server.
- `EXPO_PUBLIC_MAPBOX_TOKEN`: Required if using Mapbox tiles or SDKs.

## 3. Scripts
- `test-directions.ts` / `.js`: Utility scripts used to test the Mapbox Polyline decoding logic locally without having to boot the mobile simulator.

## 4. Backend Configuration
The `backend/` directory is containerized via `docker-compose.yml`.
```yaml
# Example docker-compose usage
docker-compose up -d
```
This boots the local proxy server, which the mobile app (running in the simulator) points to via `EXPO_PUBLIC_API_URL`.
