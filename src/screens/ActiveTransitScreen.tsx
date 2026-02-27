import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, AppState, AppStateStatus, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ActiveTransitScreenProps } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { getBoolean, saveToStorage, getString } from '../utils/storage';
import { RouteStep } from '../services/GoogleDirectionsService';
import * as Location from 'expo-location';
import { LOCATION_SETTINGS, calculateDistanceMeters } from '../utils/LocationSettings';
import { triggerApproachingStopAlert } from '../services/NotificationService';

export default function ActiveTransitScreen() {
    const route = useRoute<ActiveTransitScreenProps['route']>();
    const navigation = useNavigation<ActiveTransitScreenProps['navigation']>();
    const activeRoute = route.params.route;

    const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
    const [isTracking, setIsTracking] = useState(false);

    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;

        const init = async () => {
            setIsAccessibilityMode(await getBoolean('accessibility_mode') ?? false);
            await saveToStorage('active_route', activeRoute);

            // Request location permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Permission to access location was denied');
                return;
            }

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
                    // Check logic against the next stop
                    // Note: Google Directions API doesn't return stop Lat/Longs reliably in transit mode,
                    // so in a real app, you would cross-reference `departureStop` with a GTFS db.
                    // For demonstration, we simply log the tracking heartbeat.
                    console.log(`[JATA] Location update: ${location.coords.latitude}, ${location.coords.longitude}`);

                    // Demo: If we had stop coordinates, we would do:
                    // const distance = calculateDistanceMeters(location.coords.latitude, location.coords.longitude, stopLat, stopLon);
                    // if (distance < LOCATION_SETTINGS.TRIGGER_DISTANCE_METERS) { triggerApproachingStopAlert(...); }
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
                    {index !== activeRoute.steps.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: accentColor }]} />
                    )}
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
                            {item.transitDetails?.departureStop.includes('Station') && (
                                <View style={[styles.entranceHint, { marginTop: scaleSpacing(SPACING.sm) }]}>
                                    <Text style={{ fontSize: scaleFont(FONT_SIZES.sm), color: COLORS.surface }}>
                                        💡 Suggested Entrance: Front St W via Path
                                    </Text>
                                </View>
                            )}
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
            <View style={[styles.header, { padding: scaleSpacing(SPACING.md) }]}>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    a11yBackground: { backgroundColor: '#FAFAFA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { fontWeight: 'bold', color: COLORS.text },
    stepContainer: { flexDirection: 'row', alignItems: 'flex-start' },
    timelineContainer: { alignItems: 'center', marginRight: SPACING.md, height: '100%' },
    timelineDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 4, backgroundColor: COLORS.background, zIndex: 1 },
    timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -16 }, // Native overlap hack
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
