import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { getBoolean, saveToStorage, getString, getObject } from '../utils/storage';
import { useNavigation } from '@react-navigation/native';

export interface CustomLocation {
    id: string;
    label: string;
    stop: string;
}

export default function SettingsScreen() {
    const navigation = useNavigation();
    const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
    const [homeStop, setHomeStop] = useState('');
    const [workStop, setWorkStop] = useState('');
    const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);

    // New custom location UI state
    const [newLabel, setNewLabel] = useState('');
    const [newStop, setNewStop] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            setIsAccessibilityMode((await getBoolean('accessibility_mode')) ?? false);
            setHomeStop((await getString('home_stop')) || '');
            setWorkStop((await getString('work_stop')) || '');
            setCustomLocations((await getObject<CustomLocation[]>('custom_locations')) || []);
        };
        loadSettings();
    }, []);

    const scaleFont = (size: number) => isAccessibilityMode ? size * 1.2 : size;
    const scaleSpacing = (size: number) => isAccessibilityMode ? size * 1.5 : size;

    const toggleAccessibility = async (value: boolean) => {
        setIsAccessibilityMode(value);
        await saveToStorage('accessibility_mode', value);
    };

    const handleSaveHome = async (val: string) => {
        setHomeStop(val);
        await saveToStorage('home_stop', val);
    };

    const handleSaveWork = async (val: string) => {
        setWorkStop(val);
        await saveToStorage('work_stop', val);
    };

    const handleAddCustomLocation = async () => {
        if (!newLabel.trim() || !newStop.trim()) {
            Alert.alert('Missing Info', 'Please provide both a label and a destination/stop.');
            return;
        }

        const newLoc: CustomLocation = {
            id: Date.now().toString(),
            label: newLabel.trim(),
            stop: newStop.trim()
        };

        const updated = [...customLocations, newLoc];
        setCustomLocations(updated);
        await saveToStorage('custom_locations', updated);

        // Reset form
        setNewLabel('');
        setNewStop('');
    };

    const handleDeleteCustomLocation = async (id: string) => {
        const updated = customLocations.filter(loc => loc.id !== id);
        setCustomLocations(updated);
        await saveToStorage('custom_locations', updated);
    };

    return (
        <SafeAreaView style={[styles.container, isAccessibilityMode && styles.a11yBackground]}>
            <View style={[styles.header, { padding: scaleSpacing(SPACING.md), paddingBottom: scaleSpacing(SPACING.sm) }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    style={styles.backButton}
                >
                    <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.line1 }}>◀ Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: scaleFont(FONT_SIZES.xl) }]}>Settings</Text>
                <View style={{ width: 60 }} /> {/* Spacer for centering */}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ padding: scaleSpacing(SPACING.xl), paddingBottom: scaleSpacing(SPACING.xxl) }} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>Preferences</Text>
                    <View style={[styles.settingRow, { paddingVertical: scaleSpacing(SPACING.md) }]}>
                        <Text style={[styles.settingLabel, { fontSize: scaleFont(FONT_SIZES.md) }]}>Accessibility Mode</Text>
                        <Switch
                            value={isAccessibilityMode}
                            onValueChange={toggleAccessibility}
                            trackColor={{ false: COLORS.border, true: COLORS.line2 }}
                            accessibilityLabel="Toggle Accessibility Mode"
                            accessibilityHint="Increases font sizes, padding, and contrast"
                        />
                    </View>
                </View>

                <View style={[styles.section, { marginTop: scaleSpacing(SPACING.xl) }]}>
                    <Text style={[styles.sectionTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]}>Saved Locations</Text>

                    <View style={[styles.inputGroup, { marginTop: scaleSpacing(SPACING.md) }]}>
                        <Text style={[styles.inputLabel, { fontSize: scaleFont(FONT_SIZES.md) }]}>Home</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    fontSize: scaleFont(FONT_SIZES.md),
                                    padding: scaleSpacing(SPACING.sm),
                                    borderColor: isAccessibilityMode ? COLORS.text : COLORS.border
                                }
                            ]}
                            value={homeStop}
                            onChangeText={setHomeStop}
                            onEndEditing={() => handleSaveHome(homeStop)}
                            placeholder="e.g. Union Station"
                            placeholderTextColor={COLORS.textSecondary}
                            accessibilityLabel="Home Location"
                        />
                    </View>

                    <View style={[styles.inputGroup, { marginTop: scaleSpacing(SPACING.md) }]}>
                        <Text style={[styles.inputLabel, { fontSize: scaleFont(FONT_SIZES.md) }]}>Work</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    fontSize: scaleFont(FONT_SIZES.md),
                                    padding: scaleSpacing(SPACING.sm),
                                    borderColor: isAccessibilityMode ? COLORS.text : COLORS.border
                                }
                            ]}
                            value={workStop}
                            onChangeText={setWorkStop}
                            onEndEditing={() => handleSaveWork(workStop)}
                            placeholder="e.g. King Station"
                            placeholderTextColor={COLORS.textSecondary}
                            accessibilityLabel="Work Location"
                        />
                    </View>

                    {/* Custom Locations List */}
                    {customLocations.length > 0 && (
                        <View style={{ marginTop: scaleSpacing(SPACING.lg) }}>
                            <Text style={[styles.sectionSubtitle, { fontSize: scaleFont(FONT_SIZES.md) }]}>Other Saved Locations</Text>
                            {customLocations.map((loc) => (
                                <View key={loc.id} style={[styles.customLocationRow, { paddingVertical: scaleSpacing(SPACING.sm), borderBottomColor: COLORS.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: scaleFont(FONT_SIZES.md), color: COLORS.text }}>{loc.label}</Text>
                                        <Text style={{ fontSize: scaleFont(FONT_SIZES.sm), color: COLORS.textSecondary }}>{loc.stop}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteCustomLocation(loc.id)}
                                        accessibilityLabel={`Delete ${loc.label}`}
                                        accessibilityRole="button"
                                        style={styles.deleteBtn}
                                    >
                                        <Text style={{ color: COLORS.line1, fontWeight: 'bold', fontSize: scaleFont(FONT_SIZES.md) }}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Add Custom Location Form */}
                    <View style={[styles.addCustomContainer, { marginTop: scaleSpacing(SPACING.xl), padding: scaleSpacing(SPACING.md), borderColor: COLORS.border }]}>
                        <Text style={[styles.sectionSubtitle, { fontSize: scaleFont(FONT_SIZES.md), marginBottom: scaleSpacing(SPACING.sm) }]}>Add Custom Shortcut</Text>
                        <TextInput
                            style={[styles.input, { fontSize: scaleFont(FONT_SIZES.md), padding: scaleSpacing(SPACING.sm), borderColor: isAccessibilityMode ? COLORS.text : COLORS.border, marginBottom: scaleSpacing(SPACING.sm) }]}
                            value={newLabel}
                            onChangeText={setNewLabel}
                            placeholder="Label (e.g. Gym)"
                            placeholderTextColor={COLORS.textSecondary}
                        />
                        <TextInput
                            style={[styles.input, { fontSize: scaleFont(FONT_SIZES.md), padding: scaleSpacing(SPACING.sm), borderColor: isAccessibilityMode ? COLORS.text : COLORS.border, marginBottom: scaleSpacing(SPACING.md) }]}
                            value={newStop}
                            onChangeText={setNewStop}
                            placeholder="Destination or Stop Name"
                            placeholderTextColor={COLORS.textSecondary}
                        />
                        <TouchableOpacity
                            style={[styles.addBtn, { padding: scaleSpacing(SPACING.sm), backgroundColor: COLORS.line2 }]}
                            onPress={handleAddCustomLocation}
                            accessibilityRole="button"
                            accessibilityLabel="Save new custom shortcut"
                        >
                            <Text style={{ color: COLORS.background, fontWeight: 'bold', textAlign: 'center', fontSize: scaleFont(FONT_SIZES.md) }}>Save Shortcut</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        width: 60,
    },
    headerTitle: {
        fontWeight: 'bold',
        color: COLORS.text,
    },
    content: {
        flex: 1,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: COLORS.line1,
        marginBottom: SPACING.sm,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    settingLabel: {
        color: COLORS.text,
    },
    inputGroup: {
        marginBottom: SPACING.md,
    },
    inputLabel: {
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        color: COLORS.text,
    },
    sectionSubtitle: {
        fontWeight: 'bold',
        color: COLORS.textSecondary,
    },
    customLocationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    deleteBtn: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
    },
    addCustomContainer: {
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
    },
    addBtn: {
        borderRadius: 8,
    },
});
