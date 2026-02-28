import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { TransitRoute } from '../services/GoogleDirectionsService';

export type RootStackParamList = {
    Home: undefined;
    Settings: undefined;
    RouteOptions: {
        origin: string;
        destination: string;
    };
    ActiveTransit: {
        route: TransitRoute;
        origin: string;
        destination: string;
    };
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export type RouteOptionsScreenProps = NativeStackScreenProps<RootStackParamList, 'RouteOptions'>;
export type ActiveTransitScreenProps = NativeStackScreenProps<RootStackParamList, 'ActiveTransit'>;
