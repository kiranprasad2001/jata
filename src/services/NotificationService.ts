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
