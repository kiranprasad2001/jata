import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface LeafletMapProps {
    routeCoordinates: { latitude: number; longitude: number }[];
    userLocation: { latitude: number; longitude: number } | null;
    destinationLabel?: string;
}

export default function LeafletMap({
    routeCoordinates,
    userLocation,
    destinationLabel = 'Destination',
}: LeafletMapProps) {
    const webViewRef = useRef<WebView>(null);
    const hasLoadedRef = useRef(false);

    // Build the HTML once with initial data baked in (avoids WebView reloads)
    const html = useMemo(() => {
        const coordsJson = JSON.stringify(
            routeCoordinates.map(c => [c.latitude, c.longitude])
        );
        const userJson = userLocation
            ? JSON.stringify([userLocation.latitude, userLocation.longitude])
            : 'null';
        const safeLabel = destinationLabel.replace(/'/g, "\\'");

        return LEAFLET_HTML
            .replace('__ROUTE_COORDS_JSON__', coordsJson)
            .replace('__USER_LOCATION_JSON__', userJson)
            .replace('__DESTINATION_LABEL__', safeLabel);
    }, []); // Empty deps — HTML is built once on mount

    // Push subsequent user location updates into the WebView
    useEffect(() => {
        if (!hasLoadedRef.current || !userLocation) return;
        webViewRef.current?.injectJavaScript(
            `window.updateUserLocation(${userLocation.latitude}, ${userLocation.longitude}); true;`
        );
    }, [userLocation]);

    return (
        <WebView
            ref={webViewRef}
            source={{ html }}
            style={styles.webview}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            onLoad={() => { hasLoadedRef.current = true; }}
            onMessage={() => {}} // Required when using injectJavaScript
        />
    );
}

const styles = StyleSheet.create({
    webview: { flex: 1 },
});

// ── Self-contained Leaflet HTML ──────────────────────────────────────
// Loads Leaflet from CDN, renders OSM tiles, draws the route polyline,
// and places circle markers for the destination (red) and user (blue).
// No external images or API keys needed.
const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: true });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Route coordinates (injected from React Native)
    var routeCoords = __ROUTE_COORDS_JSON__;

    // Draw route polyline in TTC Red
    if (routeCoords.length > 0) {
      L.polyline(routeCoords, {
        color: '#DA291C',
        weight: 4,
        opacity: 0.9
      }).addTo(map);

      // Destination marker (red circle) at last coordinate
      var dest = routeCoords[routeCoords.length - 1];
      L.circleMarker(dest, {
        radius: 8,
        fillColor: '#DA291C',
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 1
      }).addTo(map).bindPopup('__DESTINATION_LABEL__');
    }

    // User location marker (blue circle)
    var userMarker = null;
    var initialUserLocation = __USER_LOCATION_JSON__;

    function setUserMarker(lat, lng) {
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        userMarker = L.circleMarker([lat, lng], {
          radius: 7,
          fillColor: '#4285F4',
          color: '#FFFFFF',
          weight: 2,
          fillOpacity: 1
        }).addTo(map);
      }
    }

    if (initialUserLocation) {
      setUserMarker(initialUserLocation[0], initialUserLocation[1]);
    }

    // Fit bounds to show entire route + user location
    var allPoints = routeCoords.slice();
    if (initialUserLocation) {
      allPoints.push(initialUserLocation);
    }
    if (allPoints.length > 0) {
      var bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([43.6532, -79.3832], 13); // Default: Toronto
    }

    // Called from React Native via injectJavaScript
    window.updateUserLocation = function(lat, lng) {
      setUserMarker(lat, lng);
    };
  <\/script>
</body>
</html>`;
