import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGoOnAndroid = Platform.OS === 'android' && Constants.appOwnership === 'expo';

// Configure how notifications behave when the app is in the foreground
const configureNotifications = async () => {
    if (!isExpoGoOnAndroid) {
        try {
            const Notifications = await import('expo-notifications');
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: false,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });
        } catch (e) {
            console.warn('[JATA] Failed to configure notifications:', e);
        }
    }
};

// Call configuration immediately
configureNotifications();

/**
 * Requests permission for push notifications from the user.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    if (isExpoGoOnAndroid) {
        console.warn("[JATA] Push permissions disabled in Expo Go Android (SDK 53+ limitation). Local push will not work.");
        return false;
    }

    try {
        const Notifications = await import('expo-notifications');

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FFCC00',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        return finalStatus === 'granted';
    } catch (e: any) {
        // Fallback for any other environment quirks
        console.warn(`[JATA] Push permissions warning: ${e.message}`);
        return false; // Degrading gracefully
    }
}

/**
 * Schedules a local push notification and triggers a heavy haptic pattern.
 * Used when approaching a stop.
 */
export async function triggerApproachingStopAlert(stopName: string, detailText: string) {
    // 1. Trigger heavy double haptic immediately for physical feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, 400);

    if (isExpoGoOnAndroid) {
        console.log(`[JATA - MOCK NOTIFICATION] Approaching: ${stopName} - ${detailText}`);
        return;
    }

    try {
        const Notifications = await import('expo-notifications');
        // 2. Schedule the local notification to appear instantly
        await Notifications.scheduleNotificationAsync({
            content: {
                title: `Approaching: ${stopName}`,
                body: detailText,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null, // null means trigger immediately
        });
    } catch (e) {
        console.warn('[JATA] Failed to trigger notification:', e);
    }
}

let tripNotificationId: string | null = null;

/**
 * Update an ongoing trip notification (lightweight Live Activity).
 * Posts a silent notification that updates in the notification shade / lock screen.
 */
export async function updateTripNotification(stopsLeft: number | null, arrivalTime: string, lineName: string) {
    if (isExpoGoOnAndroid) return;
    try {
        const Notifications = await import('expo-notifications');
        if (tripNotificationId) {
            await Notifications.dismissNotificationAsync(tripNotificationId);
        }

        const body = stopsLeft !== null
            ? `${stopsLeft} stop${stopsLeft !== 1 ? 's' : ''} left · Arriving ${arrivalTime}`
            : `On your way · Arriving ${arrivalTime}`;

        tripNotificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: lineName,
                body,
                sound: false,
            },
            trigger: null,
        });
    } catch (e) {
        console.warn('[JATA] Failed to update trip notification:', e);
    }
}

/**
 * Dismiss the ongoing trip notification when the route ends.
 */
export async function dismissTripNotification() {
    if (isExpoGoOnAndroid) return;
    try {
        if (tripNotificationId) {
            const Notifications = await import('expo-notifications');
            await Notifications.dismissNotificationAsync(tripNotificationId);
            tripNotificationId = null;
        }
    } catch (e) {
        console.warn('[JATA] Failed to dismiss trip notification:', e);
    }
}

/**
 * Phase 4: Schedule a predictive departure notification.
 *
 * Fires a "Leave now to catch..." notification at the predicted commute time.
 * Uses expo-notifications with a date trigger (not push — 100% local).
 *
 * @param destination Short destination name (e.g., "Union Station")
 * @param departureHour Hour (0-23) when the user usually leaves
 * @param departureMinute Minute (0-59) when the user usually leaves
 * @param leadTimeMinutes How many minutes before departure to notify (default: 10)
 */
let predictiveNotificationId: string | null = null;

export async function schedulePredictiveDeparture(
    destination: string,
    departureHour: number,
    departureMinute: number,
    leadTimeMinutes: number = 10,
) {
    if (isExpoGoOnAndroid) {
        console.log(`[JATA - MOCK] Would schedule predictive departure at ${departureHour}:${departureMinute} for ${destination}`);
        return;
    }

    try {
        const Notifications = await import('expo-notifications');

        // Cancel previous predictive notification
        if (predictiveNotificationId) {
            try {
                await Notifications.cancelScheduledNotificationAsync(predictiveNotificationId);
            } catch { /* ignore if already fired */ }
        }

        // Calculate trigger time: today at departureHour:departureMinute minus lead time
        const triggerDate = new Date();
        triggerDate.setHours(departureHour, departureMinute, 0, 0);
        triggerDate.setMinutes(triggerDate.getMinutes() - leadTimeMinutes);

        // If trigger time already passed today, skip
        if (triggerDate.getTime() <= Date.now()) {
            return;
        }

        const h = departureHour % 12 || 12;
        const m = departureMinute.toString().padStart(2, '0');
        const ampm = departureHour >= 12 ? 'PM' : 'AM';
        const timeStr = `${h}:${m} ${ampm}`;

        predictiveNotificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: `Time to head to ${destination}`,
                body: `Leave now to catch your usual ${timeStr} departure`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
            },
        });

        console.log(`[JATA] Scheduled predictive departure for ${triggerDate.toLocaleTimeString()}`);
    } catch (e) {
        console.warn('[JATA] Failed to schedule predictive departure:', e);
    }
}

/**
 * Cancel any pending predictive departure notification.
 */
export async function cancelPredictiveDeparture() {
    if (isExpoGoOnAndroid || !predictiveNotificationId) return;
    try {
        const Notifications = await import('expo-notifications');
        await Notifications.cancelScheduledNotificationAsync(predictiveNotificationId);
        predictiveNotificationId = null;
    } catch (e) {
        console.warn('[JATA] Failed to cancel predictive departure:', e);
    }
}
