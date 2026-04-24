# Jata Overview

## Project Purpose

**Jata** is a high-performance mobile application designed for public transit tracking. While web-based trackers (like `gta`) offer universal access, Jata provides a native, responsive experience for iOS and Android users. It leverages device-specific capabilities such as secure storage, haptic feedback, and location services to deliver a premium commuting tool.

## Core Functionality

1. **Cross-Platform Native UI**: Built with React Native and Expo, ensuring a consistent and fluid user interface across both major mobile platforms.
2. **Real-time Transit Data**: Consumes Protocol Buffer (`protobufjs`) data from transit APIs to display live vehicle positions and ETAs.
3. **Map Integration**: Utilizes Mapbox polylines and `react-native-webview` (or native maps) for performant rendering of complex transit routes and live vehicles.
4. **High-Speed Caching**: Employs `react-native-mmkv` for lightning-fast key-value storage, ensuring the app launches instantly and remembers user preferences (like favorite routes or agencies).
5. **Location Awareness**: Integrates `expo-location` to automatically center the map on the user and find the nearest transit stops.

## Target Audience

- **Daily Commuters**: Users who need a fast, reliable mobile app to check their bus or train status while walking to the stop.
- **Power Users**: Commuters who prefer native app experiences (push notifications, haptics) over progressive web apps (PWAs).

## Project Philosophy

Jata emphasizes **mobile-first performance**. By decoding Protobufs directly on the device and utilizing synchronous storage engines like MMKV, the app aims to eliminate loading screens and provide transit data the millisecond the app is opened.
