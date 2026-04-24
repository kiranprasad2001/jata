# Jata: Transit Tracking Mobile App

Welcome to **Jata**, a transit tracking mobile application built with React Native and Expo. 

Jata provides an optimized, native experience for tracking public transit vehicles. Utilizing high-performance local storage (`react-native-mmkv`) and background location services, it serves as the mobile counterpart to regional transit tracking systems.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- iOS Simulator or Android Emulator (or Expo Go on a physical device)
- EAS CLI (for building binaries)

### Installation

```bash
npm install
```

### Running Locally

```bash
# Start the Metro bundler
npm run start

# Run directly on iOS/Android
npm run ios
npm run android
```

## 📚 Documentation

For a deep dive into the architecture, deployment, and operation of this mobile app, please refer to the comprehensive documentation suite located in the `docs/` directory:

- [Overview](docs/OVERVIEW.md): High-level purpose and functionality.
- [Architecture (HLD/LLD)](docs/ARCHITECTURE/HLD.md): System design, component diagrams, and API interactions.
- [Pipeline](docs/PIPELINE.md): Build and deployment strategies using Expo EAS.
- [Technical Reference](docs/TECHNICAL_REFERENCE.md): APIs, environment variables, and configurations.
- [Runbooks](docs/RUNBOOKS/README.md): Troubleshooting and deployment guides.
- [Business & User Guide](docs/BUSINESS_USER_GUIDE.md): Target audience and user manuals.

*(Note: See `docs/HOW_IT_WORKS.md` for a highly detailed, legacy deep-dive into the routing logic).*
