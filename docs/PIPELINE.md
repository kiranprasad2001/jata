# CI/CD and Automation Pipeline

Jata is an Expo managed project, which heavily relies on Expo Application Services (EAS) for build and deployment pipelines.

## 1. Local Development
- Start the Metro bundler using `npm run start` (or `npx expo start`).
- Use the Expo Go app on a physical device, or boot an iOS Simulator/Android Emulator to test changes.

## 2. Continuous Integration (CI)
While a specific `.github/workflows` configuration might not be fully fleshed out, the standard CI process for Jata includes:
- **Type Checking**: Running `tsc --noEmit` to verify TypeScript typings.
- **Linting**: (If configured) running ESLint/Prettier.

## 3. Build & Deployment (EAS)
The `eas.json` file dictates the build profiles for the application.

### Over-The-Air (OTA) Updates
Minor JavaScript and asset changes are deployed instantly to users via EAS Update.
```bash
eas update --branch production --message "Fix map polyline bug"
```

### Native Binary Builds
When native code (like `react-native-mmkv` or `react-native-nitro-modules`) is modified, a new binary must be compiled.
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```
The resulting `.ipa` and `.aab` files are then submitted to the Apple App Store and Google Play Store respectively.
