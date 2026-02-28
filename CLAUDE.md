# JATA - Minimalist TTC Transit App

## Philosophy
- **Privacy-first**: No logins, no accounts, no cloud storage, no tracking
- **Distraction-free**: Text-first UI, map is secondary (opt-in modal only)
- **Stateless client**: All data lives on-device, deleted when app is removed
- **Anonymous**: GPS used only for routing/alerts, never tied to identity

## Tech Stack
- **Framework**: React Native + Expo (SDK 55, RN 0.83)
- **Routing API**: Google Directions API (transit mode) via `EXPO_PUBLIC_GOOGLE_MAPS_KEY`
- **Live data**: TTC GTFS Realtime via backend relay server (`backend/` dir, port 3000)
- **Storage**: AsyncStorage (local only, no cloud sync). MMKV is in deps but unused.
- **Notifications**: 100% local via expo-notifications (no FCM/APNS push tokens)
- **Haptics**: expo-haptics for proximity alerts
- **Maps**: react-native-maps, used minimally (modal overlay only)

## Architecture

### Navigation (Stack)
```
HomeScreen → RouteOptionsScreen → ActiveTransitScreen
     ↓
SettingsScreen
```

### Key Files
| File | Purpose |
|------|---------|
| `src/screens/HomeScreen.tsx` | "Where to?" search + Google Places autocomplete + saved shortcuts |
| `src/screens/RouteOptionsScreen.tsx` | Route cards with Live/Scheduled, fare, crowd level |
| `src/screens/ActiveTransitScreen.tsx` | Step-by-step timeline, location tracking, map modal, ETA |
| `src/screens/SettingsScreen.tsx` | Home/Work/Custom locations, accessibility mode |
| `src/services/GoogleDirectionsService.ts` | Fetches transit routes, decodes polylines |
| `src/services/TtcGtfsService.ts` | Live vehicle data from TTC GTFS relay |
| `src/services/NotificationService.ts` | Local notifications + haptic alerts |
| `src/utils/storage.ts` | AsyncStorage wrapper (saveToStorage, getString, getObject, etc.) |
| `src/utils/LocationSettings.ts` | Proximity detection (Haversine), tracking config |
| `src/constants/theme.ts` | TTC colors: Yellow (#FFCC00), Green (#00A54F), Red (#DA291C) |
| `src/navigation/types.ts` | RootStackParamList type definitions |

### AsyncStorage Keys
- `home_stop` / `work_stop` — saved location strings
- `custom_locations` — `CustomLocation[]` array (`{id, label, stop}`)
- `accessibility_mode` — boolean (font/spacing scaling)
- `active_route` — cached `TransitRoute` object for offline use

### Data Interfaces
- `TransitRoute` — totalTimeText/Value, mode, fare, steps[], coordinates[], crowdLevel, isLive, etaMins
- `RouteStep` — htmlInstructions, distanceText, durationText, travelMode (TRANSIT/WALKING), transitDetails?
- `transitDetails` — departureStop, arrivalStop, departureTime/Value, lineName, lineColor, vehicleType, numStops

## Feature Status

### Done
- No auth, local-only storage, anonymous GPS
- "Where to?" one-tap interface with Google Places autocomplete
- Route options with Live/Scheduled badges, fare, crowd level (mock data)
- Step-by-step timeline with current step tracking ("YOU ARE HERE")
- Arrival time display ("Arrive by 3:45 PM")
- Tracking status indicator (green dot + "Tracking Active")
- Map modal centered on user position with route polyline
- TTC color coding throughout
- Local notifications + haptic alerts at destination
- ETA sharing via native share sheet
- Accessibility mode (font/spacing scaling)

### Mock/Partial
- Crowd levels — UI works, data is randomly generated
- Entrance hints — hardcoded "Front St W via Path" for all stations
- Return trip button — shows demo alert, doesn't save

### Not Implemented
- Offline caching — route saved but not read back as fallback
- Directional compass — walking steps show no N/S/E/W direction
- Haptic alerts for transfers — only fires at final destination
- Dynamic disruption rerouting
- In-station navigation (transfer directions)
- iOS Live Activities / Dynamic Island

## Design Principles
- Keep it simple. No clutter. Every element must earn its place.
- Text-first: the step-by-step list IS the primary interface
- Map is opt-in (button tap), not the default view
- Use device hardware (haptics, local notifications) instead of screen alerts
- TTC standard colors for instant recognition (Yellow/Green/Red)
- No over-engineering: skip abstractions for one-time operations

## Environment
- API key: Set `EXPO_PUBLIC_GOOGLE_MAPS_KEY` in `.env`
- Backend relay: Run `cd backend && npm start` for live TTC vehicle data
- Dev: `npx expo start` — scan QR with Expo Go on iOS/Android
