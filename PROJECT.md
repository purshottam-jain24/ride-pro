# Ride Pro — Project Documentation

A complete walkthrough of the Ride Pro ride-hailing application: architecture,
key features, algorithms, code organisation, and a demo script for a viva /
project presentation.

---

## Table of Contents

1. [What is Ride Pro?](#1-what-is-ride-pro)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Project Structure](#4-project-structure)
5. [Core Features](#5-core-features)
6. [Code Walkthrough](#6-code-walkthrough)
   - 6.1 Authentication & Role Routing
   - 6.2 State Management (RideContext)
   - 6.3 Navigation (Expo Router)
   - 6.4 Maps (Leaflet inside WebView)
   - 6.5 The Ride State Machine
   - 6.6 Cross-Device Sync (Firestore)
   - 6.7 On-Device ML Pricing Engine
   - 6.8 Bottom Sheet UI
   - 6.9 Saved Places (CRUD)
   - 6.10 Deep Links to Competitor Apps
7. [Security & Configuration](#7-security--configuration)
8. [Setup & Run](#8-setup--run)
9. [Demo Script (for the viva)](#9-demo-script)
10. [Limitations & Future Work](#10-limitations--future-work)

---

## 1. What is Ride Pro?

Ride Pro is a cross-platform ride-hailing application written in
**React Native (Expo)** with **Firebase** as the realtime backend. A single
codebase serves both the **passenger** and **driver** roles, with role-based
UI gating decided at login.

It ships with several capabilities not commonly found together in a student
project:

- A complete **passenger ↔ driver state machine** synchronised in real time
  through Firestore (`idle` → `searching` → `accepted` → `arrived` → `ongoing`
  → `completed`).
- An **on-device machine-learning pricing engine** — a 30-tree Random Forest
  trained in Python and exported as a TypeScript module so the model runs
  entirely in the mobile app with no server at runtime.
- **Smart route comparison** with live deep links to Uber, Ola and Rapido
  (the user can compare and book in another app with one tap).
- **Saved places CRUD** with Firestore persistence, plus a configurable
  one-tap "Quick Book" widget on the dashboard.
- **OTP-protected ride start** so a passenger can verify the driver who
  arrives is the one assigned to them.
- A **female-only ride mode** that filters drivers by registered gender for
  passenger-side safety.
- A **rating + tip flow** at completion that adds the tip directly to the
  driver's wallet.

The data model is intentionally simple but realistic — the same Firestore
document `active_rides/{rideId}` represents the live state both the passenger
and the driver subscribe to.

---

## 2. Tech Stack

| Layer                  | Choice                                        | Why                                                           |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| Mobile framework       | **React Native** with **Expo SDK 54**         | One codebase for iOS, Android and Web; OTA updates; rich SDK. |
| Language               | **TypeScript** 5.9                            | Type safety across the whole app.                             |
| Routing                | **Expo Router 6** (file-based)                | Routes are derived from `app/*.tsx` filenames.                |
| State                  | React Context + Hooks                         | Single `RideContext` holds all global state.                  |
| Backend                | **Firebase** (Auth + Firestore)               | Real-time listeners, free tier, no server code to deploy.     |
| Maps                   | **Leaflet** + **OpenStreetMap (CartoDB)**     | No API key, runs inside a WebView, works on all platforms.    |
| ML training (offline)  | **scikit-learn** RandomForestRegressor        | Trained inside Docker; exported to JSON.                      |
| ML inference (runtime) | Pure TypeScript                               | Zero network calls; runs fully on-device.                     |
| Bottom Sheet           | `@gorhom/bottom-sheet` 5                      | Native-feel snap points and gestures.                         |
| Animations             | React Native Reanimated 4                     | High-performance UI animations.                               |
| Icons                  | `@expo/vector-icons` (Ionicons / MCI)         | Crisp at any scale.                                           |
| Gradients              | `expo-linear-gradient`                        | Hero cards and primary CTA.                                   |
| Haptics                | `expo-haptics`                                | Native tactile feedback on key interactions.                  |
| Notifications          | `expo-notifications` (when supported)         | Local push alerts for ride state changes.                     |

---

## 3. System Architecture

```
+---------------------------------------------------+        +------------------------+
|                Mobile App (React Native)          |        |   Firebase (Cloud)     |
|                                                   |        |                        |
|   ┌──────────────────────────────────────────┐    |        |  ┌──────────────────┐  |
|   │            UI / Expo Router              │    |        |  │   Auth (users)    │  |
|   │   index • dashboard • passenger •        │    |        |  └──────────────────┘  |
|   │   driver • places • history • schedules  │    |  HTTPS |  ┌──────────────────┐  |
|   └────────────────┬─────────────────────────┘    |◄──────►│  │  Firestore        │  |
|                    │                              |        |  │   • users/{uid}   │  |
|   ┌────────────────▼─────────────────────────┐    |        |  │   • active_rides  │  |
|   │            RideContext (state)           │    |        |  └──────────────────┘  |
|   │  rideState · pickup · dropoff ·          │    |        |                        |
|   │  driverLocation · wallet · savedPlaces · │    |        +------------------------+
|   │  schedules · history · OTP …             │    |
|   └────────────────┬─────────────────────────┘    |
|                    │                              |
|  +-----------------▼----------------+   +------+  |
|  │  Firestore listener (onSnapshot) │   │ Map  │  |
|  │  bidirectional sync of           │   │(Leaf-│  |
|  │  active_rides/{rideId}           │   │let in│  |
|  +----------------------------------+   │WebVw)│  |
|                                         +------+  |
|  +----------------------------------+              |
|  │  utils/onDeviceMl.ts             │   <-- 30 decision trees in JS,
|  │  utils/mlPricingEngine.ts        │       no network call.
|  +----------------------------------+              |
+---------------------------------------------------+
```

Key architectural decisions:

1. **No custom backend.** All state (auth, ride documents, user profile,
   wallets, schedules) lives in Firestore. The two roles (passenger and
   driver) coordinate by writing/reading the same `active_rides/{rideId}`
   document.
2. **Single source of truth.** A passenger writes the ride request; the
   driver listens for matching documents and updates the document as it
   progresses. Both clients render off the same document, so any change on
   one device propagates automatically.
3. **On-device ML.** The pricing model was a Flask + scikit-learn server
   originally — it now runs entirely in TypeScript so the app needs no
   server at runtime.

---

## 4. Project Structure

```
ride-pro/
├── app/                  # File-based routes (Expo Router)
│   ├── _layout.tsx       # Root layout: providers, stack, gestures
│   ├── index.tsx         # Login / signup
│   ├── dashboard.tsx     # Passenger home (greeting, quick-book, services)
│   ├── passenger.tsx     # Booking + ride lifecycle UI
│   ├── driver.tsx        # Driver home + ride lifecycle UI
│   ├── places.tsx        # Saved places CRUD
│   ├── history.tsx       # Past rides
│   ├── schedules.tsx     # Recurring rides
│   ├── profile.tsx       # Edit profile / change password / logout
│   └── track.tsx         # Public live-tracking page (deep link)
│
├── components/
│   ├── MapComponent.tsx       # Leaflet map (native via WebView)
│   ├── MapComponent.web.tsx   # Same map for web (iframe)
│   └── RideComparison.tsx     # Static price comparison (legacy fallback)
│
├── context/
│   └── RideContext.tsx        # Global state + Firestore sync
│
├── utils/
│   ├── locationUtils.ts       # Geocoding, routing, weather, demand
│   ├── mlPricingEngine.ts     # Front-door for price prediction
│   ├── onDeviceMl.ts          # Pure-JS Random Forest evaluator
│   ├── mlModel.ts             # Auto-generated trained forest (80 KB)
│   ├── notifications.ts       # Safe wrapper around expo-notifications
│   └── nav.ts                 # goBack() that falls back to /dashboard
│
├── FirebaseConfig.ts          # Reads .env, initialises Firebase
├── train_export.py            # Python: trains RF and emits utils/mlModel.ts
├── ml_server.py               # (Legacy) Flask server, no longer required
├── Dockerfile / docker-compose.yml / requirements.txt
│                              # Optional containers, only for re-training
├── .env.example               # Template (committed)
├── .env                       # Real keys (gitignored)
└── PROJECT.md                 # ← this document
```

---

## 5. Core Features

### Ride lifecycle (real-time)

| State        | Passenger UI                   | Driver UI                  | Firestore op                      |
| ------------ | ------------------------------ | -------------------------- | --------------------------------- |
| `idle`       | Plan ride form                 | Online · waiting           | —                                 |
| `searching`  | "Looking for drivers" spinner  | "New Request" card appears | `setDoc(active_rides/{rideId})`   |
| `accepted`   | Driver card + ETA pill         | "Pick up <name>" + ETA     | `update status='accepted'`        |
| `arrived`    | Big OTP banner                 | OTP input                  | `update status='arrived'`         |
| `ongoing`    | Live driver marker + Pool card | "Heading to destination"   | `update driverLocation` per tick  |
| `completed`  | Rating + tip + payment         | Earnings card              | `delete active_rides/{rideId}`    |

### Other features

- **Saved Places (full CRUD)** — list, add, edit, delete; persists to
  Firestore under `users/{uid}.savedPlaces`.
- **Quick-Book widget** on the dashboard maps two saved places to a
  one-tap shortcut. The pickup/dropoff IDs are stored per user.
- **Vehicle classes** — Bike, Auto, Mini, Sedan, SUV, Premium, each with
  its own price multiplier on top of the AI-predicted base.
- **Compare & Book** — shows live price diff vs Uber, Ola and Rapido and
  generates platform-specific deep links pre-filled with pickup and drop
  coordinates.
- **Surge animation** — when `demandLevel === 'Surge'` the price tag
  pulses (Animated value driven by `Animated.loop`).
- **Female-only mode** — passengers can request a female driver only;
  drivers' `gender` field is stored at signup and matched server-side.
- **Schedule rides** — recurring rides on selected days at a chosen time.
- **OTP** — generated on request creation, surfaced to the passenger,
  required from the driver to start the ride.
- **SOS + Share trip** during an active ride.
- **Rating + tip** modal at completion; the tip is added to the driver's
  in-app wallet.

---

## 6. Code Walkthrough

### 6.1 Authentication & Role Routing — [`app/index.tsx`](app/index.tsx)

`handleAuth` calls `signInWithEmailAndPassword` or
`createUserWithEmailAndPassword`. After auth, it reads the role
(`passenger` / `driver`) either from the freshly-created Firestore
document or from the existing one, and uses `router.replace` to send the
user to the correct home screen:

```ts
router.replace(resolvedRole === 'driver' ? '/driver' : '/dashboard');
```

The same routing happens for the Google Sign-In branch. Both [`/dashboard`](app/dashboard.tsx)
and [`/driver`](app/driver.tsx) re-check the role on mount and bounce
the user if they land on the wrong screen — so even a deep link cannot
trick a driver into the passenger UI or vice-versa.

### 6.2 State Management — [`context/RideContext.tsx`](context/RideContext.tsx)

A single React context exposes ~25 fields covering the entire app:

```ts
{
  rideState, setRideState,
  pickup, setPickup, dropoff, setDropoff,
  driverName, passengerName, rideOtp, setRideOtp,
  isFemaleOnly, setIsFemaleOnly,
  activeDriverGender, passengerGender,
  rideHistory, addRideToHistory, deleteRideFromHistory,
  isPoolEnabled, poolMatch,
  driverLocation, setDriverLocation,
  passengerWallet, driverWallet,
  schedules, addSchedule, toggleSchedule, deleteSchedule,
  savedPlaces, addSavedPlace, updateSavedPlace, removeSavedPlace,
  recentSearches, addRecentSearch,
  widgetPickupId, widgetDropoffId,
  currentUserName, userRole,
}
```

Two effects drive Firestore sync:

1. **`onAuthStateChanged`** — when a user logs in, all per-user data
   (role, gender, history, schedules, saved places, wallet, widget
   shortcuts) is loaded from `users/{uid}`.
2. **A "syncRideToGlobal" effect** — whenever `rideState` becomes
   `searching`, the client writes a fresh `active_rides/{rideId}`
   document with the OTP and pickup/drop. When the ride completes or is
   cancelled, the document is deleted and the local state cleared.

### 6.3 Navigation — [`app/_layout.tsx`](app/_layout.tsx)

The root layout wraps everything in:

```jsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <RideProvider>
      <BottomSheetModalProvider>
        <Stack> ... screens ... </Stack>
      </BottomSheetModalProvider>
    </RideProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Every screen registered under `app/*.tsx` becomes a route automatically.
The custom helper [`utils/nav.ts`](utils/nav.ts) wraps `router.back()` in
a `canGoBack()` check so screens reached via `router.replace` (e.g. after
login) still have a usable back button — they fall back to `/dashboard`.

### 6.4 Maps — [`components/MapComponent.tsx`](components/MapComponent.tsx)

To avoid the cost of `react-native-maps` and Google Maps API keys, the
map is implemented as **Leaflet inside a WebView**, fed by a
`CartoDB Voyager` tile layer (no key required). The same code runs on
web via [`MapComponent.web.tsx`](components/MapComponent.web.tsx) using
an `<iframe>` instead.

Custom markers are pure HTML/CSS:

- **Pickup pin** — green gradient teardrop with the letter "A".
- **Drop pin** — red gradient teardrop with the letter "B".
- **Driver marker** — circular badge with a car emoji, surrounded by an
  animated CSS ripple (radar effect) while the ride is active.

Updating the map is done by `injectJavaScript` (native) or
`postMessage` (web), so React state drives the leaflet world without
re-mounting the WebView.

### 6.5 The Ride State Machine

Defined in [`context/RideContext.tsx`](context/RideContext.tsx):

```ts
type RideState = 'idle' | 'searching' | 'accepted' | 'arrived' | 'ongoing' | 'completed';
```

A passenger advances the state:

- `idle → searching` when "Find Rides" is tapped.
- `accepted → ...` is driven *by the driver* via Firestore.

The driver advances the state:

- `searching → accepted` on Accept Ride.
- `accepted → arrived` on Arrived.
- `arrived → ongoing` once the OTP entered matches.
- `ongoing → completed` on Complete Ride.

Either side can cancel from any step before `ongoing` — the local
`cancelActiveRide` resets the state and writes a cancellation row to
history. The Firestore document is deleted, so the other client gets
notified instantly.

### 6.6 Cross-Device Sync — [`context/RideContext.tsx`](context/RideContext.tsx)

The driver listens for new requests with a Firestore query:

```ts
query(collection(db, 'active_rides'), where('status', '==', 'searching'), limit(5))
```

The first valid match (within 10 minutes, not the driver's own request)
is adopted as the driver's current ride; the driver's `currentRideId` is
set, after which both sides switch to a single-document `onSnapshot`
listener on `active_rides/{rideId}`. From that moment on, every
`status` and `driverLocation` change on one device is mirrored on the
other within milliseconds.

### 6.7 On-Device ML Pricing — [`utils/onDeviceMl.ts`](utils/onDeviceMl.ts)

The price model is a **Random Forest regressor** with 30 decision trees,
max depth 6, trained on 5 000 synthetic ride samples. Features:

| Feature         | Type    | Encoding                                                          |
| --------------- | ------- | ----------------------------------------------------------------- |
| `distanceKm`    | number  | great-circle distance computed by `calculateDistance()`           |
| `timeOfDayHour` | int     | 0–23                                                              |
| `weather`       | enum    | Clear=0, Rain=1, Storm=2, Fog=3                                   |
| `demandLevel`   | enum    | Low=0, Normal=1, High=2, Surge=3                                  |

Training (one-off, runs in Docker) is in
[`train_export.py`](train_export.py):

```python
model = RandomForestRegressor(n_estimators=30, max_depth=6, random_state=42)
model.fit(X, y)
```

Each fitted tree is then flattened to four arrays — `feature`,
`threshold`, `left`, `right`, `value` — and emitted into a single
TypeScript file [`utils/mlModel.ts`](utils/mlModel.ts) (~80 KB). The
inference loop in [`utils/onDeviceMl.ts`](utils/onDeviceMl.ts) walks
each tree until it hits a leaf and averages the predictions:

```ts
function evalTree(tree: RFTree, x: number[]): number {
  let i = 0;
  while (tree.l[i] !== -1) {
    if (x[tree.f[i]] <= tree.th[i]) i = tree.l[i];
    else i = tree.r[i];
  }
  return tree.v[i];
}
```

For a single prediction the cost is roughly
`30 trees × ~depth(6)` ≈ 180 comparisons, well under 1 ms in JS.
[`utils/mlPricingEngine.ts`](utils/mlPricingEngine.ts) is the public
front-door — it tries the on-device model first, falls back to a hand-
written heuristic that mirrors the training-data formula if anything
goes wrong, and returns:

```ts
{
  price: number,        // final rounded fare in ₹
  basePrice: number,    // pre-adjustment baseline
  explanation: string,  // human-readable factors
}
```

The base price is then multiplied by the selected vehicle's coefficient
in [`app/passenger.tsx`](app/passenger.tsx) (Bike 0.45×, Auto 0.65×,
Mini 0.85×, Sedan 1.0×, SUV 1.4×, Premium 1.8×).

### 6.8 Bottom Sheet UI — [`app/passenger.tsx`](app/passenger.tsx)

The booking experience is built on top of `@gorhom/bottom-sheet`. The
sheet has three snap points (32%, 62%, 92%) and the snap point is
driven by `rideState`:

- `idle` / `completed` → 92% (full content)
- `searching` → 62%
- `accepted` / `arrived` / `ongoing` → 62%

This means the UI *automatically* reveals the right amount of content for
the current step without the user having to drag.

### 6.9 Saved Places — [`app/places.tsx`](app/places.tsx)

A dedicated CRUD screen with:

- A list view rendered by `FlatList`, each row with **Edit** and
  **Delete** action buttons.
- An **Add place** floating CTA + modal editor with three controls:
  label text, icon picker (12 emoji presets), and address (search via
  OpenStreetMap Nominatim *or* "Use current location" using
  `expo-location`).
- A confirmation `Alert` before destructive operations.
- All operations sync to `users/{uid}.savedPlaces` via the helpers
  defined in [`context/RideContext.tsx`](context/RideContext.tsx)
  (`addSavedPlace`, `updateSavedPlace`, `removeSavedPlace`).
- If a saved place referenced by the dashboard's Quick-Book widget is
  deleted, the widget IDs are cleared automatically.

### 6.10 Deep Links to Competitor Apps — [`app/passenger.tsx`](app/passenger.tsx) (CompareSection)

The "Compare & Book" card constructs platform-specific URLs that
pre-fill pickup and drop coordinates:

| App     | URL template                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uber    | `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=…&pickup[longitude]=…&dropoff[latitude]=…&dropoff[longitude]=…`                                  |
| Ola     | `https://book.olacabs.com/?serviceType=p2p&pickup_lat=…&pickup_lng=…&drop_lat=…&drop_lng=…`                                                                |
| Rapido  | `https://onelink.rapido.bike/?pickup_lat=…&pickup_lng=…&drop_lat=…&drop_lng=…`                                                                             |

`Linking.openURL(url)` opens the installed app via universal links, or
falls back to the web flow.

The card also makes the trade-off explicit to the user with the line
*"OTP & live tracking only available when you book in RidePro"* — an
honest UX choice rather than burying the comparison.

---

## 7. Security & Configuration

### Environment variables

All credentials live in [`.env`](.env) (gitignored) and are read at
build time via Expo's `EXPO_PUBLIC_*` convention:

```
EXPO_PUBLIC_FIREBASE_API_KEY=…
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=…
EXPO_PUBLIC_FIREBASE_PROJECT_ID=…
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=…
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
EXPO_PUBLIC_FIREBASE_APP_ID=…
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=…    (optional, web only)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…       (Google Sign-In only)
```

The schema is documented in [`.env.example`](.env.example) (committed).
[`FirebaseConfig.ts`](FirebaseConfig.ts) throws a clear error if any
required key is missing — the app will not start with a half-configured
environment, which prevents silent mis-config.

### Notes for an honest review

- Firebase **web** API keys are designed to be exposed to clients;
  security must come from **Firestore Security Rules**. This project
  does not yet ship a `firestore.rules` — that is the right next step
  for a production version.
- The OTP is currently generated and verified on the client. A real
  ride-hailing app would issue/verify it through a Cloud Function so
  that a malicious client cannot fake a successful pickup. This is
  called out in the Limitations section.

---

## 8. Setup & Run

### Prerequisites

- Node.js 18+, pnpm (or npm)
- An Expo Go account *(optional; you can also use a development build)*
- Docker (only required if you ever want to **re-train** the ML model)

### One-time setup

```bash
git clone git@github.com:purshottam-jain24/ride-pro.git
cd ride-pro

pnpm install                       # or `npm install`

cp .env.example .env
#  edit .env and paste your Firebase + Google client IDs
```

### Run the app

```bash
pnpm start                         # opens the Expo dev server
#  press `a` for Android, `i` for iOS, `w` for web
```

Note: Google Sign-In and push notifications require a
**development build** (`npx expo run:android`) — Expo Go SDK 53+ does
not bundle those native modules. The app detects Expo Go and gracefully
disables those two flows so the rest of the app still works in Expo Go.

### Re-train the ML model (optional)

```bash
docker compose up -d --build       # builds the trainer image
docker run --rm -v "$(pwd):/work" -w /work ride-pro-ml-api \
       python train_export.py      # writes utils/mlModel.ts
docker compose down
```

---

## 9. Demo Script

### Setup before the demo

1. Create two test accounts in Firebase: one **driver** (set
   `gender=female` if you want to demo female-only) and one
   **passenger**.
2. Sign in with each account on a different device or emulator.

### What to click, in order

#### Login + role routing

1. Sign in as the **passenger** → user lands on `/dashboard`.
2. Highlight the **greeting bar**, the **Where to?** hero search, the
   **saved places strip**, and the **Quick Book** widget (it is hidden
   if the user has no saved place yet).
3. Tap **Saved Places** → demo CRUD: add **Home** and **College**
   (use *Use current location* and OSM search), then edit one to show
   the icon picker, then delete it to show the confirmation.
4. Back to dashboard → the saved-places strip and the **Manage** button
   now show the new entries.

#### Booking flow

5. Tap **Where to?** → opens [`/passenger`](app/passenger.tsx).
6. Tap **From** → choose pickup via "Use current location" or search.
7. Tap **To** → choose destination.
8. Point out:
   - The **AI Price Preview** card with the live `weather` and
     `demand` factors (talk briefly about how these come from
     `fetchRealTimeWeather` and `calculateLiveDemand` in
     [`utils/locationUtils.ts`](utils/locationUtils.ts)).
   - The **vehicle picker** (Bike / Auto / Mini / Sedan / SUV /
     Premium) — tap each one and show that the price in the AI card,
     the Compare & Book card and the **Find Rides** CTA all update
     consistently. This is the on-device ML in action.
   - The **Compare & Book** rows — the **Open** button next to Uber /
     Ola / Rapido triggers a deep link with pre-filled coordinates.
   - The chips: **Women Only**, **Pool**, **Pre-book −20%**,
     **Schedule**.
9. Tap **Find Rides · ₹X** — passenger flips to `searching`. Switch to
   the driver device.

#### Driver side

10. The driver sees a **NEW REQUEST** card appear automatically (this is
    the Firestore `onSnapshot` listener firing).
11. Tap **Accept Ride** — both devices update. The passenger now sees
    the **driver card** with the OTP and the **ETA pill** counting
    down (computed from `driverLocation` + average city speed).
12. Tap **Arrived at Pickup** on the driver, then enter the OTP shown
    on the passenger's screen. Wrong OTP shows an error
    (`Haptics.notificationAsync(Error)`); correct OTP advances both
    devices to `ongoing`.
13. Tap **Complete Ride** → passenger sees the rating modal.

#### Completion

14. Pick **5 stars** + a **₹20 tip** → tip flows directly into the
    driver's wallet, ride is added to history, both clients reset to
    `idle`.
15. Tap **History** on the dashboard → the just-completed ride appears
    with the AI insight.

#### Other features to mention

- **Schedules** screen with active/paused toggle.
- **Profile** screen for password changes & logout.
- **SOS / Share trip** floating buttons during an active ride.
- The **/track** deep-link page that anyone can open to follow a
  shared ride live.

#### What to emphasise in the viva

- "**The ML model runs on-device.** The Random Forest is exported from
  scikit-learn into a TypeScript module and evaluated by 30 lines of
  JavaScript — no server is needed at runtime."
- "**Real-time sync** between passenger and driver is implemented via a
  single Firestore document and `onSnapshot` listeners — the two roles
  coordinate without any custom backend code."
- "**Role-based routing**: the dashboard and driver screens both verify
  the role and bounce a user who lands on the wrong screen."
- "**Saved places have full CRUD**, persist to Firestore, and the
  one-tap commute widget reacts to deletions automatically."
- "**Vehicle multipliers and live demand/weather** all flow through one
  pricing function so every UI element shows the same number — there
  is no place where the price disagrees with itself."

---

## 10. Limitations & Future Work

These are the honest weaknesses of the current build — flagging them
shows judgement and gives you good answers to follow-up questions:

| Area                       | Current state                                    | Production-ready next step                                        |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| OTP verification           | Client-side comparison.                          | Verify in a Cloud Function so a malicious client can't bypass it. |
| Firestore security rules   | Default rules.                                   | Restrict reads/writes per `request.auth.uid`.                     |
| Driver location simulation | `setInterval` interpolating along the route.     | Real GPS streamed from the driver device.                         |
| ML training data           | Synthetic, follows a deterministic formula.      | Real anonymised ride data; richer feature set.                    |
| Push notifications         | Local only; remote disabled in Expo Go (SDK 53). | Use a development build / EAS Build for FCM/APNs.                 |
| Payments                   | Simulated wallet; QR code is decorative.         | Razorpay / Stripe integration.                                    |
| Code organisation          | One large `RideContext`.                         | Split into per-domain contexts (Ride, Wallet, SavedPlaces…).      |
| Testing                    | No automated tests yet.                          | Unit-test the pricing engine and the ride state machine.          |

---

*End of document. Last updated 2026-05-07.*
