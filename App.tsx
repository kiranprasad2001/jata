import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/navigation/types';
import { requestNotificationPermissions } from './src/services/NotificationService';

import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RouteOptionsScreen from './src/screens/RouteOptionsScreen';
import ActiveTransitScreen from './src/screens/ActiveTransitScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Warm up the notification permissions so the system prompt appears early
    requestNotificationPermissions();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false, // We use custom headers in Settings for minimalist design
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="RouteOptions" component={RouteOptionsScreen} />
        <Stack.Screen name="ActiveTransit" component={ActiveTransitScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
