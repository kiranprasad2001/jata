# Runbooks

## Troubleshooting Common Issues

### 1. "Cannot connect to Metro Bundler"
**Symptom**: The Expo Go app or Simulator shows a red screen indicating it cannot connect.
**Resolution**:
1. Ensure your mobile device and your development machine are on the same Wi-Fi network.
2. Check if your firewall is blocking port `8081`.
3. Try starting Metro with the tunnel option: `npx expo start --tunnel`.

### 2. Native Module Errors (MMKV / Nitro)
**Symptom**: "Invariant Violation: Native module cannot be null" or similar errors related to MMKV.
**Resolution**:
1. `react-native-mmkv` includes native C++ code. It **cannot** run in the standard Expo Go app.
2. You must create a custom development client: `npx expo run:ios` or `npx expo run:android`.

### 3. Backend Proxy Fails to Return Data
**Symptom**: The map loads, but no vehicles appear, and the app logs network errors.
**Resolution**:
1. Verify the `backend/` Docker container is running.
2. If testing on a physical Android device, `localhost` points to the phone itself, not your PC. Change `EXPO_PUBLIC_API_URL` to your computer's local IP address (e.g., `192.168.1.50`).
