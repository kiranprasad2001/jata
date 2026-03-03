# How JATA Works — A Complete Guide

JATA (Just Another Transit App) is a privacy-first, distraction-free transit app for Toronto's TTC network. It runs on your phone, stores everything locally, uses no proprietary APIs, and needs zero accounts or logins. This document explains exactly what the app does, how every feature works, and what happens under the hood.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [The Four Screens](#the-four-screens)
3. [Screen 1: Home — "Where to?"](#screen-1-home--where-to)
4. [Screen 2: Route Options — Pick Your Route](#screen-2-route-options--pick-your-route)
5. [Screen 3: Active Transit — Step-by-Step Navigation](#screen-3-active-transit--step-by-step-navigation)
6. [Screen 4: Settings — Your Preferences](#screen-4-settings--your-preferences)
7. [Behind the Scenes: The Backend Server](#behind-the-scenes-the-backend-server)
8. [How Routing Works](#how-routing-works)
9. [How Live Data Works](#how-live-data-works)
10. [How Notifications Work](#how-notifications-work)
11. [How Commute Detection Works](#how-commute-detection-works)
12. [How Offline Mode Works](#how-offline-mode-works)
13. [Privacy and Data Storage](#privacy-and-data-storage)
14. [Self-Hosting Guide](#self-hosting-guide)
15. [Tech Stack Summary](#tech-stack-summary)

---

## Philosophy

JATA is built on five principles:

- **Privacy-first.** No logins, no accounts, no cloud storage, no tracking. Your data never leaves your phone.
- **Distraction-free.** Text is the primary interface. The map is opt-in, hidden behind a button tap. No ads, no promotions.
- **Stateless.** All data lives on your device. Delete the app and everything is gone. There is nothing to "deactivate."
- **Anonymous.** GPS is used only for routing and stop alerts. Your location is never tied to an identity, never stored on a server, and never sent anywhere after the initial route request.
- **Zero proprietary APIs.** Every external service JATA uses is free and open-source. You can self-host the entire backend. No Google, Apple, or paid API keys are required.

---

## The Four Screens

JATA has exactly four screens, connected in a simple stack:

```
HomeScreen  →  RouteOptionsScreen  →  ActiveTransitScreen
     ↓
SettingsScreen
```

You start at Home, search for a destination, pick a route, and follow it step by step. Settings is a side screen for saving locations and adjusting preferences. That's the entire app.

---

## Screen 1: Home — "Where to?"

This is the first thing you see when you open JATA. It's a single search bar with the prompt "Where to?" and a set of contextual shortcuts below it.

### Search

When you type 2 or more characters, JATA searches for matching places using Photon, a free geocoding engine built on OpenStreetMap data. Results appear as a dropdown list showing up to 5 matches, each with a place name and a secondary line (street, neighbourhood, or city). The search has a 300-millisecond debounce so it doesn't fire on every single keystroke.

When you tap a result (or press Return on your keyboard), JATA grabs your current GPS location as the origin, uses the selected place as the destination, and navigates to the Route Options screen. It also records this search for the frequent routes and commute detection features described later.

### Saved Locations

Below the search bar, you'll see shortcut buttons for:

- **Home** — a yellow-bordered button. If you've saved a home address in Settings, tapping it immediately searches for routes to that address.
- **Work** — a green-bordered button. Same behaviour as Home, but for your workplace.
- **Custom locations** — any additional shortcuts you've created (like "Gym" or "Mom's place"), shown as light-blue buttons.

If Home or Work isn't set yet, tapping the button shows an alert directing you to Settings.

### Nearby Vehicles ("Where's my bus?")

If your GPS is available, JATA shows a "Nearby" section listing the closest TTC vehicles within 800 metres. Each entry shows:

- The route number and name (e.g., "504 King")
- An estimated arrival time in minutes
- A colour indicator: **green** text means the ETA comes from real-time GTFS data (an actual prediction from the TTC's feed), while **gray** text with a `~` prefix means it's a rough estimate based on distance (assuming the vehicle travels at about 18 km/h)

This section refreshes every 30 seconds automatically. Up to 4 vehicles are shown, deduplicated so you only see the closest vehicle per route.

### Nearest Subway

If you're within 2 km of a subway station, a card appears showing the line name, its colour (yellow for Line 1, green for Line 2, purple for Line 4), the estimated headway ("Every 3 min"), and the distance to the station. This data comes from a static dataset bundled into the app — it works even without internet, which is useful when you're underground.

### Frequent Routes

Once you've searched for the same destination 3 or more times, it appears as a chip in a horizontal scroll under the "Frequent" label. The chip shows the first word of the destination (e.g., "Union" for "Union Station, Toronto"). Tapping it immediately starts a route search, saving you from typing.

### Commute Nudge

If JATA has detected a recurring commute pattern (more on this later), a yellow-bordered card appears near the top saying something like "Your 8:15 am commute — To Union." Tapping it starts a route search for that commute. This only appears when the pattern matches today's day of the week and the departure time is within the next 2 hours.

---

## Screen 2: Route Options — Pick Your Route

After you search for a destination, this screen shows the available transit routes. The header says "To: [destination]" with a Cancel button to go back.

### Route Cards

Each route is shown as a card with:

- **Total travel time** in large text (e.g., "42 min")
- **Live/Scheduled badge** — a green "Live" badge if the TTC's real-time feed confirms vehicles are actively running on that route right now, or a gray "Scheduled" badge if the route is based on the published timetable only
- **Mode** — the primary transit type: Subway, Bus, or Streetcar
- **Fare** — the cost of the trip (if available from the routing engine)

Cards have a coloured left border matching TTC line colours (yellow for subway, route-specific colours for bus/streetcar lines).

### How Routes Are Fetched

1. Your origin (current GPS location) and destination are sent to the backend's `/api/directions` endpoint.
2. The backend forwards the request to Transitous/MOTIS, a free open-source routing engine that uses TTC's published GTFS schedule data.
3. MOTIS returns up to 5 route options, each with walking and transit legs, departure/arrival times, stop counts, and route polylines.
4. The backend transforms this into a standardised format and sends it back to the app.
5. The app then checks the GTFS real-time feed (via `/api/vehicles`) to see if vehicles are actively reporting on each route, and sets the Live/Scheduled badge accordingly.

Tap a card to start navigation.

---

## Screen 3: Active Transit — Step-by-Step Navigation

This is the core of JATA. It's a real-time, text-first navigation screen that tracks your trip from start to finish.

### Header

At the top you'll see:

- **"End Route" button** — stops navigation and returns to Home
- **Tracking indicator** — a green dot with "Tracking Active" if GPS is working, or "Starting..." while it's initialising. If you're using a cached route (no internet), it shows "Cached Route" in gray.
- **"Share" button** — opens your phone's native share sheet with a message like "I'm on the TTC to Union Station. I should arrive around 3:45 PM (about 42 min)."
- **Arrival time** — large text showing "Arrive by 3:45 PM" and "42 min remaining" below it

### Step-by-Step Timeline

The main body is a vertical timeline showing every leg of your journey. Each step has a coloured dot on the left connected by a vertical line:

**Walking steps** show:
- A compass direction (N, NE, E, SE, S, SW, W, NW) based on the bearing between start and end points
- Distance and duration (e.g., "250m, 3 min")

**Transit steps** show:
- A coloured badge with the line name (e.g., "504 King" in the route's colour)
- "Board at [departure stop]"
- "Towards [arrival stop]"
- Number of stops and estimated duration (e.g., "8 stops, 15 min")
- **Entrance hints** for subway stations — if the app can determine the right entrance (either from the preceding walking instruction or from a built-in lookup table of 33 major TTC stations), it shows a blue box like "Entrance: via Front St W via PATH or Bay St"

### "YOU ARE HERE" Tracking

As you travel, the app continuously tracks your GPS and figures out which step you're currently on. It does this by comparing the current time against the departure times of each transit leg. The current step gets:

- A yellow highlight background
- A "YOU ARE HERE" badge
- Completed steps above fade to 50% opacity
- Upcoming steps below stay at full opacity

### Live Stops Remaining

For the active transit step, the app calculates how many stops are left based on elapsed time vs. total trip duration for that leg. You'll see "3 stop(s) left" that updates as you progress. This countdown uses time-based interpolation — it divides the total number of stops by the total leg duration and estimates where you are.

### Proximity Alerts

JATA uses GPS and time calculations to alert you at two critical moments:

1. **Approaching your destination** — When you're within 400 metres of your final stop, your phone vibrates twice (haptic feedback) and a notification appears: "Approaching: [stop name] — Your stop is [X]m away." This works even if the app is in the background.

2. **Upcoming transfer** — About 2 stops before you need to get off for a transfer (calculated from time remaining on the current leg), the app vibrates and notifies you: "Transfer coming up in ~2 stops." Each transfer is alerted only once.

### Persistent Lock Screen Notification

While you're navigating, a silent, updating notification sits on your lock screen showing something like "504 King — 3 stop(s) left, Arriving 3:42 PM." This updates every few seconds so you can check progress without opening the app.

### Service Disruption Alerts

Every 60 seconds, the app checks the TTC's real-time alerts feed for disruptions affecting any route in your current trip. If a disruption is detected:

- An orange banner appears at the top of the screen with the alert text (e.g., "Subway Line 1 Delays")
- A notification fires: "Service Disruption — [alert text]"
- The banner includes a tappable "Find alternative route" link

### One-Tap Rerouting

If you tap "Find alternative route" on the disruption banner, JATA takes your current GPS position as a new origin and navigates you back to the Route Options screen for the same destination. You pick a new route and continue. This means you don't have to type anything — one tap gets you a fresh set of alternatives.

### Offline Subway Info

When you're on a subway leg, the app shows a banner with headway information from its bundled static data: "Line 1 Yonge-University: every 3 min (Rush hour)." Since subway tunnels typically have no cell service, this data comes entirely from a pre-loaded dataset that knows every station, line, and time-of-day headway for the TTC subway system.

### Map Modal

A "View Map" button opens a full-screen modal showing your route on an OpenStreetMap-based map. The map displays:

- Your current location (blue dot)
- The full route polyline (orange line)
- A destination marker (orange pin)
- The view auto-fits to show the entire route with padding

The map uses free OpenStreetMap tiles — no Google Maps or Mapbox API key needed. The map is deliberately opt-in (button tap) rather than the default view, keeping the text-first philosophy intact.

### Save Return Trip

At the bottom of the screen, a "Save Return Trip" button saves your starting location as a custom shortcut on the Home screen. Next time you're at your destination and want to go back, it's one tap away.

---

## Screen 4: Settings — Your Preferences

Settings is organised into three sections:

### Preferences

- **Accessibility Mode** — a toggle that scales all fonts by 1.2x and all spacing by 1.5x across the entire app, with a slightly different background colour (#FAFAFA). Designed for users who need larger text and bigger touch targets.

### Saved Locations

- **Home** — a text field where you type your home address or stop name. Saves automatically when you tap away.
- **Work** — same as Home, for your workplace.
- **Custom locations** — a list of any extra shortcuts you've created. Each shows a label (e.g., "Gym") and the destination. You can remove any of them with a red "Remove" button.
- **Add Custom Shortcut** — a form with two fields (Label and Destination) and a green "Save Shortcut" button. After saving, the new shortcut appears on the Home screen.

### Advanced

- **Backend Server URL** — for self-hosters. By default, JATA auto-detects your development server's IP address. You can point it to any server running the JATA backend.
- **Google API Key** — optional. If you provide a Google Maps API key, the app uses Google Directions and Google Places instead of the free Transitous and Photon APIs. The key is stored in your device's encrypted secure storage, not in plain text. Most users will never need this.

---

## Behind the Scenes: The Backend Server

JATA's backend is a lightweight Node.js/Express server that acts as a gateway between the mobile app and several open-source data sources. It runs on port 3000 and has seven endpoints.

### Why a Backend?

Three reasons:

1. **GTFS-RT feeds are binary (Protocol Buffers).** The TTC publishes real-time data in protobuf format. The backend decodes these into JSON so the phone app doesn't need a protobuf library.
2. **Caching.** Instead of every phone hitting the TTC feeds directly, the backend polls them at fixed intervals and caches the results. This reduces load on the TTC's servers and makes the app faster.
3. **No client-side API keys.** The backend handles all external requests, so the phone app never needs to know about feed URLs or key management.

### Polling and Caching

The backend continuously polls three TTC GTFS real-time feeds:

| Feed | What it Contains | Poll Interval | Cache |
|------|-----------------|---------------|-------|
| Vehicle Positions | GPS locations of every active TTC vehicle (bus, streetcar, subway) | Every 15 seconds | In-memory array |
| Service Alerts | Active disruptions, delays, detours | Every 60 seconds | In-memory array |
| Trip Updates | Per-stop arrival/departure predictions for active trips | Every 30 seconds | In-memory array |

Each feed is fetched as a protobuf binary, decoded using the `gtfs-realtime-bindings` library, and stored in memory. If a fetch fails (network issue, TTC server down), the previous cached data is preserved. There is no database — everything lives in memory and resets if the server restarts.

### API Endpoints

**`GET /api/health`** — Returns server status, cache sizes, and when each feed was last fetched. Useful for monitoring.

**`GET /api/vehicles?route=504`** — Returns all cached vehicle positions, optionally filtered by route ID. Each vehicle includes GPS coordinates, bearing, speed, trip ID, and current stop sequence.

**`GET /api/nearby?lat=43.65&lon=-79.38&radius=800`** — Returns the 10 closest vehicles within a radius (default 800m) of a point, sorted by distance. Used for the "Nearby" section on the Home screen.

**`GET /api/alerts?routes=1,504`** — Returns parsed service alerts, optionally filtered to specific routes. Each alert includes a header, description, list of affected route IDs, active time periods, cause, and effect.

**`GET /api/predictions?route=504`** — Returns stop-by-stop arrival/departure predictions for all active trips on a route. Each prediction includes the trip ID, stop sequence, and predicted arrival/departure times (as Unix timestamps). Used for the real-time ETA in the "Nearby" widget.

**`POST /api/directions`** — The routing endpoint. Takes an origin and destination (either place names or lat/lon coordinates) and returns up to 5 transit route options. More detail in the next section.

**`GET /api/search?q=union+station&lat=43.65&lon=-79.38`** — The geocoding endpoint. Searches for places matching the query, biased toward the given coordinates. Returns up to 5 results with names, addresses, and coordinates.

### Rate Limiting

All endpoints are rate-limited to 100 requests per IP address per 15-minute window. If you exceed this, you get a 429 response.

---

## How Routing Works

When you search for a route, here's the full chain:

1. **App** sends your origin (GPS coordinates or address) and destination to the backend.
2. **Backend** checks if coordinates are provided. If you gave an address, it geocodes it to coordinates using Photon (free, OpenStreetMap-based).
3. **Backend** sends a request to Transitous/MOTIS:
   ```
   GET https://api.transitous.org/api/v5/plan?
     fromPlace=43.6426,-79.3871
     &toPlace=43.6693,-79.4028
     &transitModes=BUS,SUBWAY,TRAM,RAIL
     &numItineraries=5
   ```
4. **MOTIS** uses TTC's published GTFS schedule data (stop locations, timetables, routes) to calculate optimal transit routes. It returns itineraries with walking and transit legs, including departure/arrival times, stop names, route numbers, and encoded polylines.
5. **Backend** transforms the MOTIS response into JATA's internal format:
   - Converts durations from seconds to human-readable text ("42 min")
   - Converts distances from metres to readable text ("2.5 km")
   - Decodes polylines into coordinate arrays for map display
   - Extracts transit details (line name, colour, vehicle type, number of stops)
   - Determines the primary mode (the transit type used for the longest leg)
   - Sets a flat fare of $3.35 (TTC's single-ride price)
6. **App** receives the routes and displays them as cards.

If you've provided a Google API key in Settings, the backend tries Google Directions first and falls back to MOTIS on failure. But the default path uses only free, open-source services.

---

## How Live Data Works

JATA's real-time features rely on the TTC's GTFS Realtime feeds, which are publicly accessible Protocol Buffer streams.

### Vehicle Positions

The TTC publishes the GPS position of every active vehicle roughly every 15 seconds. The backend caches these and serves them via `/api/vehicles` and `/api/nearby`. The app uses this data to:

- Show nearby buses/streetcars on the Home screen
- Determine if a route is "Live" (vehicles actively reporting) or "Scheduled" (timetable only)

### Trip Updates (Stop Predictions)

For each active trip, the TTC publishes predicted arrival and departure times at upcoming stops. The backend caches these and serves them via `/api/predictions`. The app uses this to:

- Calculate real-time ETAs for nearby vehicles (green text = real prediction, gray = distance estimate)
- The "Nearby" section combines the vehicle's position data with its trip predictions to show accurate countdowns

### Service Alerts

The TTC publishes disruption alerts (delays, detours, closures) with affected routes and time periods. The backend parses and caches these, served via `/api/alerts`. The app polls this every 60 seconds during active navigation to show disruption banners and trigger rerouting.

---

## How Notifications Work

All notifications in JATA are 100% local. They are generated on your device by the app itself. No push notification servers (FCM, APNS) are involved. Your device token is never registered anywhere.

### Types of Notifications

1. **Approaching Stop** — Fires when you're within 400m of your destination or about 2 stops from a transfer. Includes haptic vibration (two quick bursts) so you can feel it even if your phone is on silent.

2. **Persistent Trip Update** — A silent, continuously-updating notification on your lock screen showing your current line, stops remaining, and arrival time. Dismissed automatically when you end your route.

3. **Service Disruption** — Fires once when a disruption is detected on your current route. Includes the alert text from the TTC feed.

4. **Predictive Departure** — Fires at a scheduled time based on your detected commute pattern. For example, if you usually leave for work at 8:30 AM, the app fires a notification at 8:20 AM saying "Time to head to Union Station — Leave now to catch your usual 8:30 AM." This is scheduled locally and requires no server.

---

## How Commute Detection Works

JATA learns your commute patterns entirely on-device. Here's the process:

1. **Recording.** Every time you search for a route, the app records the destination, day of week, hour, and minute. These are stored in AsyncStorage under the key `commute_departures`.

2. **Clustering.** The app groups these records by destination and day of week, then clusters them by time using a 45-minute window. For example, if you searched for "Union Station" on Mondays at 8:10, 8:20, and 8:30, those three searches become one cluster.

3. **Pattern detection.** If a cluster has 3 or more occurrences, it becomes a "commute pattern" with an average departure time. The app stores these in `commute_patterns`.

4. **Nudge.** When you open the Home screen on a day that matches a pattern, and the departure time is within the next 2 hours, a yellow card appears: "Your 8:15 am commute — To Union."

5. **Predictive notification.** The app schedules a local notification 10 minutes before your average departure time. If you usually leave at 8:30 AM, you get a push at 8:20 AM.

6. **Cleanup.** Departure records older than 60 days are automatically trimmed.

The entire system runs locally. No server ever sees your commute data.

---

## How Offline Mode Works

JATA is designed to work in areas with poor or no connectivity, which is common on the TTC subway.

### Route Caching

Every time your location updates during active navigation, the current route is saved to device storage under the key `active_route`. If the app is restarted without internet (e.g., you close it underground and reopen), it loads the cached route and displays it with a "Cached Route" label. You lose real-time updates, but the step-by-step directions remain intact.

### Bundled Subway Data

The app ships with a complete static dataset of the TTC subway network:

- **Line 1 (Yonge-University)** — 35 stations, yellow, peak headway 3 min
- **Line 2 (Bloor-Danforth)** — 32 stations, green, peak headway 3 min
- **Line 4 (Sheppard)** — 5 stations, purple, peak headway 5 min

Each line includes coordinates for every station and headway frequencies for five time periods (peak, midday, evening, weekend, late night). This means the "Nearest Subway" card on the Home screen and the headway banner on the Active Transit screen work entirely offline — no network request needed.

### Station Entrances

A lookup table of 33 major TTC station entrances is bundled into the app. When a transit step involves boarding at a subway station, the app checks this table and shows an entrance hint (e.g., "Entrance: via Front St W via PATH or Bay St"). This also works offline.

---

## Privacy and Data Storage

### What's Stored on Your Device

All persistent data uses React Native's AsyncStorage (unencrypted, app-sandboxed) except for sensitive keys:

| Storage Key | What It Holds | Format |
|-------------|--------------|--------|
| `home_stop` | Your saved home address | Plain text string |
| `work_stop` | Your saved work address | Plain text string |
| `custom_locations` | Your custom location shortcuts | JSON array of `{id, label, stop}` |
| `accessibility_mode` | Whether accessibility mode is on | Boolean |
| `active_route` | Last active route (for offline fallback) | JSON object |
| `route_history` | Destinations you've searched and how many times | JSON array of `{destination, count, lastUsed}` |
| `commute_departures` | Raw search timestamps for commute detection | JSON array of `{destination, dayOfWeek, hour, minute, timestamp}` |
| `commute_patterns` | Detected commute patterns | JSON array of `{destination, dayOfWeek, avgHour, avgMinute, occurrences}` |

The optional Google API key is stored in `expo-secure-store` (encrypted device keychain), not in AsyncStorage.

### What's NOT Stored

- No user accounts or identifiers
- No analytics or telemetry data
- No crash reports
- No usage metrics
- No advertising identifiers
- No server-side data of any kind

### What Leaves Your Device

The only data that leaves your phone is:

1. **Origin and destination** — sent to your backend server once per route search. The backend uses it only to call the routing and geocoding APIs.
2. **GPS coordinates** — sent to your backend once per "Nearby" refresh (every 30 seconds while on the Home screen) to find nearby vehicles. Coordinates are not logged or stored by the backend.

Your GPS is never sent to any third party directly. The backend acts as a relay, and the backend itself is stateless (no database, no logs).

### Deletion

Uninstall the app. Everything is gone. There are no remote accounts to deactivate, no data to request deletion of, no traces left anywhere.

---

## Self-Hosting Guide

JATA's backend is designed to be fully self-hostable.

### With Docker (Recommended)

```bash
git clone <repo-url>
cd jata
docker compose up
```

This builds and starts the backend on port 3000. The `docker-compose.yml` configures:

- Port mapping: `3000:3000`
- Environment variables for the routing API (defaults to Transitous) and geocoding API (defaults to Photon)
- Restart policy: `unless-stopped`

### Without Docker

```bash
cd backend
npm install
npm start
```

This runs the TypeScript backend directly using `ts-node`. For production, build first:

```bash
npm run build
npm run serve
```

### Connecting the App

In the app's Settings > Advanced, set the "Backend Server URL" to your server's address (e.g., `http://192.168.1.100:3000` or `https://your-server.com`).

### Environment Variables

Create a `.env` file in the `backend/` directory (see `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `ROUTING_API_URL` | `https://api.transitous.org/api` | Transitous/MOTIS routing endpoint |
| `GEOCODING_API_URL` | `https://photon.komoot.io` | Photon geocoding endpoint |

No API keys are needed. All default services are free and open.

---

## Tech Stack Summary

| Layer | Technology | License | Purpose |
|-------|-----------|---------|---------|
| Mobile framework | React Native + Expo (SDK 55) | MIT | Cross-platform app |
| Navigation | React Navigation (native stack) | MIT | Screen transitions |
| Routing engine | Transitous/MOTIS | Open Source | Transit directions using TTC GTFS data |
| Geocoding | Photon (Komoot) | Apache 2.0 | Address search, autocomplete |
| Maps | OpenStreetMap tiles via react-native-maps | ODbL/MIT | Map display in modal |
| Real-time data | TTC GTFS-RT feeds | Public | Vehicle positions, alerts, predictions |
| GTFS-RT decoding | gtfs-realtime-bindings | Apache 2.0 | Protocol Buffer parsing |
| Local storage | AsyncStorage | MIT | On-device persistence |
| Secure storage | expo-secure-store | MIT | Encrypted key storage |
| Notifications | expo-notifications | MIT | 100% local push notifications |
| Haptics | expo-haptics | MIT | Vibration alerts |
| Backend server | Express.js | MIT | API gateway and GTFS-RT relay |
| Containerisation | Docker | Apache 2.0 | Deployment |

Every dependency is open-source. Every external API is free. The entire system can be run on your own hardware with no paid services.
