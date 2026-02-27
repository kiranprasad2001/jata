import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, AppState, AppStateStatus, Share, Modal, Platform } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ActiveTransitScreenProps } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { getBoolean, saveToStorage, getString } from '../utils/storage';
import { RouteStep } from '../services/GoogleDirectionsService';
import * as Location from 'expo-location';
import { LOCATION_SETTINGS, calculateDistanceMeters } from '../utils/LocationSettings';
import { requestNotificationPermissions, triggerApproachingStopAlert } from '../services/NotificationService';

export default function ActiveTransitScreen() {
    const route = useRoute<ActiveTransitScreenProps['route']>();
    const navigation = useNavigation<ActiveTransitScreenProps['navigation']>();
    const activeRoute = route.params.route;

    const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const hasAlertedDestination = useRef(false);

    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;

        const init = async () => {
            setIsAccessibilityMode(await getBoolean('accessibility_mode') ?? false);
            await saveToStorage('active_route', activeRoute);

            // Request location and notification permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Permission to access location was denied');
                return;
            }
            await requestNotificationPermissions();

            // In a full production app we would use startLocationUpdatesAsync for background execution.
            // For Expo Go compatibility and simplicity, we use watchPositionAsync (foreground tracking).
            setIsTracking(true);
            locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: LOCATION_SETTINGS.TRACKING_OPTIONS.timeInterval,
                    distanceInterval: LOCATION_SETTINGS.TRACKING_OPTIONS.distanceInterval,
                },
                (location) => {
                    console.log(`[JATA] Location update: ${location.coords.latitude}, ${location.coords.longitude}`);

                    // Use the last polyline coordinate as the destination point.
                    // Google Directions doesn't return individual stop coordinates in transit mode,
                    // so this alerts the user when they're approaching the final destination.
                    if (hasAlertedDestination.current || !activeRoute.coordinates?.length) return;

                    const dest = activeRoute.coordinates[activeRoute.coordinates.length - 1];
                    const distance = calculateDistanceMeters(
                        location.coords.latitude,
                        location.coords.longitude,
                        dest.latitude,
                        dest.longitude
                    );

                    if (distance < LOCATION_SETTINGS.TRIGGER_DISTANCE_METERS) {
                        hasAlertedDestination.current = true;
                        const lastStep = activeRoute.steps[activeRoute.steps.length - 1];
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
    }, []);

    const handleShareETA = async () => {
        try {
            // Extract a cleaner destination string (e.g., "Walk to Union Station" -> "Union Station")
            const rawDestination = activeRoute.steps[activeRoute.steps.length - 1].htmlInstructions.replace(/<[^>]+>/g, '');
            const cleanDestination = rawDestination.replace(/^Walk to\s*/i, '').trim();

            await Share.share({
                message: `I'm currently on the TTC to ${cleanDestination}. I should be there in about ${activeRoute.totalTimeText}.`,
            });
        } catch (error: any) {
            console.error('Error sharing ETA:', error.message);
        }
    };

    const handleSaveReturnTrip = async () => {
        alert("Return trip saved to shortcuts! (Demo Feature)");
    };

    const scaleFont = (size: number) => isAccessibilityMode ? size * 1.2 : size;
    const scaleSpacing = (size: number) => isAccessibilityMode ? size * 1.5 : size;

    const renderStep = ({ item, index }: { item: RouteStep, index: number }) => {
        const isTransit = item.travelMode === 'TRANSIT' && item.transitDetails;

        let accentColor = COLORS.border;
        if (isTransit) {
            const type = item.transitDetails?.vehicleType;
            if (type?.includes('SUBWAY')) accentColor = COLORS.line1;
            if (item.transitDetails?.lineColor) accentColor = item.transitDetails.lineColor;
        }

        return (
            <View style={[styles.stepContainer, { paddingVertical: scaleSpacing(SPACING.md) }]}>
                {/* Timeline Line */}
                <View style={styles.timelineContainer}>
                    <View style={[styles.timelineDot, { borderColor: accentColor }]} />
                    {index !== activeRoute.steps.length - 1 ? (
                        <View style={[styles.timelineLine, { backgroundColor: accentColor }]} />
                    ) : null}
                </View>

                {/* Instruction Content */}
                <View style={styles.instructionContainer}>
                    {isTransit ? (
                        <>
                            <View style={[styles.badge, { backgroundColor: accentColor }]}>
                                <Text style={styles.badgeText}>{item.transitDetails?.lineName}</Text>
                            </View>
                            <Text style={[styles.instructionTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>
                                Board at {item.transitDetails?.departureStop}
                            </Text>
                            <Text style={[styles.detailText, { fontSize: scaleFont(FONT_SIZES.md) }]}>
                                Towards {item.transitDetails?.arrivalStop}
                            </Text>
                            <Text style={[styles.subDetailText, { fontSize: scaleFont(FONT_SIZES.sm) }]}>
                                {item.transitDetails?.numStops} stops • {item.durationText}
                            </Text>
                            {/* Mock Entrance integration */}
                            {item.transitDetails?.departureStop.includes('Station') ? (
                                <View style={[styles.entranceHint, { marginTop: scaleSpacing(SPACING.sm) }]}>
                                    <Text style={{ fontSize: scaleFont(FONT_SIZES.sm), color: COLORS.surface }}>
                                        💡 Suggested Entrance: Front St W via Path
                                    </Text>
                                </View>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <Text style={[styles.instructionTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>
                                {item.htmlInstructions.replace(/<[^>]+>/g, '')} {/* Strip HTML from Google */}
                            </Text>
                            <Text style={[styles.detailText, { fontSize: scaleFont(FONT_SIZES.md) }]}>
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
            {/* Minimalist Header */}
            <View style={[styles.header, { padding: scaleSpacing(SPACING.md), flexDirection: 'column' }]}>
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('Home')} accessibilityRole="button">
                        <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.textSecondary }}>End Route</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>
                        In Transit
                    </Text>
                    <TouchableOpacity onPress={handleShareETA} accessibilityRole="button" accessibilityLabel="Share ETA">
                        <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.line1, fontWeight: 'bold' }}>Share ETA</Text>
                    </TouchableOpacity>
                </View>

                {activeRoute.coordinates && activeRoute.coordinates.length > 0 && Platform.OS !== 'web' ? (
                    <TouchableOpacity
                        style={{ marginTop: scaleSpacing(SPACING.md), paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#FAFAFA', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}
                        onPress={() => setIsMapVisible(true)}
                    >
                        <Text style={{ fontSize: scaleFont(FONT_SIZES.md), color: COLORS.text, fontWeight: 'bold', textAlign: 'center' }}>🗺️ View Map (Overview)</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Distraction-Free List */}
            <FlatList
                data={activeRoute.steps}
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

            {/* The "Compromise" Map Modal */}
            {Platform.OS !== 'web' ? (
                <Modal visible={isMapVisible} animationType="slide" presentationStyle="pageSheet">
                    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
                        <View style={[styles.headerModal, { padding: scaleSpacing(SPACING.md) }]}>
                            <TouchableOpacity onPress={() => setIsMapVisible(false)} accessibilityRole="button">
                                <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.textSecondary }}>Close Map</Text>
                            </TouchableOpacity>
                            <Text style={[styles.headerTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>
                                Route Overview
                            </Text>
                            <View style={{ width: 75 }} />
                        </View>
                        <MapView
                            style={{ flex: 1 }}
                            mapType="mutedStandard"
                            showsUserLocation={true}
                            customMapStyle={[
                                { featureType: "poi", stylers: [{ visibility: "off" }] },
                                { featureType: "transit", stylers: [{ visibility: "off" }] }
                            ]}
                            initialRegion={activeRoute.coordinates?.length ? {
                                latitude: activeRoute.coordinates[0].latitude,
                                longitude: activeRoute.coordinates[0].longitude,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            } : undefined}
                        >
                            {activeRoute.coordinates && activeRoute.coordinates.length > 0 ? (
                                <Polyline
                                    coordinates={activeRoute.coordinates}
                                    strokeColor={COLORS.surface}
                                    strokeWidth={4}
                                />
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
    returnTripBtn: { backgroundColor: COLORS.text, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: 12 }
});
