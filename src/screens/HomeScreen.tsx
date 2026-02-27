import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { getString, getBoolean, getObject } from '../utils/storage';
import { useNavigation } from '@react-navigation/native';
import { CustomLocation } from './SettingsScreen';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import * as Location from 'expo-location';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
    const navigation = useNavigation<NavigationProp>();
    const [searchQuery, setSearchQuery] = useState('');
    const [homeStop, setHomeStop] = useState<string | undefined>(undefined);
    const [workStop, setWorkStop] = useState<string | undefined>(undefined);
    const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
    const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);

    // Load saved stops and settings on focus
    useEffect(() => {
        const loadSettings = async () => {
            setHomeStop(await getString('home_stop'));
            setWorkStop(await getString('work_stop'));
            setCustomLocations((await getObject<CustomLocation[]>('custom_locations')) || []);
            setIsAccessibilityMode((await getBoolean('accessibility_mode')) ?? false);
        };

        const unsubscribe = navigation.addListener('focus', () => {
            loadSettings();
        });

        // Initial load
        loadSettings();

        return unsubscribe;
    }, [navigation]);

    const scaleFont = (size: number) => isAccessibilityMode ? size * 1.2 : size;
    const scaleSpacing = (size: number) => isAccessibilityMode ? size * 1.5 : size;

    const getCurrentLocationString = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                return 'Union Station, Toronto'; // Fallback to transit hub if denied
            }
            let location = await Location.getLastKnownPositionAsync({});
            if (!location) {
                location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }
            return `${location.coords.latitude},${location.coords.longitude}`;
        } catch (e) {
            console.warn("Could not get location", e);
            return 'Union Station, Toronto'; // Fallback
        }
    };

    const handleSearch = async () => {
        if (searchQuery.trim()) {
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

                <View style={styles.mainContent}>
                    <TextInput
                        style={[
                            styles.searchInput,
                            {
                                fontSize: scaleFont(FONT_SIZES.xxl),
                                padding: scaleSpacing(SPACING.md),
                                marginBottom: scaleSpacing(SPACING.xl),
                                borderBottomColor: isAccessibilityMode ? COLORS.text : COLORS.border
                            }
                        ]}
                        placeholder="Where to?"
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoFocus
                        accessibilityLabel="Search destination"
                        accessibilityHint="Enter the address or station you want to go to"
                    />

                    <View style={[styles.shortcutsContainer, { marginTop: scaleSpacing(SPACING.xl) }]}>
                        <TouchableOpacity
                            style={[
                                styles.shortcutButton,
                                {
                                    padding: scaleSpacing(SPACING.md),
                                    borderColor: COLORS.line1, // TTC Yellow accent
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
                                    borderColor: COLORS.line2, // TTC Green accent
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

                        {/* Render all custom locations */}
                        {customLocations.map((loc, idx) => (
                            <TouchableOpacity
                                key={loc.id}
                                style={[
                                    styles.shortcutButton,
                                    {
                                        padding: scaleSpacing(SPACING.md),
                                        borderColor: COLORS.surface, // Blue accent
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
                </View>
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
        backgroundColor: '#FAFAFA', // Slightly varied background for high contrast mode
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
    mainContent: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
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
});
