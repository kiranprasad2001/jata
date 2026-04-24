# High-Level Design (HLD)

## System Overview

Jata is a mobile client architecture. It does not interface directly with the transit agencies in most cases; rather, it communicates with a backend proxy layer (like the `gta` Cloudflare Workers or its own `backend/` service) to retrieve optimized routing and vehicle data.

### Core Pillars
1. **Frontend App**: React Native (Expo) providing the UI, navigation (`@react-navigation`), and local state management.
2. **Backend Services**: A lightweight backend (Node.js/Docker) used for proxying requests, handling push notifications, or managing API keys.
3. **Local Storage Layer**: A hybrid approach using `expo-secure-store` for sensitive tokens and `react-native-mmkv` for high-throughput transit data caching.

---

## Context Diagram

```mermaid
C4Context
    title System Context Diagram for Jata Mobile App

    Person(user, "Mobile User", "Commuter using iOS or Android.")

    System(jata_app, "Jata App", "The React Native mobile application.")

    System_Ext(jata_backend, "Jata Backend / Proxy", "A server/worker providing normalized transit data.")
    System_Ext(expo_services, "Expo Application Services (EAS)", "Handles OTA updates and push notifications.")
    System_Ext(transit_apis, "Transit Open Data APIs", "Raw GTFS-RT feeds.")

    Rel(user, jata_app, "Interacts via touch screen")
    Rel(jata_app, jata_backend, "Fetches routes, vehicles, ETAs", "HTTPS")
    Rel(jata_app, expo_services, "Checks for OTA updates", "HTTPS")
    Rel(jata_backend, transit_apis, "Polls raw transit data", "HTTPS")
```

---

## Container Diagram

```mermaid
C4Container
    title Container Diagram for Jata

    Person(user, "User", "Commuter")

    System_Boundary(mobile_device, "Mobile Device (iOS/Android)") {
        Container(react_native, "React Native App", "Expo", "Main application logic and UI rendering.")
        ContainerDb(mmkv, "MMKV Cache", "C++ Key-Value", "Synchronous local cache for routes and stops.")
        Container(map_view, "Map Component", "Native View / WebView", "Renders the geographical data.")
    }

    System_Boundary(server, "Backend Infrastructure") {
        Container(backend_api, "Node.js Backend", "Express/Fastify", "Proxy for GTFS data, defined in /backend.")
    }

    Rel(user, react_native, "Touches screen")
    Rel(react_native, map_view, "Passes coordinates and polylines")
    Rel(react_native, mmkv, "Reads/Writes cache", "JSI Sync")
    Rel(react_native, backend_api, "Fetches live data", "REST")
```
