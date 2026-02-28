import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { RouteOptionsScreenProps } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { fetchTransitRoutes, TransitRoute } from '../services/GoogleDirectionsService';
import { fetchLiveStatus } from '../services/TtcGtfsService';
import { getBoolean } from '../utils/storage';

export default function RouteOptionsScreen() {
    const route = useRoute<RouteOptionsScreenProps['route']>();
    const navigation = useNavigation<RouteOptionsScreenProps['navigation']>();

    const { origin, destination } = route.params;
    const [routes, setRoutes] = useState<TransitRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);

    const scaleFont = (size: number) => isAccessibilityMode ? size * 1.2 : size;
    const scaleSpacing = (size: number) => isAccessibilityMode ? size * 1.5 : size;

    useEffect(() => {
        const init = async () => {
            setIsAccessibilityMode(await getBoolean('accessibility_mode') ?? false);
            loadRoutes();
        };
        init();
    }, [origin, destination]);
    const loadRoutes = async () => {
        try {
            setLoading(true);
            setError(null);
            // Wait a moment for UX in mock mode
            await new Promise(resolve => setTimeout(resolve, 800));

            const defaultData = await fetchTransitRoutes(origin, destination);
            const liveData = await fetchLiveStatus(defaultData);
            setRoutes(liveData);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch routes');
        } finally {
            setLoading(false);
        }
    };

    const renderRouteItem = ({ item }: { item: TransitRoute }) => {
        // Determine exact TTC color based on mode/line
        let accentColor = COLORS.border;
        if (item.mode.includes('SUBWAY')) accentColor = COLORS.line1;
        if (item.mode.includes('BUS') || item.mode.includes('STREETCAR')) accentColor = COLORS.surface;

        // Some routes have line color returned directly from Google
        const firstTransit = item.steps.find(s => s.travelMode === 'TRANSIT');
        if (firstTransit?.transitDetails?.lineColor) {
            accentColor = firstTransit.transitDetails.lineColor;
        }

        return (
            <TouchableOpacity
                style={[styles.routeCard, { borderColor: accentColor, padding: scaleSpacing(SPACING.md), marginBottom: scaleSpacing(SPACING.md) }]}
                onPress={() => {
                    navigation.navigate('ActiveTransit', { route: item, origin, destination });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Take ${item.mode} taking ${item.totalTimeText}. Crowd level ${item.crowdLevel}. ${item.isLive ? 'Live departure' : 'Scheduled'}`}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.timeText, { fontSize: scaleFont(FONT_SIZES.xl), color: COLORS.text }]}>
                        {item.totalTimeText}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: item.isLive ? '#E8F5E9' : '#F5F5F5' }]}>
                        <Text style={[styles.badgeText, { color: item.isLive ? COLORS.line2 : COLORS.textSecondary }]}>
                            {item.isLive ? '• Live' : 'Scheduled'}
                            {item.etaMins !== undefined ? ` (In ${item.etaMins}m)` : ''}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardDetails}>
                    <Text style={[styles.detailText, { fontSize: scaleFont(FONT_SIZES.md) }]}>Mode: <Text style={{ fontWeight: 'bold' }}>{item.mode}</Text></Text>
                    {item.fare ? <Text style={[styles.detailText, { fontSize: scaleFont(FONT_SIZES.md) }]}>Fare: {item.fare}</Text> : null}
                    <Text style={[styles.detailText, { fontSize: scaleFont(FONT_SIZES.md) }]}>Crowd: {item.crowdLevel}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, isAccessibilityMode && styles.a11yBackground]}>
            <View style={[styles.header, { padding: scaleSpacing(SPACING.md) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
                    <Text style={{ fontSize: scaleFont(FONT_SIZES.lg), color: COLORS.line1 }}>◀ Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: scaleFont(FONT_SIZES.lg) }]} numberOfLines={1}>
                    To: {destination}
                </Text>
                <View style={{ width: 60 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.line1} />
                    <Text style={[styles.loadingText, { marginTop: scaleSpacing(SPACING.md) }]}>Finding best routes...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <Text style={{ color: COLORS.surface, fontSize: scaleFont(FONT_SIZES.md) }}>{error}</Text>
                    <TouchableOpacity onPress={loadRoutes} style={[styles.retryBtn, { marginTop: scaleSpacing(SPACING.md) }]}>
                        <Text style={{ color: COLORS.line1, fontWeight: 'bold' }}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={routes}
                    keyExtractor={(_, index) => index.toString()}
                    renderItem={renderRouteItem}
                    contentContainerStyle={{ padding: scaleSpacing(SPACING.md) }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    a11yBackground: { backgroundColor: '#FAFAFA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { fontWeight: 'bold', color: COLORS.text, flex: 1, textAlign: 'center', marginHorizontal: SPACING.md },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: COLORS.textSecondary },
    retryBtn: { padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.line1, borderRadius: 8 },
    routeCard: { borderWidth: 2, borderRadius: 12, backgroundColor: COLORS.background },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    timeText: { fontWeight: 'bold' },
    badge: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: 12 },
    badgeText: { fontSize: 12, fontWeight: 'bold' },
    cardDetails: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    detailText: { color: COLORS.textSecondary },
});
