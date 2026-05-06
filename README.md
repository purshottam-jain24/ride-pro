# 🚗 Ride Pro

![Ride Pro Mockup](file:///C:/Users/white/.gemini/antigravity/brain/baf7e066-0481-4d8a-acc7-61d9540f536b/ride_pro_mockup_1777230417192.png)

**Ride Pro** is a modern, high-performance ride-hailing application built with React Native and Expo. It features a seamless map interface, real-time location tracking, and a premium glassmorphism design.

---

## 🚀 Key Features

- 📍 **Real-time Map Integration**: Interactive map views with custom markers.
- 🗺️ **Location Intelligence**: Accurate pick-up and drop-off point selection.
- ✨ **Premium UI/UX**: Modern dark mode interface with smooth animations and glassmorphism effects.
- 📱 **Cross-Platform**: Optimized for iOS, Android, and Web.
- ⚡ **Lightning Fast**: Powered by Expo SDK 54 and React 19.

---

## 🛠 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/)
- **Runtime**: [Expo SDK 54](https://expo.dev/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based)
- **Maps**: [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Animations**: [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js**: [Download and install Node.js](https://nodejs.org/) (Recommended: LTS version).
2.  **Git**: [Download and install Git](https://git-scm.com/).
3.  **Expo Go (Mobile App)**: Download on your phone from the [App Store](https://apps.apple.com/app/expo-go/id982107779) or [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).

---

## ⚙️ Installation

Follow these steps to get the project running locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/ride-pro.git
    cd ride-pro
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install      # or `npm install`
    ```

3.  **Set up environment variables**:
    ```bash
    cp .env.example .env
    # then edit .env and fill in your Firebase + Google client IDs
    ```
    The `.env` file is gitignored. All vars are prefixed `EXPO_PUBLIC_*` so Expo
    inlines them into the bundle at build time.

---

## 🤖 ML Pricing (on-device)

The dynamic-pricing model is a 30-tree Random Forest trained on synthetic data.
The trained trees are exported into [`utils/mlModel.ts`](utils/mlModel.ts) and
evaluated **entirely on device** — no Python server is required at runtime.

To re-train (optional, requires Docker):

```bash
docker compose up -d --build              # builds the trainer image
docker run --rm -v "$(pwd):/work" -w /work ride-pro-ml-api python train_export.py
docker compose down
```

The mobile app picks up the regenerated `utils/mlModel.ts` on next bundle.

---

## 🏃 Running the App

Start the development server:

```bash
npx expo start
```

Once the server is running, you will see a QR code in your terminal.

### 📱 Testing on a Physical Device (Recommended)
1.  Open the **Expo Go** app on your iOS or Android device.
2.  **Android**: Scan the QR code from the terminal.
3.  **iOS**: Open the Camera app and scan the QR code, then tap the "Open in Expo Go" prompt.

### 💻 Testing on Web
Press `w` in the terminal to open the application in your browser.

### 🤖 Testing on Emulator/Simulator
- Press `a` for Android Emulator.
- Press `i` for iOS Simulator.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.
