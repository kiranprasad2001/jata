import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Share, Modal, Platform, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ActiveTransitScreenProps } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { getBoolean, saveToStorage, getObject } from '../utils/storage';
import { RouteStep, TransitRoute } from '../services/GoogleDirectionsService';
import { CustomLocation } from './SettingsScreen';
import * as Location from 'expo-location';
import { LOCATION_SETTINGS, calculateDistanceMeters, calculateCardinalDirection } from '../utils/LocationSettings';
import { requestNotificationPermissions, triggerApproachingStopAlert } from '../services/NotificationService';
import { TTC_ENTRANCES } from '../data/ttcEntrances';
import { fetchServiceAlerts, ServiceAlert } from '../services/TtcGtfsService';
import { updateTripNotification, dismissTripNotification } from '../services/NotificationService';

/** Determine which step index the user is currently on.
 *  Uses departure times from Google transit data — if the current time
 *  has passed a transit step's departure time, user is on or past that step. */
function determineCurrentStep(
    _userLat: number,
    _userLon: number,
    steps: RouteStep[],
): number {
    const now = Date.now() / 1000;
    for (let i = steps.length - 1; i >= 0; i--) {
        const step = steps[i];
        if (step.travelMode === 'TRANSIT' && step.transitDetails?.departureTimeValue) {
            if (now >= step.transitDetails.departureTimeValue) {
                return i;
            }
        }
    }
    return 0;
}

export default function ActiveTransitScreen() {
    const route = useRoute<ActiveTransitScreenProps['route']>();
    const navigation = useNavigation<ActiveTransitScreenProps['navigation']>();
    const { origin, destination } = route.params;

    // Feature 1: Offline caching — use route data with cached fallback
    const [routeData, setRouteData] = useState<TransitRoute>(route.params.route);
    const [isOffline, setIsOffline] = useState(false);

    const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [arrivalTime, setArrivalTime] = useState<string>('');
    const hasAlertedDestination = useRef(false);
    const alertedTransfers = useRef<Set<number>>(new Set());
    const [stopsRemaining, setStopsRemaining] = useState<number | null>(null);
    const [serviceAlerts, setServiceAlerts] = useState<ServiceAlert[]>([]);
    const mapRef = useRef<MapView>(null);

    // Feature 4: Identify transfer steps (TRANSIT followed eventually by another TRANSIT)
    const transferStepIndices = useMemo(() => {
        const indices: number[] = [];
        for (let i = 0; i < routeData.steps.length; i++) {
            const step = routeData.steps[i];
            if (step.travelMode === 'TRANSIT' && step.transitDetails) {
                const hasNextTransit = routeData.steps.slice(i + 1).some(s => s.travelMode === 'TRANSIT');
                if (hasNextTransit) indices.push(i);
            }
        }
        return indices;
    }, [routeData.steps]);

    // Feature 1: Load cached route on mount as fallback
    useEffect(() => {
        const loadCachedIfNeeded = async () => {
            if (!route.params.route?.steps?.length) {
                const cached = await getObject<TransitRoute>('active_route');
                if (cached?.steps?.length) {
                    setRouteData(cached);
                    setIsOffline(true);
                }
            }
        };
        loadCachedIfNeeded();
    }, []);

    // Compute arrival time on mount
    useEffect(() => {
        const arrivalMs = Date.now() + routeData.totalTimeValue * 1000;
        const arrivalDate = new Date(arrivalMs);
        const hours = arrivalDate.getHours();
        const minutes = arrivalDate.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        const displayMin = minutes < 10 ? `0${minutes}` : minutes;
        setArrivalTime(`${displayHour}:${displayMin} ${ampm}`);
    }, [routeData.totalTimeValue]);

    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;

        const init = async () => {
            setIsAccessibilityMode(await getBoolean('accessibility_mode') ?? false);
            await saveToStorage('active_route', routeData);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Permission to access location was denied');
                return;
            }
            await requestNotificationPermissions();

            setIsTracking(true);
            locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: LOCATION_SETTINGS.TRACKING_OPTIONS.timeInterval,
                    distanceInterval: LOCATION_SETTINGS.TRACKING_OPTIONS.distanceInterval,
                },
                (location) => {
                    console.log(`[JATA] Location update: ${location.coords.latitude}, ${location.coords.longitude}`);

                    setUserLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    });

                    const stepIdx = determineCurrentStep(
                        location.coords.latitude,
                        location.coords.longitude,
                        routeData.steps,
                    );
                    setCurrentStepIndex(stepIdx);

                    // Phase 3: Calculate stops remaining for active transit step
                    const currentStep = routeData.steps[stepIdx];
                    if (currentStep.travelMode === 'TRANSIT' && currentStep.transitDetails) {
                        const td = currentStep.transitDetails;
                        if (td.departureTimeValue && td.arrivalTimeValue && td.numStops) {
                            const nowSec = Date.now() / 1000;
                            const totalDuration = td.arrivalTimeValue - td.departureTimeValue;
                            const elapsed = nowSec - td.departureTimeValue;
                            const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
                            const remaining = Math.max(0, td.numStops - Math.floor(progress * td.numStops));
                            setStopsRemaining(remaining);
                        }
                    } else {
                        setStopsRemaining(null);
                    }

                    // Feature 4: Check transfer alerts (time-based)
                    const now = Date.now() / 1000;
                    for (const idx of transferStepIndices) {
                        if (alertedTransfers.current.has(idx)) continue;
                        const td = routeData.steps[idx].transitDetails;
                        if (!td?.arrivalTimeValue || !td?.departureTimeValue || !td.numStops || td.numStops <= 2) continue;

                        const totalSeconds = td.arrivalTimeValue - td.departureTimeValue;
                        const avgStopSeconds = totalSeconds / td.numStops;
                        const twoStopsBefore = td.arrivalTimeValue - (2 * avgStopSeconds);

                        if (now >= twoStopsBefore && now < td.arrivalTimeValue) {
                            alertedTransfers.current.add(idx);
                            triggerApproachingStopAlert(td.arrivalStop, 'Transfer coming up in ~2 stops');
                        }
                    }

                    // Destination proximity alert
                    if (hasAlertedDestination.current || !routeData.coordinates?.length) return;

                    const dest = routeData.coordinates[routeData.coordinates.length - 1];
                    const distance = calculateDistanceMeters(
                        location.coords.latitude,
                        location.coords.longitude,
                        dest.latitude,
                        dest.longitude
                    );

                    if (distance < LOCATION_SETTINGS.TRIGGER_DISTANCE_METERS) {
                        hasAlertedDestination.current = true;
                        const lastStep = routeData.steps[routeData.steps.length - 1];
                        const destName = lastStep.transitDetails?.arrivalStop
                            ?? lastStep.htmlInstructions.replace(/<[^>]+>/g, '').replace(/^Walk to\s*/i, '').trim();
                        triggerApproachingStopAlert(destName, `Your stop is ${Math.round(distance)}m away`);
                    }
                }
            );
        };

        init();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, [routeData, transferStepIndices]);

    // Phase 3: Poll for service disruption alerts
    useEffect(() => {
        const routeIds: string[] = [];
        for (const step of routeData.steps) {
            if (step.travelMode === 'TRANSIT' && step.transitDetails) {
                const match = step.transitDetails.lineName.match(/\d+/);
                if (match) routeIds.push(match[0]);
            }
        }

        const pollAlerts = async () => {
            const alerts = await fetchServiceAlerts(routeIds);
            setServiceAlerts(alerts);
        };

        pollAlerts();
        const interval = setInterval(pollAlerts, 60000);
        return () => clearInterval(interval);
    }, [routeData.steps]);

    // Phase 3: Persistent trip notification (lightweight Live Activity)
    useEffect(() => {
        if (!isTracking || !arrivalTime) return;
        const step = routeData.steps[currentStepIndex];
        const lineName = step?.transitDetails?.lineName || 'Active Route';
        updateTripNotification(stopsRemaining, arrivalTime, lineName);
    }, [stopsRemaining, arrivalTime, isTracking, currentStepIndex]);

    // Dismiss trip notification when leaving screen
    useEffect(() => () => { dismissTripNotification(); }, []);

    const handleShareETA = async () => {
        try {
            const rawDestination = routeData.steps[routeData.steps.length - 1].htmlInstructions.replace(/<[^>]+>/g, '');
            const cleanDestination = rawDestination.replace(/^Walk to\s*/i, '').trim();

            await Share.share({
                message: `I'm currently on the TTC to ${cleanDestination}. I should arrive around ${arrivalTime} (about ${routeData.totalTimeText}).`,
            });
        } catch (error: any) {
            console.error('Error sharing ETA:', error.message);
        }
    };

    // Feature 3: Save return trip as a shortcut
    const handleSaveReturnTrip = async () => {
        if (!origin) {
            Alert.alert('Unavailable', 'Could not determine your starting location.');
            return;
        }
        const existing = (await getObject<CustomLocation[]>('custom_locations')) || [];
        if (existing.some(loc => loc.stop === origin)) {
            Alert.alert('Already Saved', 'This return destination is already in your shortcuts.');
            return;
        }

        const label = origin.includes(',') && !isNaN(Number(origin.split(',')[0]))
            ? 'Start Point'
            : origin.split(',')[0].trim();

        const updated = [...existing, { id: Date.now().toString(), label: `Return: ${label}`, stop: origin }];
        await saveToStorage('custom_locations', updated);
        Alert.alert('Saved', 'Return trip added to your home screen shortcuts.');
    };

    const scaleFont = (size: number) => isAccessibilityMode ? size * 1.2 : size;
    const scaleSpacing = (size: number) => isAccessibilityMode ? size * 1.5 : size;

    // Feature 5: Get entrance hint from walking step or lookup table
    const getEntranceHint = (stationName: string, stepIndex: number): string | null => {
        // Try parsing the preceding walking step
        if (stepIndex > 0) {
            const prevStep = routeData.steps[stepIndex - 1];
            if (prevStep.travelMode === 'WALKING') {
                const clean = prevStep.htmlInstructions.replace(/<[^>]+>/g, '');
                const match = clean.match(/Walk to (.+)/i);
                if (match) return `via ${match[1]}`;
            }
        }
        // Fallback to static lookup
        const normalized = stationName.replace(/\s*Station\s*$/i, '') + ' Station';
        return TTC_ENTRANCES[normalized] ? `via ${TTC_ENTRANCES[normalized]}` : null;
    };

    const renderStep = ({ item, index }: { item: RouteStep, index: number }) => {
        const isTransit = item.travelMode === 'TRANSIT' && item.transitDetails;
        const isCurrent = index === currentStepIndex;
        const isCompleted = index < currentStepIndex;

        let accentColor = COLORS.border;
        if (isTransit) {
            const type = item.transitDetails?.vehicleType;
            if (type?.includes('SUBWAY')) accentColor = COLORS.line1;
            if (item.transitDetails?.lineColor) accentColor = item.transitDetails.lineColor;
        }

        const dotStyle = isCurrent
            ? [styles.timelineDot, styles.timelineDotCurrent, { borderColor: accentColor, backgroundColor: accentColor }]
            : isCompleted
                ? [styles.timelineDot, { borderColor: COLORS.textSecondary, backgroundColor: COLORS.textSecondary }]
                : [styles.timelineDot, { borderColor: accentColor }];

        const lineColor = isCompleted ? COLORS.textSecondary : accentColor;

        // Feature 2: Compute walking direction
        const walkDirection = (!isTransit && item.startLocation && item.endLocation && item.durationValue > 60)
            ? calculateCardinalDirection(item.startLocation.lat, item.startLocation.lng, item.endLocation.lat, item.endLocation.lng)
            : null;

        return (
            <View style={[
                styles.stepContainer,
                { paddingVertical: scaleSpacing(SPACING.md) },
                isCurrent && styles.currentStepHighlight,
            ]}>
                <View style={styles.timelineContainer}>
                    <View style={dotStyle} />
                    {index !== routeData.steps.length - 1 ? (
                        <View style={[styles.timelineLine, { backgroundColor: lineColor }]} />
                    ) : null}
                </View>

                <View style={styles.instructionContainer}>
                    {isCurrent && (
                        <View style={styles.youAreHereBadge}>
                            <Text style={styles.youAreHereText}>YOU ARE HERE</Text>
                        </View>
                    )}
                    {isTransit ? (
                        <>
                            <View style={[styles.badge, { backgroundColor: accentColor }]}>
                                <Text style={styles.badgeText}>{item.transitDetails?.lineName}</Text>
                            </View>
                            <Text style={[styles.instructionTitle, { fontSize: scaleFont(FONT_SIZES.lg), opacity: isCompleted ? 0.5 : 1 }]}>
                                Board at {item.transitDetails?.departureStop}
                            </Text>
                            <Text style={[styles.detailText, { fontSize: scaleFont(FONT_SIZES.md), opacity: isCompleted ? 0.5 : 1 }]}>
                                Towards {item.transitDetails?.arrivalStop}
                            </Text>
                            <Text style={[styles.subDetailText, { fontSize: scaleFont(FONT_SIZES.sm) }]}>
                                {isCurrent && stopsRemaining !== null
                                    ? `${stopsRemaining} stop${stopsRemaining !== 1 ? 's' : ''} left`
                                    : `${item.transitDetails?.numStops} stops • ${item.durationText}`}
                            </Text>
                            {/* Feature 5: Dynamic entrance hints */}
                            {item.transitDetails?.departureStop.includes('Station') ? (() => {
                                const hint = getEntranceHint(item.transitDetails!.departureStop, index);
                                return hint ? (
                                    <View style={[styles.entranceHint, { marginTop: scaleSpacing(SPACING.sm) }]}>
                                        <Text style={{ fontSize: scaleFont(FONT_SIZES.sm), color: COLORS.surface }}>
                                            Entrance: {hint}
                                        </Text>
                                    </View>
                                ) : null;
                            })() : null}
                        </>
                    ) : (
                        <>
                            {/* Feature 2: Directional walking instructions */}
                            <Text style={[styles.instructionTitle, { fontSize: scaleFont(FONT_SIZES.lg), opacity: isCompleted ? 0.5 : 1 }]}>
                                {walkDirection
                                    ? `Walk ${walkDirection} to ${item.htmlInstructions.replace(/<[^>]+>/g, '').replace(/^Walk to\s*/i, '').trim()}`
                                    : item.htmlInstructions.replace(/<[^>]+>/g, '')}
                            </Text>
                            <Text style={[styles.detailText, { fontSize: scaleFont(FONT_SIZES.md), opacity: isCompleted ? 0.5 : 1 }]}>
                                {item.distanceText} • {item.durationText}
                            </Text>
                        </>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, isAccessibilityMode && styles.a11yBackground]}>
            {/* Header with tracking status */}
            <View style={[styles.header, { padding: scaleSpacing(SPACING.md), flexDirection: 'column' }]}>
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('Home')} accessibilityRole="button">
                        <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.textSecondary }}>End Route</Text>
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {isTracking && <View style={styles.trackingDot} />}
                            <Text style={[styles.headerTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>
                                {isTracking ? 'Tracking Active' : 'Starting...'}
                            </Text>
                            {isOffline && <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Cached Route</Text>}
                        </View>
                    </View>
                    <TouchableOpacity onPress={handleShareETA} accessibilityRole="button" accessibilityLabel="Share ETA">
                        <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.line1, fontWeight: 'bold' }}>Share</Text>
                    </TouchableOpacity>
                </View>

                {/* Arrival time banner */}
                <View style={styles.arrivalBanner}>
                    <Text style={[styles.arrivalLabel, { fontSize: scaleFont(FONT_SIZES.sm) }]}>
                        Arrive by
                    </Text>
                    <Text style={[styles.arrivalTime, { fontSize: scaleFont(FONT_SIZES.xl) }]}>
                        {arrivalTime}
                    </Text>
                    <Text style={[styles.arrivalDuration, { fontSize: scaleFont(FONT_SIZES.sm) }]}>
                        {routeData.totalTimeText} remaining
                    </Text>
                </View>

                {serviceAlerts.length > 0 && (
                    <View style={styles.alertBanner}>
                        <Text style={styles.alertText}>
                            ⚠ {serviceAlerts[0].headerText}
                        </Text>
                    </View>
                )}

                {routeData.coordinates && routeData.coordinates.length > 0 && Platform.OS !== 'web' ? (
                    <TouchableOpacity
                        style={{ marginTop: scaleSpacing(SPACING.sm), paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#FAFAFA', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}
                        onPress={() => setIsMapVisible(true)}
                    >
                        <Text style={{ fontSize: scaleFont(FONT_SIZES.md), color: COLORS.text, fontWeight: 'bold', textAlign: 'center' }}>View Map</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Distraction-Free List */}
            <FlatList
                data={routeData.steps}
                keyExtractor={(_, index) => index.toString()}
                renderItem={renderStep}
                contentContainerStyle={{ padding: scaleSpacing(SPACING.lg), paddingBottom: scaleSpacing(SPACING.xxl * 2) }}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={() => (
                    <View style={[styles.footerContainer, { marginTop: scaleSpacing(SPACING.xl) }]}>
                        <TouchableOpacity
                            style={styles.returnTripBtn}
                            onPress={handleSaveReturnTrip}
                            accessibilityRole="button"
                            accessibilityLabel="Save return trip to shortcuts"
                        >
                            <Text style={{ color: COLORS.background, fontWeight: 'bold', fontSize: scaleFont(FONT_SIZES.md) }}>
                                💾 Save Return Trip
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            />

            {/* Map Modal — centered on user, showing full route */}
            {Platform.OS !== 'web' ? (
                <Modal visible={isMapVisible} animationType="slide" presentationStyle="pageSheet">
                    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
                        <View style={[styles.headerModal, { padding: scaleSpacing(SPACING.md) }]}>
                            <TouchableOpacity onPress={() => setIsMapVisible(false)} accessibilityRole="button">
                                <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.textSecondary }}>Close</Text>
                            </TouchableOpacity>
                            <Text style={[styles.headerTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>
                                Your Route
                            </Text>
                            <View style={{ width: 50 }} />
                        </View>
                        <MapView
                            ref={mapRef}
                            style={{ flex: 1 }}
                            mapType="mutedStandard"
                            showsUserLocation={true}
                            followsUserLocation={true}
                            showsMyLocationButton={true}
                            customMapStyle={[
                                { featureType: "poi", stylers: [{ visibility: "off" }] },
                                { featureType: "transit", stylers: [{ visibility: "off" }] }
                            ]}
                            initialRegion={userLocation ? {
                                latitude: userLocation.latitude,
                                longitude: userLocation.longitude,
                                latitudeDelta: 0.02,
                                longitudeDelta: 0.02,
                            } : routeData.coordinates?.length ? {
                                latitude: routeData.coordinates[0].latitude,
                                longitude: routeData.coordinates[0].longitude,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            } : undefined}
                            onMapReady={() => {
                                // Fit map to show both user and entire route
                                if (routeData.coordinates && routeData.coordinates.length > 0) {
                                    const allCoords = [...routeData.coordinates];
                                    if (userLocation) {
                                        allCoords.push(userLocation);
                                    }
                                    mapRef.current?.fitToCoordinates(allCoords, {
                                        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                                        animated: true,
                                    });
                                }
                            }}
                        >
                            {routeData.coordinates && routeData.coordinates.length > 0 ? (
                                <>
                                    <Polyline
                                        coordinates={routeData.coordinates}
                                        strokeColor={COLORS.surface}
                                        strokeWidth={4}
                                    />
                                    {/* Destination marker */}
                                    <Marker
                                        coordinate={routeData.coordinates[routeData.coordinates.length - 1]}
                                        title="Destination"
                                        pinColor={COLORS.surface}
                                    />
                                </>
                            ) : null}
                        </MapView>
                    </SafeAreaView>
                </Modal>
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    a11yBackground: { backgroundColor: '#FAFAFA' },
    header: { alignItems: 'center', justifyContent: 'center', paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerModal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { fontWeight: 'bold', color: COLORS.text },
    stepContainer: { flexDirection: 'row', alignItems: 'flex-start' },
    timelineContainer: { alignItems: 'center', marginRight: SPACING.md, height: '100%' },
    timelineDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 4, backgroundColor: COLORS.background, zIndex: 1 },
    timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -16 },
    instructionContainer: { flex: 1 },
    badge: { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: 4, marginBottom: SPACING.xs },
    badgeText: { color: COLORS.background, fontWeight: 'bold', fontSize: 12 },
    instructionTitle: { fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
    detailText: { color: COLORS.textSecondary, marginBottom: 2 },
    subDetailText: { color: COLORS.textSecondary, fontStyle: 'italic' },
    entranceHint: { backgroundColor: '#E1F5FE', padding: SPACING.sm, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: COLORS.surface },
    footerContainer: { alignItems: 'center', paddingVertical: SPACING.lg },
    returnTripBtn: { backgroundColor: COLORS.text, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: 12 },
    // Tracking status
    trackingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.line2 },
    // Arrival time
    arrivalBanner: { alignItems: 'center', marginTop: SPACING.sm, paddingVertical: SPACING.xs },
    arrivalLabel: { color: COLORS.textSecondary },
    arrivalTime: { fontWeight: 'bold', color: COLORS.text },
    arrivalDuration: { color: COLORS.textSecondary, marginTop: 2 },
    // Current step
    currentStepHighlight: { backgroundColor: '#FFFDF0', borderRadius: 8, marginHorizontal: -SPACING.xs, paddingHorizontal: SPACING.xs },
    timelineDotCurrent: { width: 20, height: 20, borderRadius: 10, borderWidth: 5 },
    youAreHereBadge: { marginBottom: 4 },
    youAreHereText: { fontSize: 10, fontWeight: 'bold', color: COLORS.line1, letterSpacing: 1 },
    // Disruption alert
    alertBanner: { backgroundColor: '#FFF3E0', padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
    alertText: { fontSize: FONT_SIZES.sm, color: '#E65100', fontWeight: '600' },
});
