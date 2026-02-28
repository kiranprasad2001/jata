import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { getString, getBoolean, getObject } from '../utils/storage';
import { useNavigation } from '@react-navigation/native';
import { CustomLocation } from './SettingsScreen';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import * as Location from 'expo-location';
import axios from 'axios';
import { recordRouteSearch, getFrequentRoutes } from '../utils/routeHistory';
import { recordCommuteDeparture, getTodaysPatterns, getNextCommute, formatPatternTime, shortDestination, CommutePattern } from '../utils/commutePatterns';
import { fetchNearbyVehicles, NearbyVehicle } from '../services/NearbyDeparturesService';
import { findNearestStation, getCurrentHeadway, SubwayLine } from '../data/subwayData';
import { schedulePredictiveDeparture } from '../services/NotificationService';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || 'PLACEHOLDER_KEY';

interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
    const navigation = useNavigation<NavigationProp>();
    const [searchQuery, setSearchQuery] = useState('');
    const [homeStop, setHomeStop] = useState<string | undefined>(undefined);
    const [workStop, setWorkStop] = useState<string | undefined>(undefined);
    const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
    const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
    const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [frequentRoutes, setFrequentRoutes] = useState<{ destination: string; count: number }[]>([]);

    // Phase 4: Nearby vehicles and commute patterns
    const [nearbyVehicles, setNearbyVehicles] = useState<NearbyVehicle[]>([]);
    const [commutePatterns, setCommutePatterns] = useState<CommutePattern[]>([]);
    const [nearestSubway, setNearestSubway] = useState<{ line: SubwayLine; stationName: string; headway: number; period: string; distanceMeters: number } | null>(null);
    const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
    const nearbyInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        try {
            const response = await axios.get(
                'https://maps.googleapis.com/maps/api/place/autocomplete/json',
                {
                    params: {
                        input: query,
                        key: GOOGLE_PLACES_API_KEY,
                        components: 'country:ca',
                        location: '43.6532,-79.3832',
                        radius: 50000,
                        types: 'establishment|geocode',
                    },
                }
            );
            if (response.data.status === 'OK') {
                setSuggestions(response.data.predictions.slice(0, 5));
            } else {
                console.warn(`[JATA] Places API: ${response.data.status} — ${response.data.error_message || 'No details'}`);
                setSuggestions([]);
            }
        } catch (err) {
            console.warn('[JATA] Places API request failed:', err);
            setSuggestions([]);
        }
    }, []);

    const handleQueryChange = (text: string) => {
        setSearchQuery(text);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => fetchSuggestions(text), 300);
    };

    const handleSelectSuggestion = async (prediction: PlacePrediction) => {
        setSuggestions([]);
        setSearchQuery(prediction.structured_formatting.main_text);
        await recordRouteSearch(prediction.description);
        await recordCommuteDeparture(prediction.description);
        const originStr = await getCurrentLocationString();
        navigation.navigate('RouteOptions', {
            origin: originStr,
            destination: prediction.description,
        });
    };

    // Phase 4: Fetch nearby vehicles and subway info using user's location
    const refreshNearby = useCallback(async (lat: number, lon: number) => {
        try {
            const vehicles = await fetchNearbyVehicles(lat, lon);
            setNearbyVehicles(vehicles);
        } catch {
            // Silently fail — nearby section just won't show
        }

        // Find nearest subway station for offline info
        const nearest = findNearestStation(lat, lon);
        if (nearest && nearest.distanceMeters < 2000) {
            const { minutes, period } = getCurrentHeadway(nearest.line);
            setNearestSubway({
                line: nearest.line,
                stationName: nearest.station.name,
                headway: minutes,
                period,
                distanceMeters: nearest.distanceMeters,
            });
        } else {
            setNearestSubway(null);
        }
    }, []);

    // Load saved stops, settings, nearby data on focus
    useEffect(() => {
        const loadSettings = async () => {
            setHomeStop(await getString('home_stop'));
            setWorkStop(await getString('work_stop'));
            setCustomLocations((await getObject<CustomLocation[]>('custom_locations')) || []);
            setIsAccessibilityMode((await getBoolean('accessibility_mode')) ?? false);
            setFrequentRoutes(await getFrequentRoutes());
            setCommutePatterns(await getTodaysPatterns());

            // Phase 4: Schedule predictive departure notification for next commute
            const nextCommute = await getNextCommute();
            if (nextCommute) {
                const dest = nextCommute.destination.split(',')[0].trim();
                schedulePredictiveDeparture(dest, nextCommute.avgHour, nextCommute.avgMinute);
            }
        };

        const loadNearby = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                let location = await Location.getLastKnownPositionAsync({});
                if (!location) {
                    location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                }

                const { latitude, longitude } = location.coords;
                setUserCoords({ lat: latitude, lon: longitude });
                refreshNearby(latitude, longitude);
            } catch (e) {
                console.warn('[JATA] Could not get location for nearby:', e);
            }
        };

        const unsubscribe = navigation.addListener('focus', () => {
            loadSettings();
            loadNearby();
        });

        // Initial load
        loadSettings();
        loadNearby();

        // Refresh nearby vehicles every 30 seconds
        nearbyInterval.current = setInterval(() => {
            if (userCoords) {
                refreshNearby(userCoords.lat, userCoords.lon);
            }
        }, 30000);

        return () => {
            unsubscribe();
            if (nearbyInterval.current) clearInterval(nearbyInterval.current);
        };
    }, [navigation, refreshNearby]);

    // Keep refreshing when userCoords changes
    useEffect(() => {
        if (nearbyInterval.current) clearInterval(nearbyInterval.current);
        nearbyInterval.current = setInterval(() => {
            if (userCoords) {
                refreshNearby(userCoords.lat, userCoords.lon);
            }
        }, 30000);
        return () => {
            if (nearbyInterval.current) clearInterval(nearbyInterval.current);
        };
    }, [userCoords, refreshNearby]);

    const scaleFont = (size: number) => isAccessibilityMode ? size * 1.2 : size;
    const scaleSpacing = (size: number) => isAccessibilityMode ? size * 1.5 : size;

    const getCurrentLocationString = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                return 'Union Station, Toronto';
            }
            let location = await Location.getLastKnownPositionAsync({});
            if (!location) {
                location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }
            return `${location.coords.latitude},${location.coords.longitude}`;
        } catch (e) {
            console.warn("Could not get location", e);
            return 'Union Station, Toronto';
        }
    };

    const handleSearch = async () => {
        if (searchQuery.trim()) {
            await recordRouteSearch(searchQuery.trim());
            await recordCommuteDeparture(searchQuery.trim());
            const originStr = await getCurrentLocationString();
            navigation.navigate('RouteOptions', {
                origin: originStr,
                destination: searchQuery.trim()
            });
        }
    };

    const handleShortcut = async (type: 'home' | 'work' | 'custom', customStop?: string) => {
        let stop = undefined;
        if (type === 'home') stop = homeStop;
        else if (type === 'work') stop = workStop;
        else if (type === 'custom') stop = customStop;

        if (stop) {
            const originStr = await getCurrentLocationString();
            navigation.navigate('RouteOptions', {
                origin: originStr,
                destination: stop
            });
        } else {
            if (type !== 'custom') {
                alert(`Please set your ${type} stop first in Settings`);
            }
        }
    };

    // Show contextual info when search is empty
    const showContextual = suggestions.length === 0 && searchQuery.length === 0;

    return (
        <SafeAreaView style={[styles.container, isAccessibilityMode && styles.a11yBackground]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.headerContainer}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Settings')}
                        style={styles.settingsButton}
                        accessibilityLabel="Settings"
                        accessibilityRole="button"
                    >
                        <Text style={{ fontSize: scaleFont(FONT_SIZES.xl) }}>⚙️</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollContent}
                    contentContainerStyle={styles.mainContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <TextInput
                        style={[
                            styles.searchInput,
                            {
                                fontSize: scaleFont(FONT_SIZES.xxl),
                                padding: scaleSpacing(SPACING.md),
                                marginBottom: suggestions.length > 0 ? SPACING.xs : scaleSpacing(SPACING.lg),
                                borderBottomColor: isAccessibilityMode ? COLORS.text : COLORS.border
                            }
                        ]}
                        placeholder="Where to?"
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={handleQueryChange}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoFocus
                        accessibilityLabel="Search destination"
                        accessibilityHint="Enter the address or station you want to go to"
                    />

                    {suggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            {suggestions.map((item) => (
                                <TouchableOpacity
                                    key={item.place_id}
                                    style={styles.suggestionRow}
                                    onPress={() => handleSelectSuggestion(item)}
                                    accessibilityRole="button"
                                    accessibilityLabel={item.description}
                                >
                                    <Text style={[styles.suggestionMain, { fontSize: scaleFont(FONT_SIZES.md) }]} numberOfLines={1}>
                                        {item.structured_formatting.main_text}
                                    </Text>
                                    <Text style={[styles.suggestionSecondary, { fontSize: scaleFont(FONT_SIZES.sm) }]} numberOfLines={1}>
                                        {item.structured_formatting.secondary_text}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Phase 4: Commute pattern nudge — "Leave at 8:15 for Union Station" */}
                    {showContextual && commutePatterns.length > 0 && (
                        <TouchableOpacity
                            style={styles.commuteNudge}
                            onPress={() => handleShortcut('custom', commutePatterns[0].destination)}
                            accessibilityRole="button"
                            accessibilityLabel={`Start your commute to ${shortDestination(commutePatterns[0].destination)}`}
                        >
                            <Text style={[styles.commuteNudgeText, { fontSize: scaleFont(FONT_SIZES.md) }]}>
                                Your {formatPatternTime(commutePatterns[0])} commute
                            </Text>
                            <Text style={[styles.commuteNudgeDest, { fontSize: scaleFont(FONT_SIZES.sm) }]} numberOfLines={1}>
                                To {shortDestination(commutePatterns[0].destination)}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Phase 4: Nearby vehicles — "504 King — 2 min" */}
                    {showContextual && nearbyVehicles.length > 0 && (
                        <View style={styles.nearbyContainer}>
                            <Text style={[styles.nearbyLabel, { fontSize: scaleFont(FONT_SIZES.sm) }]}>Nearby</Text>
                            {nearbyVehicles.map((v, idx) => (
                                <View key={v.id || idx} style={styles.nearbyRow}>
                                    <View style={styles.nearbyRouteTag}>
                                        <Text style={[styles.nearbyRouteText, { fontSize: scaleFont(FONT_SIZES.sm) }]}>
                                            {v.routeName}
                                        </Text>
                                    </View>
                                    <Text style={[
                                        styles.nearbyEta,
                                        { fontSize: scaleFont(FONT_SIZES.md) },
                                        v.isRealtime ? styles.nearbyEtaRealtime : styles.nearbyEtaEstimate,
                                    ]}>
                                        {v.estimatedArrivalMins <= 1
                                            ? 'Now'
                                            : v.isRealtime
                                                ? `${v.estimatedArrivalMins} min`
                                                : `~${v.estimatedArrivalMins} min`}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Phase 4: Nearest subway info (offline-capable) */}
                    {showContextual && nearestSubway && nearestSubway.headway > 0 && (
                        <View style={[styles.subwayInfoContainer, { borderLeftColor: nearestSubway.line.color }]}>
                            <Text style={[styles.subwayInfoLine, { fontSize: scaleFont(FONT_SIZES.sm) }]}>
                                {nearestSubway.line.name}
                            </Text>
                            <Text style={[styles.subwayInfoDetail, { fontSize: scaleFont(FONT_SIZES.sm) }]}>
                                Every {nearestSubway.headway} min · {nearestSubway.stationName} ({Math.round(nearestSubway.distanceMeters)}m)
                            </Text>
                        </View>
                    )}

                    {/* Frequent routes chips */}
                    {showContextual && frequentRoutes.length > 0 && (
                        <View style={styles.frequentContainer}>
                            <Text style={[styles.frequentLabel, { fontSize: scaleFont(FONT_SIZES.sm) }]}>Frequent</Text>
                            <View style={styles.frequentChips}>
                                {frequentRoutes.map((fr, idx) => {
                                    const shortName = fr.destination.split(',')[0].trim();
                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            style={styles.frequentChip}
                                            onPress={() => handleShortcut('custom', fr.destination)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Go to ${shortName}`}
                                        >
                                            <Text style={[styles.frequentChipText, { fontSize: scaleFont(FONT_SIZES.sm) }]} numberOfLines={1}>
                                                {shortName}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    <View style={[styles.shortcutsContainer, { marginTop: scaleSpacing(SPACING.lg) }]}>
                        <TouchableOpacity
                            style={[
                                styles.shortcutButton,
                                {
                                    padding: scaleSpacing(SPACING.md),
                                    borderColor: COLORS.line1,
                                    backgroundColor: homeStop ? '#FFFDF0' : 'transparent'
                                }
                            ]}
                            onPress={() => handleShortcut('home')}
                            accessibilityLabel={homeStop ? `Go Home to ${homeStop}` : "Set Home location"}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.shortcutTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>Home</Text>
                            <Text style={[styles.shortcutSubtitle, { fontSize: scaleFont(FONT_SIZES.sm) }]} numberOfLines={1}>
                                {homeStop || 'Tap to set'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.shortcutButton,
                                {
                                    padding: scaleSpacing(SPACING.md),
                                    borderColor: COLORS.line2,
                                    backgroundColor: workStop ? '#F0FFF5' : 'transparent'
                                }
                            ]}
                            onPress={() => handleShortcut('work')}
                            accessibilityLabel={workStop ? `Go to Work at ${workStop}` : "Set Work location"}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.shortcutTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>Work</Text>
                            <Text style={[styles.shortcutSubtitle, { fontSize: scaleFont(FONT_SIZES.sm) }]} numberOfLines={1}>
                                {workStop || 'Tap to set'}
                            </Text>
                        </TouchableOpacity>

                        {customLocations.map((loc) => (
                            <TouchableOpacity
                                key={loc.id}
                                style={[
                                    styles.shortcutButton,
                                    {
                                        padding: scaleSpacing(SPACING.md),
                                        borderColor: COLORS.surface,
                                        backgroundColor: '#F0F8FF'
                                    }
                                ]}
                                onPress={() => handleShortcut('custom', loc.stop)}
                                accessibilityLabel={`Go to ${loc.label} at ${loc.stop}`}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.shortcutTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>{loc.label}</Text>
                                <Text style={[styles.shortcutSubtitle, { fontSize: scaleFont(FONT_SIZES.sm) }]} numberOfLines={1}>
                                    {loc.stop}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    a11yBackground: {
        backgroundColor: '#FAFAFA',
    },
    keyboardView: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.sm,
    },
    settingsButton: {
        padding: SPACING.sm,
    },
    scrollContent: {
        flex: 1,
    },
    mainContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxl,
    },
    searchInput: {
        fontWeight: '600',
        color: COLORS.text,
        borderBottomWidth: 2,
    },
    shortcutsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: SPACING.md,
    },
    shortcutButton: {
        width: '47%',
        aspectRatio: 2,
        borderWidth: 2,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    shortcutTitle: {
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    shortcutSubtitle: {
        color: COLORS.textSecondary,
    },
    suggestionsContainer: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        marginBottom: SPACING.lg,
        overflow: 'hidden',
    },
    suggestionRow: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    suggestionMain: {
        fontWeight: '600',
        color: COLORS.text,
    },
    suggestionSecondary: {
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    frequentContainer: {
        marginBottom: SPACING.md,
    },
    frequentLabel: {
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    frequentChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    frequentChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: '#FAFAFA',
    },
    frequentChipText: {
        color: COLORS.text,
        fontWeight: '500',
    },
    // Phase 4: Nearby vehicles
    nearbyContainer: {
        marginBottom: SPACING.md,
    },
    nearbyLabel: {
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    nearbyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.xs + 2,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    nearbyRouteTag: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: 8,
    },
    nearbyRouteText: {
        fontWeight: '600',
        color: COLORS.text,
    },
    nearbyEta: {
        fontWeight: 'bold',
    },
    nearbyEtaRealtime: {
        color: COLORS.line2, // Green — real GTFS-RT prediction
    },
    nearbyEtaEstimate: {
        color: COLORS.textSecondary, // Gray — distance-based estimate
        fontWeight: '500',
    },
    // Phase 4: Commute nudge
    commuteNudge: {
        backgroundColor: '#FFFDF0',
        borderWidth: 1,
        borderColor: COLORS.line1,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    commuteNudgeText: {
        fontWeight: '600',
        color: COLORS.text,
    },
    commuteNudgeDest: {
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    // Phase 4: Subway info
    subwayInfoContainer: {
        borderLeftWidth: 4,
        paddingLeft: SPACING.sm,
        paddingVertical: SPACING.xs,
        marginBottom: SPACING.md,
    },
    subwayInfoLine: {
        fontWeight: '600',
        color: COLORS.text,
    },
    subwayInfoDetail: {
        color: COLORS.textSecondary,
        marginTop: 2,
    },
});
