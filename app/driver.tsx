import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MapComponent from '../components/MapComponent';
import { useRouter } from 'expo-router';
import { useRide } from '../context/RideContext';
import { getRoadRoute } from '../utils/locationUtils';
import { ensurePermissionsAndChannel, notify } from '../utils/notifications';
import { calculateDistance } from '../utils/mlPricingEngine';
import { goBack } from '../utils/nav';

export default function DriverApp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rideState, setRideState, pickup, dropoff, passengerName, rideOtp, isFemaleOnly, driverName, activeDriverGender, addRideToHistory, driverLocation, setDriverLocation, driverWallet, userRole } = useRide();

  useEffect(() => {
    if (userRole === 'passenger') router.replace('/dashboard');
  }, [userRole]);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [inputOtp, setInputOtp] = useState('');

  useEffect(() => {
    ensurePermissionsAndChannel();
  }, []);

  useEffect(() => {
    let title = '';
    let msg = '';
    const excluded = rideState === 'searching' && isFemaleOnly && activeDriverGender !== 'female';

    switch (rideState) {
      case 'searching':
        if (!excluded) {
          title = 'New Ride Request!';
          msg = `${passengerName} needs a ride to their destination.`;
        }
        break;
      case 'accepted':
        title = 'Ride Accepted';
        msg = 'Head towards the pickup location.';
        break;
      case 'arrived':
        title = 'Arrived at Pickup';
        msg = `Ask ${passengerName} for the 4-digit OTP.`;
        break;
      case 'ongoing':
        title = 'Ride Started';
        msg = 'Follow the route to the destination.';
        break;
      case 'completed':
        title = 'Ride Completed';
        msg = 'Earnings have been added to your wallet.';
        break;
      default:
        return;
    }
    if (title) notify(title, msg);
  }, [rideState, passengerName, isFemaleOnly, activeDriverGender]);

  useEffect(() => {
    if (pickup && dropoff) updateRoute();
  }, [pickup, dropoff]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (rideState === 'accepted' && pickup) {
      setDriverLocation({
        name: 'Driver',
        latitude: pickup.latitude - 0.015,
        longitude: pickup.longitude - 0.015,
      });

      interval = setInterval(() => {
        setDriverLocation(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            latitude: prev.latitude + (pickup.latitude - prev.latitude) * 0.15,
            longitude: prev.longitude + (pickup.longitude - prev.longitude) * 0.15,
          };
        });
      }, 1000);
    } else if (rideState === 'arrived' && pickup) {
      setDriverLocation({ ...pickup, name: 'Driver' });
    } else if (rideState === 'ongoing' && routeCoords.length > 0) {
      let currentIndex = 0;
      interval = setInterval(() => {
        if (currentIndex < routeCoords.length) {
          const coord = routeCoords[currentIndex];
          setDriverLocation({
            name: 'Driver',
            latitude: coord.latitude,
            longitude: coord.longitude,
          });
          currentIndex += Math.max(1, Math.floor(routeCoords.length / 15));
        }
      }, 1000);
    } else if (rideState === 'idle') {
      setDriverLocation(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [rideState, pickup, routeCoords]);

  // ETA to pickup while accepted
  const etaSeconds = useMemo(() => {
    if (rideState !== 'accepted' || !driverLocation || !pickup) return null;
    const km = calculateDistance(driverLocation.latitude, driverLocation.longitude, pickup.latitude, pickup.longitude);
    // simulate ~30 km/h average city speed
    return Math.max(30, Math.round((km / 30) * 3600));
  }, [driverLocation, pickup, rideState]);

  const formatEta = (s: number | null) => {
    if (s == null) return '--:--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const updateRoute = async () => {
    const coords = await getRoadRoute(
      { lat: pickup!.latitude, lon: pickup!.longitude },
      { lat: dropoff!.latitude, lon: dropoff!.longitude }
    );
    setRouteCoords(coords);
  };

  const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
    Haptics.impactAsync(style).catch(() => {});

  const confirmCancelDriverRide = () => {
    Alert.alert(
      'Cancel ride?',
      'The passenger will be notified and the request will be released.',
      [
        { text: 'Keep ride', style: 'cancel' },
        {
          text: 'Yes, cancel',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            setRideState('idle');
            setDriverLocation(null);
          },
        },
      ]
    );
  };

  const handleVerifyOtp = () => {
    if (inputOtp === rideOtp) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRideState('ongoing');
      setInputOtp('');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Invalid OTP', 'The OTP you entered is incorrect. Please ask the passenger for the correct code.');
    }
  };

  const isExcludedFromRide = rideState === 'searching' && isFemaleOnly && activeDriverGender !== 'female';
  const showIdle = rideState === 'idle' || isExcludedFromRide;
  const showRequest = rideState === 'searching' && !isExcludedFromRide;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.container}>
        <MapComponent
          style={styles.map}
          pickup={pickup}
          dropoff={dropoff}
          routeCoordinates={routeCoords}
          driverLocation={driverLocation}
        />

        <SafeAreaView style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => { tap(); goBack(); }}>
              <Ionicons name="chevron-back" size={22} color="#111" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.walletBadge}>
                <MaterialCommunityIcons name="wallet" size={16} color="#2e7d32" />
                <Text style={styles.walletText}>₹{driverWallet}</Text>
              </View>
              <View style={styles.driverProfileBadge}>
                <Ionicons
                  name={activeDriverGender === 'female' ? 'woman' : 'man'}
                  size={16}
                  color={activeDriverGender === 'female' ? '#ff4081' : '#1E88E5'}
                />
                <View style={{ marginLeft: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{driverName}</Text>
                  <Text style={{ fontSize: 10, color: activeDriverGender === 'female' ? '#ff4081' : '#666', fontWeight: 'bold' }}>
                    {activeDriverGender === 'female' ? 'Female' : 'Male'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>

        {rideState === 'accepted' && etaSeconds != null && (
          <View style={[styles.etaPill, { top: insets.top + 64 }]}>
            <LinearGradient
              colors={['#1E88E5', '#6A11CB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.etaGradient}
            >
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={styles.etaText}>Pickup in {formatEta(etaSeconds)}</Text>
            </LinearGradient>
          </View>
        )}

        <View style={styles.bottomSheet}>
          {showIdle && (
            <View style={styles.centerContent}>
              <View style={styles.statusBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.statusText}>Online</Text>
              </View>
              <Text style={styles.sheetTitle}>Looking for rides...</Text>
              <Text style={styles.subtitle}>Stay near CP or Huda City for more requests</Text>
              <View style={styles.idleStatsRow}>
                <View style={styles.statCard}>
                  <MaterialCommunityIcons name="cash-multiple" size={20} color="#2e7d32" />
                  <Text style={styles.statValue}>₹{driverWallet}</Text>
                  <Text style={styles.statLabel}>Today</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="star" size={20} color="#f9a825" />
                  <Text style={styles.statValue}>4.9</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
                <View style={styles.statCard}>
                  <MaterialCommunityIcons name="map-marker-radius" size={20} color="#1E88E5" />
                  <Text style={styles.statValue}>2.1km</Text>
                  <Text style={styles.statLabel}>Range</Text>
                </View>
              </View>
            </View>
          )}

          {showRequest && (
            <View>
              <View style={styles.requestBadge}>
                <MaterialCommunityIcons name="bell-ring-outline" size={14} color="#d32f2f" />
                <Text style={styles.requestBadgeText}>NEW REQUEST</Text>
              </View>
              <Text style={styles.sheetTitle}>{passengerName}</Text>

              <View style={styles.routeCardDriver}>
                <View style={styles.locationContainer}>
                  <View style={[styles.dot, { backgroundColor: '#2e7d32' }]} />
                  <Text style={styles.locationValue} numberOfLines={1}>{pickup?.name}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.locationContainer}>
                  <View style={[styles.dot, { backgroundColor: '#d32f2f' }]} />
                  <Text style={styles.locationValue} numberOfLines={1}>{dropoff?.name}</Text>
                </View>
              </View>

              <PrimaryButton
                onPress={() => { tap(Haptics.ImpactFeedbackStyle.Medium); setRideState('accepted'); }}
                label="Accept Ride"
                icon="checkmark-circle"
              />
            </View>
          )}

          {rideState === 'accepted' && (
            <View style={styles.centerContent}>
              <Text style={styles.sheetTitle}>Pick up {passengerName}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>To: {pickup?.name}</Text>
              <PrimaryButton
                onPress={() => { tap(Haptics.ImpactFeedbackStyle.Medium); setRideState('arrived'); }}
                label="Arrived at Pickup"
                icon="location"
              />
              <DriverCancelButton onCancel={confirmCancelDriverRide} />
            </View>
          )}

          {rideState === 'arrived' && (
            <View>
              <Text style={styles.sheetTitle}>Enter Start OTP</Text>
              <Text style={styles.subtitle}>Ask {passengerName} for the 4-digit code</Text>

              <TextInput
                style={styles.otpInput}
                placeholder="0 0 0 0"
                keyboardType="number-pad"
                maxLength={4}
                value={inputOtp}
                onChangeText={(t) => { Haptics.selectionAsync().catch(() => {}); setInputOtp(t); }}
              />

              <PrimaryButton onPress={handleVerifyOtp} label="Start Ride" icon="play" />
              <DriverCancelButton onCancel={confirmCancelDriverRide} />
            </View>
          )}

          {rideState === 'ongoing' && (
            <View style={styles.centerContent}>
              <View style={styles.statusBadgeOngoing}>
                <Text style={styles.statusOngoingText}>Ride in Progress</Text>
              </View>
              <Text style={styles.sheetTitle}>Heading to destination</Text>
              <Text style={styles.subtitle} numberOfLines={1}>Dropoff: {dropoff?.name}</Text>
              <PrimaryButton
                onPress={() => { tap(Haptics.ImpactFeedbackStyle.Medium); setRideState('completed'); }}
                label="Complete Ride"
                icon="flag"
              />
            </View>
          )}

          {rideState === 'completed' && (
            <View style={styles.centerContent}>
              <Text style={styles.completionEmoji}>🏁</Text>
              <Text style={styles.sheetTitle}>Ride Completed!</Text>
              <Text style={styles.subtitle}>Payment received. Earnings added to wallet.</Text>
              <PrimaryButton
                onPress={() => {
                  tap(Haptics.ImpactFeedbackStyle.Medium);
                  if (pickup && dropoff) {
                    addRideToHistory({
                      id: Date.now().toString() + '-d',
                      role: 'driver',
                      pickup,
                      dropoff,
                      fare: 150,
                      date: new Date().toLocaleDateString(),
                    });
                  }
                  setRideState('idle');
                }}
                label="Go Online"
                icon="radio"
              />
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function DriverCancelButton({ onCancel }: { onCancel: () => void }) {
  return (
    <TouchableOpacity onPress={onCancel} activeOpacity={0.8} style={dCancelStyles.btn}>
      <Ionicons name="close-circle-outline" size={18} color="#d32f2f" />
      <Text style={dCancelStyles.text}>Cancel Ride</Text>
    </TouchableOpacity>
  );
}

const dCancelStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ffcdd2',
  },
  text: { color: '#d32f2f', fontWeight: '900', fontSize: 14 },
});

function PrimaryButton({ onPress, label, icon }: { onPress: () => void; label: string; icon?: any }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ width: '100%', marginTop: 10 }}>
      <LinearGradient
        colors={['#111', '#1E88E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} />}
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  header: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  driverProfileBadge: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 30, elevation: 10, flexDirection: 'row', alignItems: 'center' },
  walletBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 30, elevation: 10, marginRight: 10, gap: 6 },
  walletText: { fontWeight: '800', fontSize: 14, color: '#2e7d32' },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: 25, elevation: 20, paddingBottom: 40,
  },
  centerContent: { alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginBottom: 10, gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2e7d32' },
  statusText: { color: '#2e7d32', fontWeight: 'bold' },
  statusBadgeOngoing: { backgroundColor: '#e3f2fd', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginBottom: 10 },
  statusOngoingText: { color: '#1976d2', fontWeight: 'bold' },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 5, color: '#111' },
  subtitle: { color: '#666', marginBottom: 20 },
  requestBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffebee', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start', marginBottom: 10, gap: 6 },
  requestBadgeText: { color: '#d32f2f', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  routeCardDriver: { backgroundColor: '#f5f5f5', borderRadius: 15, padding: 14, marginBottom: 14 },
  locationContainer: { flexDirection: 'row', alignItems: 'center' },
  routeLine: { width: 2, height: 16, backgroundColor: '#ddd', marginLeft: 3, marginVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  locationValue: { flex: 1, fontSize: 14, color: '#333', fontWeight: '500' },
  primaryButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, borderRadius: 16, width: '100%',
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  otpInput: {
    backgroundColor: '#f5f5f5', padding: 15, borderRadius: 15,
    fontSize: 26, textAlign: 'center', fontWeight: 'bold', letterSpacing: 12, marginBottom: 10,
  },
  completionEmoji: { fontSize: 50, marginBottom: 10 },
  idleStatsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 18, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#f9f9f9', borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#eee',
  },
  statValue: { fontSize: 16, fontWeight: '900', marginTop: 6, color: '#111' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', marginTop: 2 },
  etaPill: { position: 'absolute', alignSelf: 'center', zIndex: 5 },
  etaGradient: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, gap: 6,
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  etaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
