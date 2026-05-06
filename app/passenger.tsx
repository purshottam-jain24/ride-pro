import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Animated, Easing, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import MapComponent from '../components/MapComponent';
import { LocationData, useRide } from '../context/RideContext';
import { getAddressFromCoords, getRoadRoute, searchAddress, fetchRealTimeWeather, calculateLiveDemand, findNearestEmergencyServices } from '../utils/locationUtils';
import { calculateDistance, predictRidePrice } from '../utils/mlPricingEngine';
import { ensurePermissionsAndChannel, notify } from '../utils/notifications';
import { goBack } from '../utils/nav';

export default function PassengerApp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    rideState, setRideState, pickup, setPickup, dropoff, setDropoff,
    driverName, rideOtp, setRideOtp, isFemaleOnly, setIsFemaleOnly,
    activeDriverGender, addRideToHistory, isPoolEnabled, setIsPoolEnabled,
    poolMatch, setPoolMatch, driverLocation, passengerWallet, setPassengerWallet,
    setDriverWallet, schedules, addSchedule, toggleSchedule, deleteSchedule,
    savedPlaces, addSavedPlace, removeSavedPlace, recentSearches, addRecentSearch,
    currentUserName,
  } = useRide();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'pickup' | 'dropoff'>('pickup');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);

  const [splitUsers, setSplitUsers] = useState<string[]>([]);
  const [newSplitUser, setNewSplitUser] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('17:00');
  const [isPrebooked, setIsPrebooked] = useState(false);
  const [weather, setWeather] = useState<'Clear' | 'Rain' | 'Storm' | 'Fog'>('Clear');
  const [demandLevel, setDemandLevel] = useState<'Low' | 'Normal' | 'High' | 'Surge'>('Normal');
  const [mlPrice, setMlPrice] = useState<{ price: number; basePrice: number; explanation: string } | null>(null);
  const [saveLocationModalVisible, setSaveLocationModalVisible] = useState(false);
  const [locationToSave, setLocationToSave] = useState<LocationData | null>(null);
  const [customTag, setCustomTag] = useState('');

  // Rating modal
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);

  const params = useLocalSearchParams();

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bottom sheet
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['32%', '62%', '92%'], []);

  // Drive sheet snap based on ride state so content always fits
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (!sheetRef.current) return;
        if (rideState === 'idle' || rideState === 'completed') sheetRef.current.snapToIndex(2);
        else if (rideState === 'searching') sheetRef.current.snapToIndex(1);
        else sheetRef.current.snapToIndex(1);
      } catch {
        // ignore snap errors during transitions
      }
    }, 50);
    return () => clearTimeout(t);
  }, [rideState]);

  const [selectedRideType, setSelectedRideType] = useState<'bike' | 'auto' | 'mini' | 'sedan' | 'suv' | 'premium'>('sedan');

  const RIDE_TYPE_MULT: Record<typeof selectedRideType, number> = {
    bike: 0.45, auto: 0.65, mini: 0.85, sedan: 1.0, suv: 1.4, premium: 1.8,
  };
  const vehicleMult = RIDE_TYPE_MULT[selectedRideType] ?? 1;
  const aiPriceRaw = mlPrice ? mlPrice.price : 150;
  const vehiclePrice = Math.round(aiPriceRaw * vehicleMult);
  const discountedBase = vehiclePrice - (poolMatch ? poolMatch.savedAmount : 0);
  const totalFare = isPrebooked ? Math.round(discountedBase * 0.8) : Math.round(discountedBase);

  // Surge pulse animation
  const surgeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (demandLevel === 'Surge') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(surgeAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(surgeAnim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    } else {
      surgeAnim.setValue(0);
    }
  }, [demandLevel]);

  useEffect(() => {
    ensurePermissionsAndChannel();
  }, []);

  useEffect(() => {
    // Quick-book widget: preset both pickup + dropoff. User still reviews options and taps Find Rides.
    if (params.pickupName && params.dropoffName) {
      const presetPickup = savedPlaces.find(p => p.label === params.pickupName)?.location;
      const presetDropoff = savedPlaces.find(p => p.label === params.dropoffName)?.location;
      if (presetPickup) setPickup(presetPickup);
      if (presetDropoff) setDropoff(presetDropoff);
      return;
    }
    // Saved-place chip: preset dropoff only
    if (params.prefillDropoff) {
      const place = savedPlaces.find(p => p.label === params.prefillDropoff)?.location;
      if (place) setDropoff(place);
    }
    if (params.prefillPickup) {
      const place = savedPlaces.find(p => p.label === params.prefillPickup)?.location;
      if (place) setPickup(place);
    }
  }, [params.pickupName, params.dropoffName, params.prefillDropoff, params.prefillPickup, savedPlaces.length]);

  useEffect(() => {
    if (pickup) {
      const getLiveData = async () => {
        const liveWeather = await fetchRealTimeWeather(pickup.latitude, pickup.longitude);
        setWeather(liveWeather);
        const liveDemand = calculateLiveDemand(pickup.latitude, pickup.longitude);
        setDemandLevel(liveDemand);
      };
      getLiveData();
    }
  }, [pickup]);

  // Reset route + price when pickup/dropoff become unset; never null-out price on weather/demand change
  useEffect(() => {
    if (!pickup || !dropoff) {
      setMlPrice(null);
      setRouteCoords([]);
      return;
    }
    updateRoute();
  }, [pickup, dropoff]);

  // Refetch price (preserve last value while fetching to avoid flicker)
  useEffect(() => {
    if (!pickup || !dropoff) return;
    let cancelled = false;
    const dist = calculateDistance(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);
    (async () => {
      const prediction = await predictRidePrice({
        distanceKm: dist,
        timeOfDayHour: new Date().getHours(),
        weather,
        demandLevel,
      });
      if (!cancelled) setMlPrice(prediction);
    })();
    return () => { cancelled = true; };
  }, [pickup, dropoff, weather, demandLevel]);

  useEffect(() => {
    let poolTimer: ReturnType<typeof setTimeout>;
    if (rideState === 'ongoing' && isPoolEnabled && !poolMatch) {
      poolTimer = setTimeout(() => {
        setPoolMatch({
          name: 'Rahul',
          savedAmount: 60,
          description: 'joining midway on your route',
        });
      }, 3000);
    }
    return () => clearTimeout(poolTimer);
  }, [rideState, isPoolEnabled, poolMatch]);

  useEffect(() => {
    let title = '';
    let msg = '';
    switch (rideState) {
      case 'searching': title = 'Looking for Drivers'; msg = 'Notifying nearby drivers in your area...'; break;
      case 'accepted': title = 'Driver Assigned!'; msg = `${driverName} is riding towards you.`; break;
      case 'arrived': title = 'Driver Arrived'; msg = `${driverName} has reached the pickup location.`; break;
      case 'ongoing': title = 'Ride Started'; msg = 'You are heading to your destination.'; break;
      case 'completed': title = 'Ride Completed'; msg = 'You have reached your destination.'; break;
      default: return;
    }
    notify(title, msg);
  }, [rideState, driverName]);

  // ETA to pickup
  const etaSeconds = useMemo(() => {
    if (rideState !== 'accepted' || !driverLocation || !pickup) return null;
    const km = calculateDistance(driverLocation.latitude, driverLocation.longitude, pickup.latitude, pickup.longitude);
    return Math.max(30, Math.round((km / 30) * 3600));
  }, [driverLocation, pickup, rideState]);

  const formatEta = (s: number | null) => {
    if (s == null) return '--:--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
    Haptics.impactAsync(style).catch(() => {});

  const toggleDay = (day: number) => {
    Haptics.selectionAsync().catch(() => {});
    if (selectedDays.includes(day)) setSelectedDays(selectedDays.filter(d => d !== day));
    else setSelectedDays([...selectedDays, day]);
  };

  const saveSchedule = () => {
    if (!pickup || !dropoff || selectedDays.length === 0) {
      Alert.alert('Error', 'Please select pickup, dropoff, and at least one day.');
      return;
    }
    addSchedule({
      id: Date.now().toString(),
      pickup, dropoff,
      days: selectedDays, time: selectedTime, isActive: true,
    });
    setScheduleModalVisible(false);
    setPickup(null);
    setDropoff(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Success', 'Your ride has been scheduled! We will notify you 15 minutes before the scheduled time.');
  };

  const simulateScheduledRide = (schedule: any) => {
    Alert.alert(
      'Upcoming Scheduled Ride',
      `Your daily scheduled ride from ${schedule.pickup.name} to ${schedule.dropoff.name} is in 15 minutes. Auto-booking now...`,
      [{
        text: 'OK', onPress: () => {
          setPickup(schedule.pickup);
          setDropoff(schedule.dropoff);
          const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
          setRideOtp(newOtp);
          setRideState('searching');
        },
      }]
    );
  };

  const updateRoute = async () => {
    try {
      const coords = await getRoadRoute(
        { lat: pickup!.latitude, lon: pickup!.longitude },
        { lat: dropoff!.latitude, lon: dropoff!.longitude }
      );
      setRouteCoords(coords);
    } catch (e) {
      // ignore route failures
    }
  };

  const handleLiveLocation = async () => {
    setIsLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        setIsLoading(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const address = await getAddressFromCoords(location.coords.latitude, location.coords.longitude);
      setPickup({ name: address, latitude: location.coords.latitude, longitude: location.coords.longitude });
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not fetch live location.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSOS = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      'Confirm SOS',
      'This will immediately alert the nearest police station and hospital with your live location. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'YES, I NEED HELP', style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            const loc = driverLocation || pickup || { latitude: 28.6139, longitude: 77.2090 };
            const services = await findNearestEmergencyServices(loc.latitude, loc.longitude);
            setIsLoading(false);
            Alert.alert(
              'SOS TRIGGERED',
              `HELP IS ON THE WAY!\n\nLocation: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}\nPolice Alerted: ${services.police}\nMedical Alerted: ${services.hospital}\n\nEmergency services are responding to your live coordinates. Stay safe.`,
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const shareRide = async () => {
    try {
      const trackingLink = Linking.createURL('/track', { queryParams: { id: 'user123' } });
      const message = `Follow my ride live on RidePro! Track my location here: ${trackingLink}`;
      await Share.share({ message, url: trackingLink, title: 'Track my live ride' });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const openSelector = (type: 'pickup' | 'dropoff') => {
    tap();
    setSelectingFor(type);
    setSearchQuery('');
    setSearchResults([]);
    setModalVisible(true);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length > 2) {
      searchTimeout.current = setTimeout(async () => {
        setIsLoading(true);
        const results = await searchAddress(text);
        setSearchResults(results);
        setIsLoading(false);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  const selectLocation = (loc: LocationData) => {
    Haptics.selectionAsync().catch(() => {});
    addRecentSearch(loc);
    if (selectingFor === 'pickup') setPickup(loc);
    else setDropoff(loc);
    setModalVisible(false);
  };

  const cancelActiveRide = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (pickup && dropoff) {
      addRideToHistory({
        id: Date.now().toString() + '-cancel',
        role: 'passenger',
        pickup,
        dropoff,
        fare: 0,
        date: new Date().toLocaleDateString(),
      });
    }
    setRideState('idle');
    setPickup(null);
    setDropoff(null);
    setRouteCoords([]);
    setSplitUsers([]);
    setPoolMatch(null);
    setIsPaid(false);
    setIsPrebooked(false);
  };

  const confirmCancelRide = () => {
    Alert.alert(
      'Cancel ride?',
      'The driver will be notified and a small cancellation fee may apply.',
      [
        { text: 'Keep ride', style: 'cancel' },
        { text: 'Yes, cancel', style: 'destructive', onPress: cancelActiveRide },
      ]
    );
  };

  const submitRating = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (tip > 0) setDriverWallet(w => w + tip);
    setRatingModalVisible(false);
    if (pickup && dropoff) {
      addRideToHistory({
        id: Date.now().toString() + '-p',
        role: 'passenger',
        pickup, dropoff,
        fare: totalFare + tip,
        splitUsers,
        date: new Date().toLocaleDateString(),
      });
    }
    setRideState('idle');
    setPickup(null);
    setDropoff(null);
    setRouteCoords([]);
    setSplitUsers([]);
    setPoolMatch(null);
    setIsPaid(false);
    setIsPrebooked(false);
    setRating(0);
    setTip(0);
  };

  const handleSheetChange = useCallback((_idx: number) => {}, []);

  return (
    <View style={styles.container}>
      <MapComponent
        style={styles.map}
        pickup={pickup}
        dropoff={dropoff}
        routeCoordinates={routeCoords}
        driverLocation={driverLocation}
      />

      <SafeAreaView style={styles.header} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => { tap(); goBack(); }}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <View style={styles.walletBadge}>
            <MaterialCommunityIcons name="wallet" size={16} color="#2e7d32" />
            <Text style={styles.walletText}>₹{passengerWallet}</Text>
          </View>
        </View>
      </SafeAreaView>

      {(rideState === 'accepted' || rideState === 'arrived' || rideState === 'ongoing') && (
        <View style={[styles.safetyToolkit, { top: insets.top + 64 }]} pointerEvents="box-none">
          <TouchableOpacity style={[styles.safetyButton, { backgroundColor: '#d32f2f' }]} onPress={() => { tap(Haptics.ImpactFeedbackStyle.Heavy); handleSOS(); }}>
            <MaterialCommunityIcons name="alarm-light" size={16} color="#fff" />
            <Text style={styles.safetyText}>SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.safetyButton, { backgroundColor: '#1976d2' }]} onPress={() => { tap(); shareRide(); }}>
            <Ionicons name="share-social" size={16} color="#fff" />
            <Text style={styles.safetyText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {rideState === 'accepted' && etaSeconds != null && (
        <View style={[styles.etaPill, { top: insets.top + 124 }]}>
          <LinearGradient
            colors={['#1E88E5', '#6A11CB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.etaGradient}
          >
            <Ionicons name="time-outline" size={16} color="#fff" />
            <Text style={styles.etaText}>{driverName} arriving in {formatEta(etaSeconds)}</Text>
          </LinearGradient>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        index={2}
        onChange={handleSheetChange}
        enableContentPanningGesture={false}
        handleIndicatorStyle={{ backgroundColor: '#ddd', width: 50, height: 5 }}
        backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          {rideState === 'idle' && (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={styles.h1}>Plan your ride</Text>
                <Text style={styles.h1Sub}>Pick locations, choose vehicle, then book.</Text>
              </View>

              {/* Route card — clean, single component */}
              <View style={styles.cardClean}>
                <TouchableOpacity style={styles.routeRow} onPress={() => openSelector('pickup')} activeOpacity={0.7}>
                  <View style={styles.routeDotWrap}>
                    <View style={[styles.routeDotOuter, { borderColor: '#2e7d32' }]}>
                      <View style={[styles.routeDotInner, { backgroundColor: '#2e7d32' }]} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeRowLabelClean}>From</Text>
                    <Text style={pickup ? styles.routeRowValueClean : styles.routeRowValuePhClean} numberOfLines={1}>
                      {pickup ? pickup.name : 'Choose pickup point'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#bbb" />
                </TouchableOpacity>

                <View style={styles.routeRowDivider}>
                  <View style={styles.routeRowDots} />
                  <TouchableOpacity
                    style={styles.routeSwapClean}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      const p = pickup, d = dropoff;
                      setPickup(d as any); setDropoff(p as any);
                    }}
                  >
                    <MaterialCommunityIcons name="swap-vertical" size={16} color="#1E88E5" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.routeRow} onPress={() => openSelector('dropoff')} activeOpacity={0.7}>
                  <View style={styles.routeDotWrap}>
                    <View style={[styles.routeSquare]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeRowLabelClean}>To</Text>
                    <Text style={dropoff ? styles.routeRowValueClean : styles.routeRowValuePhClean} numberOfLines={1}>
                      {dropoff ? dropoff.name : 'Where to?'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#bbb" />
                </TouchableOpacity>
              </View>

              {/* Feature chips - one row, always visible */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip active={isFemaleOnly} onPress={() => { tap(); setIsFemaleOnly(!isFemaleOnly); }} icon={<Ionicons name="woman" size={14} color={isFemaleOnly ? '#fff' : '#666'} />} label="Women Only" />
                <Chip active={isPoolEnabled} onPress={() => { tap(); setIsPoolEnabled(!isPoolEnabled); }} icon={<MaterialCommunityIcons name="account-group" size={14} color={isPoolEnabled ? '#fff' : '#666'} />} label="Pool" />
                <Chip active={isPrebooked} onPress={() => { tap(); setIsPrebooked(!isPrebooked); }} icon={<Ionicons name="hourglass-outline" size={14} color={isPrebooked ? '#fff' : '#666'} />} label="Pre-book −20%" />
                <Chip active={false} onPress={() => { tap(); if (pickup && dropoff) setScheduleModalVisible(true); }} disabled={!pickup || !dropoff} icon={<Ionicons name="calendar-outline" size={14} color="#666" />} label="Schedule" />
              </ScrollView>

              {pickup && dropoff && mlPrice && (
                <>
                  {/* Vehicle picker — list rows, not bulky cards */}
                  <View>
                    <Text style={styles.sectionH}>Choose vehicle</Text>
                    <View style={styles.cardClean}>
                      {(['bike', 'auto', 'mini', 'sedan', 'suv', 'premium'] as const).map((id, idx, arr) => {
                        const meta = {
                          bike: { label: 'Bike', sub: '1 seat · ~5 min', icon: 'motorbike' },
                          auto: { label: 'Auto', sub: '3 seats · ~6 min', icon: 'rickshaw' },
                          mini: { label: 'Mini', sub: '4 seats · ~4 min', icon: 'car-hatchback' },
                          sedan: { label: 'Sedan', sub: '4 seats · ~3 min', icon: 'car' },
                          suv: { label: 'SUV', sub: '6 seats · ~6 min', icon: 'car-estate' },
                          premium: { label: 'Premium', sub: 'Luxury · ~8 min', icon: 'car-sports' },
                        }[id];
                        const isActive = selectedRideType === id;
                        const price = Math.round(aiPriceRaw * RIDE_TYPE_MULT[id]);
                        return (
                          <TouchableOpacity
                            key={id}
                            activeOpacity={0.7}
                            onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedRideType(id); }}
                            style={[styles.vehicleRow, idx < arr.length - 1 && styles.vehicleRowBorder, isActive && styles.vehicleRowActive]}
                          >
                            <View style={[styles.vehicleIconWrap, isActive && { backgroundColor: '#1E88E5' }]}>
                              <MaterialCommunityIcons name={meta.icon as any} size={22} color={isActive ? '#fff' : '#111'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.vehicleLabel}>{meta.label}</Text>
                              <Text style={styles.vehicleSub}>{meta.sub}</Text>
                            </View>
                            <Text style={styles.vehiclePrice}>₹{price}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* AI Price summary — compact, one row */}
                  <View style={[styles.cardClean, demandLevel === 'Surge' && styles.cardSurge]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.aiBadge, demandLevel === 'Surge' && { backgroundColor: '#fff' }]}>
                        <MaterialCommunityIcons name="robot-happy-outline" size={16} color={demandLevel === 'Surge' ? '#d32f2f' : '#1E88E5'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.aiLabel, demandLevel === 'Surge' && { color: '#fff' }]}>AI Price Preview</Text>
                        <Text style={[styles.aiSub, demandLevel === 'Surge' && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={2}>
                          {mlPrice.explanation}
                        </Text>
                      </View>
                      <Animated.Text
                        style={[
                          styles.aiPrice,
                          demandLevel === 'Surge' && { color: '#fff' },
                          { transform: [{ scale: surgeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, demandLevel === 'Surge' ? 1.06 : 1] }) }] },
                        ]}
                      >
                        ₹{vehiclePrice}
                      </Animated.Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Live Weather', 'Auto-detected near your pickup.')}
                        style={[styles.factTag, weather !== 'Clear' && styles.factTagActive]}
                      >
                        <Ionicons name={weather === 'Clear' ? 'sunny' : weather === 'Rain' ? 'rainy' : weather === 'Storm' ? 'thunderstorm' : 'cloud'} size={12} color={weather !== 'Clear' ? '#fff' : '#666'} />
                        <Text style={[styles.factTagText, weather !== 'Clear' && { color: '#fff' }]}>{weather}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Live Demand', 'Calculated from time, area, traffic density.')}
                        style={[styles.factTag, demandLevel !== 'Normal' && styles.factTagActive]}
                      >
                        <MaterialCommunityIcons name={demandLevel === 'Surge' ? 'fire' : demandLevel === 'High' ? 'trending-up' : demandLevel === 'Low' ? 'trending-down' : 'chart-line'} size={12} color={demandLevel !== 'Normal' ? '#fff' : '#666'} />
                        <Text style={[styles.factTagText, demandLevel !== 'Normal' && { color: '#fff' }]}>{demandLevel} demand</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <CompareSection
                    rideProPrice={vehiclePrice}
                    vehicleLabel={selectedRideType.charAt(0).toUpperCase() + selectedRideType.slice(1)}
                    pickup={pickup}
                    dropoff={dropoff}
                  />
                </>
              )}

              <PrimaryButton
                disabled={!pickup || !dropoff}
                label={pickup && dropoff ? `Find Rides · ₹${totalFare}` : 'Pick locations to continue'}
                icon="search"
                onPress={() => {
                  tap(Haptics.ImpactFeedbackStyle.Medium);
                  const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                  setRideOtp(newOtp);
                  setRideState('searching');
                }}
              />

              {schedules.length > 0 && (
                <View>
                  <Text style={styles.sectionH}>Your scheduled rides</Text>
                  <View style={styles.cardClean}>
                    {schedules.map((s, idx) => (
                      <View key={s.id} style={[styles.scheduleRow, idx < schedules.length - 1 && styles.vehicleRowBorder]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.scheduleRowTitle} numberOfLines={1}>{s.pickup.name} → {s.dropoff.name}</Text>
                          <Text style={styles.scheduleRowSub}>
                            {s.days.map(d => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d]).join(' · ')} · {s.time}
                          </Text>
                        </View>
                        <Switch value={s.isActive} onValueChange={() => { Haptics.selectionAsync().catch(() => {}); toggleSchedule(s.id); }} />
                        <TouchableOpacity onPress={() => simulateScheduledRide(s)} style={styles.scheduleSimBtn}>
                          <Text style={styles.scheduleSimBtnText}>Run</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {rideState === 'searching' && (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#1E88E5" />
              <Text style={styles.searchingTitle}>{isPrebooked ? 'Scheduling your ride...' : 'Searching for rides...'}</Text>
              <Text style={styles.subtitle}>{isPrebooked ? 'Reserving a driver for 30 mins from now.' : 'Connecting you to nearby drivers in Delhi'}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { tap(); setRideState('idle'); }}>
                <Text style={styles.secondaryButtonText}>Cancel Request</Text>
              </TouchableOpacity>
            </View>
          )}

          {rideState === 'accepted' && (
            <View>
              <View style={styles.acceptedHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Driver is coming!</Text>
                  <Text style={styles.subtitle}>White Prius • DL 1CA 1234</Text>
                </View>
                <View style={styles.otpContainer}>
                  <Text style={styles.otpLabel}>OTP</Text>
                  <Text style={styles.otpValue}>{rideOtp}</Text>
                </View>
              </View>

              <View style={styles.driverCard}>
                <View style={styles.driverInfoRow}>
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name={activeDriverGender === 'female' ? 'woman' : 'man'} size={28} color={activeDriverGender === 'female' ? '#ff4081' : '#1E88E5'} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.driverNameText}>{driverName}</Text>
                      {(isFemaleOnly && activeDriverGender === 'female') && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#ff4081" />
                          <Text style={styles.verifiedText}>Verified Female</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Ionicons name="star" size={12} color="#f9a825" />
                      <Text style={styles.carNumberText}> 4.9 • 1,243 trips</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.callButton} onPress={() => tap()}>
                    <Ionicons name="call" size={20} color="#2e7d32" />
                  </TouchableOpacity>
                </View>
              </View>

              <CancelRideButton onCancel={confirmCancelRide} />
            </View>
          )}

          {rideState === 'arrived' && (
            <View style={styles.centerContent}>
              <View style={styles.statusBadgeWrap}>
                <Text style={styles.statusBadge}>Arrived</Text>
              </View>
              <Text style={styles.sheetTitle}>Driver has arrived!</Text>
              <Text style={styles.subtitle}>Share the OTP with driver to start ride</Text>

              <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.largeOtpBox}>
                <Text style={styles.largeOtpText}>{rideOtp}</Text>
              </LinearGradient>

              <View style={styles.driverCard}>
                <Text style={styles.driverNameText}>{driverName} is waiting at pickup</Text>
              </View>

              <CancelRideButton onCancel={confirmCancelRide} />
            </View>
          )}

          {rideState === 'ongoing' && (
            <View style={styles.centerContent}>
              <View style={styles.statusBadgeOngoingWrap}>
                <Text style={styles.statusBadgeOngoing}>Ride in Progress</Text>
              </View>
              <Text style={styles.sheetTitle}>Heading to Destination</Text>
              <Text style={styles.subtitle} numberOfLines={1}>Destination: {dropoff?.name}</Text>

              {poolMatch && (
                <View style={styles.poolBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="account-multiple-plus" size={18} color="#2e7d32" />
                    <Text style={styles.poolBannerTitle}>Co-Rider Found!</Text>
                  </View>
                  <Text style={styles.poolBannerText}>{poolMatch.name} is {poolMatch.description}.</Text>
                  <Text style={styles.poolBannerSave}>You save ₹{poolMatch.savedAmount} on this ride!</Text>
                </View>
              )}

              <View style={styles.driverCard}>
                <Text style={styles.driverNameText}>Driving with {driverName}</Text>
              </View>
            </View>
          )}

          {rideState === 'completed' && (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Text style={styles.completionEmoji}>🏁</Text>
              <Text style={styles.sheetTitle}>Ride Completed!</Text>

              <View style={styles.fareContainer}>
                <Text style={styles.fareText}>Total Fare: ₹{totalFare}</Text>
                {isPrebooked && (
                  <View style={{ backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 5 }}>
                    <Text style={{ color: '#f57c00', fontSize: 12, fontWeight: 'bold' }}>20% Pre-booking Discount Applied!</Text>
                  </View>
                )}
                <Text style={styles.splitText}>
                  {splitUsers.length > 0
                    ? `Per Person: ₹${(totalFare / (splitUsers.length + 1)).toFixed(2)}`
                    : `You pay: ₹${totalFare}`}
                </Text>
              </View>

              {!isPaid ? (
                <View style={styles.paymentSection}>
                  <Text style={styles.paymentSubtitle}>Please pay the driver</Text>

                  {showQR ? (
                    <View style={styles.qrContainer}>
                      <View style={styles.qrBox}>
                        <MaterialCommunityIcons name="qrcode-scan" size={120} color="#111" />
                        <Text style={styles.qrText}>Scan to Pay ₹{totalFare}</Text>
                      </View>
                      <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowQR(false)}>
                        <Text style={styles.secondaryButtonText}>Back to options</Text>
                      </TouchableOpacity>
                      <PrimaryButton
                        label="Simulate Scan Success"
                        icon="checkmark-done"
                        onPress={() => {
                          setDriverWallet(w => w + totalFare);
                          setIsPaid(true); setShowQR(false);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                          Alert.alert('Payment Successful', `₹${totalFare} paid to ${driverName} via UPI.`);
                        }}
                      />
                    </View>
                  ) : (
                    <View style={{ width: '100%' }}>
                      <View style={styles.paymentOptionsRow}>
                        <TouchableOpacity
                          style={styles.paymentMethodCard}
                          onPress={() => {
                            tap();
                            if (passengerWallet >= totalFare) {
                              setPassengerWallet(w => w - totalFare);
                              setDriverWallet(w => w + totalFare);
                              setIsPaid(true);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                              Alert.alert('Wallet Payment Successful', `₹${totalFare} deducted from your wallet.`);
                            } else {
                              Alert.alert('Insufficient Balance', 'Please use another payment method.');
                            }
                          }}
                        >
                          <MaterialCommunityIcons name="wallet" size={28} color="#1E88E5" />
                          <Text style={styles.paymentMethodText}>Wallet (₹{passengerWallet})</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.paymentMethodCard} onPress={() => { tap(); setShowQR(true); }}>
                          <MaterialCommunityIcons name="qrcode" size={28} color="#1E88E5" />
                          <Text style={styles.paymentMethodText}>Show QR</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.cashButton}
                        onPress={() => {
                          tap();
                          setIsPaid(true);
                          Alert.alert('Payment Confirmed', `You marked the payment to ${driverName} as complete.`);
                        }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#333" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#333', fontWeight: '700', fontSize: 15 }}>Cash / 3rd Party Payment Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ width: '100%' }}>
                  <Text style={styles.successText}>✓ Payment Completed</Text>

                  <View style={styles.splitInputContainer}>
                    <TextInput
                      style={styles.splitInput}
                      placeholder="Add co-passenger name..."
                      value={newSplitUser}
                      onChangeText={setNewSplitUser}
                    />
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => {
                        if (newSplitUser.trim()) {
                          Haptics.selectionAsync().catch(() => {});
                          setSplitUsers([...splitUsers, newSplitUser.trim()]);
                          setNewSplitUser('');
                        }
                      }}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {splitUsers.length > 0 && (
                    <View style={styles.splitUsersList}>
                      <Text style={styles.splitUsersTitle}>Splitting with:</Text>
                      <Text style={styles.splitUsersNames}>{splitUsers.join(', ')}</Text>
                    </View>
                  )}

                  <PrimaryButton
                    label="Rate & Finish"
                    icon="star"
                    onPress={() => { tap(Haptics.ImpactFeedbackStyle.Medium); setRatingModalVisible(true); }}
                  />
                </View>
              )}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Rating + Tip modal */}
      <Modal visible={ratingModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.ratingSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.ratingTitle}>How was your ride with {driverName}?</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => { Haptics.selectionAsync().catch(() => {}); setRating(n); }} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={42} color="#f9a825" style={{ marginHorizontal: 4 }} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.tipTitle}>Add a tip?</Text>
            <View style={styles.tipRow}>
              {[0, 10, 20, 50].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tipChip, tip === t && styles.tipChipActive]}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setTip(t); }}
                >
                  <Text style={[styles.tipChipText, tip === t && { color: '#fff' }]}>
                    {t === 0 ? 'No tip' : `₹${t}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <PrimaryButton
              label={tip > 0 ? `Submit + Tip ₹${tip}` : 'Submit'}
              icon="checkmark-circle"
              disabled={rating === 0}
              onPress={submitRating}
            />
            <TouchableOpacity style={{ alignSelf: 'center', marginTop: 8 }} onPress={() => { setRating(5); setTip(0); submitRating(); }}>
              <Text style={{ color: '#888', fontSize: 13 }}>Skip rating</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location selector */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TextInput
                style={styles.searchBar}
                placeholder={`Search for ${selectingFor === 'pickup' ? 'pickup' : 'destination'}...`}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeTextBtn}>
                <Text style={{ fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="always">
              {selectingFor === 'pickup' && !searchQuery && (
                <TouchableOpacity style={styles.liveLocationOption} onPress={handleLiveLocation}>
                  <Ionicons name="locate" size={20} color="#007AFF" style={{ marginRight: 10 }} />
                  <Text style={styles.liveLocationText}>Use Current Location</Text>
                  {isLoading && <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 10 }} />}
                </TouchableOpacity>
              )}

              {!searchQuery && (
                <View style={styles.savedSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Saved Places</Text>
                    <TouchableOpacity
                      onPress={() => { setModalVisible(false); router.push('/places'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e3f2fd', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 }}
                    >
                      <Ionicons name="options-outline" size={14} color="#1E88E5" />
                      <Text style={{ color: '#1E88E5', fontWeight: '900', fontSize: 12 }}>Manage</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.savedPlacesRow}>
                    {savedPlaces.map(place => (
                      <TouchableOpacity
                        key={place.id}
                        style={styles.savedPlaceCard}
                        onPress={() => selectLocation(place.location)}
                        onLongPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          Alert.alert('Saved place', place.label, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Edit', onPress: () => { setModalVisible(false); router.push('/places'); } },
                            { text: 'Delete', style: 'destructive', onPress: () => removeSavedPlace(place.id) },
                          ]);
                        }}
                      >
                        <Text style={styles.savedPlaceIcon}>{place.icon}</Text>
                        <Text style={styles.savedPlaceLabel}>{place.label}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.savedPlaceCard, { backgroundColor: '#e3f2fd', borderColor: '#bbdefb', borderStyle: 'dashed' }]}
                      onPress={() => { setModalVisible(false); router.push('/places'); }}
                    >
                      <Ionicons name="add" size={22} color="#1E88E5" />
                      <Text style={[styles.savedPlaceLabel, { color: '#1E88E5' }]}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {recentSearches.length > 0 && (
                    <View style={{ marginTop: 20 }}>
                      <Text style={styles.sectionTitle}>Recent Searches</Text>
                      {recentSearches.map((loc, index) => (
                        <TouchableOpacity key={index} style={styles.recentSearchItem} onPress={() => selectLocation(loc)}>
                          <Ionicons name="time-outline" size={20} color="#888" style={{ marginRight: 12 }} />
                          <Text style={styles.recentSearchName} numberOfLines={1}>{loc.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {isLoading ? (
                <ActivityIndicator style={{ marginTop: 20 }} />
              ) : (
                searchResults.map((result, index) => (
                  <View key={index} style={[styles.resultItem, { flexDirection: 'row', alignItems: 'center' }]}>
                    <TouchableOpacity style={{ flex: 1, paddingRight: 10 }} onPress={() => selectLocation(result)}>
                      <Text style={styles.resultName}>{result.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#f0f0f0', borderRadius: 8, gap: 4 }}
                      onPress={() => {
                        setLocationToSave(result);
                        setCustomTag(result.name.split(',')[0].substring(0, 15));
                        setSaveLocationModalVisible(true);
                      }}
                    >
                      <Ionicons name="star" size={12} color="#f57c00" />
                      <Text style={{ fontSize: 12, fontWeight: 'bold' }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Schedule modal */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center' }}>Schedule Ride</Text>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)} style={styles.closeTextBtn}>
                <Text style={{ fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 16, marginBottom: 10, fontWeight: '600' }}>Select Days</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => toggleDay(i)}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: selectedDays.includes(i) ? '#000' : '#f0f0f0', justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Text style={{ color: selectedDays.includes(i) ? '#fff' : '#000', fontWeight: 'bold' }}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 16, marginBottom: 10, fontWeight: '600' }}>Select Time (24h)</Text>
              <TextInput
                style={{ backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}
                value={selectedTime}
                onChangeText={setSelectedTime}
                placeholder="e.g. 14:30"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <View style={{ flexDirection: 'row', marginBottom: 30, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['08:00', '09:00', '14:00', '17:00', '18:00'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setSelectedTime(t)} style={{ paddingHorizontal: 15, paddingVertical: 8, backgroundColor: selectedTime === t ? '#000' : '#f0f0f0', borderRadius: 20, marginHorizontal: 5, marginBottom: 10 }}>
                    <Text style={{ color: selectedTime === t ? '#fff' : '#000', fontWeight: 'bold' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <PrimaryButton label="Save Schedule" icon="save" onPress={saveSchedule} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Save place modal */}
      <Modal visible={saveLocationModalVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ backgroundColor: '#fff', padding: 25, borderRadius: 20, width: '85%' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 5 }}>Save Location</Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Enter a tag (Home, Gym, College, Office):</Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, marginBottom: 25, fontSize: 16, borderWidth: 1, borderColor: '#eee' }}
              value={customTag}
              onChangeText={setCustomTag}
              placeholder="Custom Tag"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setSaveLocationModalVisible(false)} style={{ padding: 12, marginRight: 15 }}>
                <Text style={{ color: '#666', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (customTag.trim() && locationToSave) {
                  const tagLower = customTag.trim().toLowerCase();
                  let icon = '📍';
                  if (tagLower === 'home') icon = '🏠';
                  if (tagLower === 'college') icon = '🎓';
                  if (tagLower === 'office' || tagLower === 'work') icon = '🏢';
                  if (tagLower === 'gym') icon = '🏋️';
                  addSavedPlace({ id: Date.now().toString(), label: customTag.trim(), location: locationToSave, icon });
                  setSaveLocationModalVisible(false);
                  Alert.alert('Saved!', `'${customTag.trim()}' added to your saved places.`);
                }
              }} style={{ backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CompareSection({ rideProPrice, pickup, dropoff, vehicleLabel }: { rideProPrice: number; pickup: LocationData; dropoff: LocationData; vehicleLabel?: string }) {
  const competitors = useMemo(() => ([
    {
      id: 'uber',
      name: 'Uber Go',
      mult: 1.25,
      brand: '#000',
      letter: 'U',
      build: () => `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${pickup.latitude}&pickup[longitude]=${pickup.longitude}&pickup[nickname]=${encodeURIComponent(pickup.name)}&dropoff[latitude]=${dropoff.latitude}&dropoff[longitude]=${dropoff.longitude}&dropoff[nickname]=${encodeURIComponent(dropoff.name)}`,
    },
    {
      id: 'ola',
      name: 'Ola Mini',
      mult: 1.18,
      brand: '#f9a825',
      letter: 'O',
      build: () => `https://book.olacabs.com/?serviceType=p2p&utm_source=widget_on_olasite&pickup_lat=${pickup.latitude}&pickup_lng=${pickup.longitude}&drop_lat=${dropoff.latitude}&drop_lng=${dropoff.longitude}`,
    },
    {
      id: 'rapido',
      name: 'Rapido',
      mult: 0.85,
      brand: '#ffb300',
      letter: 'R',
      build: () => `https://onelink.rapido.bike/?pickup_lat=${pickup.latitude}&pickup_lng=${pickup.longitude}&drop_lat=${dropoff.latitude}&drop_lng=${dropoff.longitude}`,
    },
  ]), [pickup, dropoff]);

  const ourPrice = rideProPrice;
  const open = async (c: typeof competitors[number]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const url = c.build();
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Could not open', `${c.name} app/website did not open. ${e?.message || ''}`);
    }
  };

  const cheapest = useMemo(() => {
    const ours = { id: 'ridepro', price: ourPrice };
    const others = competitors.map(c => ({ id: c.id, price: Math.round(ourPrice * c.mult) }));
    const all = [ours, ...others];
    return all.reduce((min, x) => (x.price < min.price ? x : min), ours);
  }, [ourPrice, competitors]);

  return (
    <View style={compareStyles.card}>
      <View style={compareStyles.header}>
        <View>
          <Text style={compareStyles.title}>Compare & Book</Text>
          <Text style={compareStyles.subtitle}>
            {vehicleLabel ? `${vehicleLabel} · live prices` : 'RidePro vs other apps · live prices'}
          </Text>
        </View>
        {cheapest.id === 'ridepro' && (
          <View style={compareStyles.cheapestBadge}>
            <Ionicons name="trophy" size={11} color="#fff" />
            <Text style={compareStyles.cheapestText}>BEST VALUE</Text>
          </View>
        )}
      </View>

      {/* Our row */}
      <LinearGradient colors={['#1E88E5', '#6A11CB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={compareStyles.ourRow}>
        <View style={compareStyles.brandDotOurs}>
          <MaterialCommunityIcons name="lightning-bolt" size={16} color="#1E88E5" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={compareStyles.ourName}>RidePro</Text>
          <Text style={compareStyles.ourSub}>Book in this app · OTP delivered here</Text>
        </View>
        <Text style={compareStyles.ourPrice}>₹{ourPrice}</Text>
      </LinearGradient>

      {competitors.map(c => {
        const price = Math.round(ourPrice * c.mult);
        const diff = price - ourPrice;
        return (
          <View key={c.id} style={compareStyles.row}>
            <View style={[compareStyles.brandDot, { backgroundColor: c.brand }]}>
              <Text style={compareStyles.brandLetter}>{c.letter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={compareStyles.compName}>{c.name}</Text>
              <Text style={compareStyles.compSub}>
                {diff > 0 ? `+₹${diff} vs RidePro` : diff < 0 ? `₹${-diff} cheaper` : 'Same price'}
              </Text>
            </View>
            <Text style={compareStyles.compPrice}>₹{price}</Text>
            <TouchableOpacity style={compareStyles.openBtn} onPress={() => open(c)} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={14} color="#1E88E5" />
              <Text style={compareStyles.openBtnText}>Open</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Text style={compareStyles.note}>
        ✓ OTP & live tracking only available when you book in RidePro.
      </Text>
    </View>
  );
}

function CancelRideButton({ onCancel }: { onCancel: () => void }) {
  return (
    <TouchableOpacity onPress={onCancel} activeOpacity={0.8} style={cancelStyles.btn}>
      <Ionicons name="close-circle-outline" size={18} color="#d32f2f" />
      <Text style={cancelStyles.text}>Cancel Ride</Text>
    </TouchableOpacity>
  );
}

const cancelStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 14, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ffcdd2',
  },
  text: { color: '#d32f2f', fontWeight: '900', fontSize: 14 },
});

function PrimaryButton({ onPress, label, icon, disabled }: { onPress: () => void; label: string; icon?: any; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.9} style={{ width: '100%', marginTop: 12, opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient
        colors={disabled ? ['#999', '#777'] : ['#111', '#1E88E5']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={primaryBtnStyle.button}
      >
        {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} />}
        <Text style={primaryBtnStyle.text}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function Chip({ active, onPress, label, icon, disabled }: { active: boolean; onPress: () => void; label: string; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const primaryBtnStyle = StyleSheet.create({
  button: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, borderRadius: 16, width: '100%',
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  text: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

const compareStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 22, padding: 16, marginTop: 6, marginBottom: 12,
    borderWidth: 1, borderColor: '#eef0f5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '900', color: '#111' },
  subtitle: { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 2 },
  cheapestBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2e7d32', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
  cheapestText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  ourRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 10, gap: 12 },
  brandDotOurs: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ourName: { color: '#fff', fontSize: 15, fontWeight: '900' },
  ourSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  ourPrice: { color: '#fff', fontSize: 18, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f2f6', gap: 12 },
  brandDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#fff', fontSize: 16, fontWeight: '900' },
  compName: { fontSize: 14, fontWeight: '800', color: '#111' },
  compSub: { fontSize: 11, color: '#888', fontWeight: '600', marginTop: 2 },
  compPrice: { fontSize: 15, fontWeight: '800', color: '#111' },
  openBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  openBtnText: { color: '#1E88E5', fontWeight: '900', fontSize: 12 },
  note: { fontSize: 11, color: '#999', marginTop: 12, fontStyle: 'italic', textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8, zIndex: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  backButton: { backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  walletBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 30, elevation: 10, gap: 6 },
  walletText: { fontWeight: '800', fontSize: 14, color: '#2e7d32' },

  sheetTitle: { fontSize: 24, fontWeight: '800', marginBottom: 5, color: '#1a1a1a' },
  subtitle: { color: '#666', fontSize: 14, marginBottom: 15 },
  routeCard: { backgroundColor: '#f5f5f5', borderRadius: 15, padding: 14, marginBottom: 14 },
  routeLine: { width: 2, height: 18, backgroundColor: '#ddd', marginLeft: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  locationText: { color: '#000', fontSize: 16, fontWeight: '500', flex: 1 },
  placeholderText: { color: '#888', fontSize: 16, flex: 1 },

  centerContent: { alignItems: 'center', padding: 10 },
  searchingTitle: { fontSize: 18, fontWeight: '600', marginTop: 15, marginBottom: 5 },
  secondaryButton: { marginTop: 15, alignSelf: 'center' },
  secondaryButtonText: { color: '#d32f2f', fontWeight: 'bold' },

  acceptedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  otpContainer: { alignItems: 'center', backgroundColor: '#f0f0f0', padding: 10, borderRadius: 14, width: 90 },
  otpLabel: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  otpValue: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: 1 },

  largeOtpBox: { paddingHorizontal: 30, paddingVertical: 18, borderRadius: 20, marginVertical: 20, shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  largeOtpText: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 6 },

  driverCard: { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 18, marginTop: 10, borderWidth: 1, borderColor: '#eee', width: '100%', alignItems: 'center' },
  driverInfoRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center' },
  driverNameText: { fontSize: 18, fontWeight: '700' },
  carNumberText: { color: '#666', fontSize: 13 },
  callButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fce4ec', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8, borderWidth: 1, borderColor: '#ff4081', gap: 4 },
  verifiedText: { color: '#ff4081', fontSize: 10, fontWeight: 'bold' },

  statusBadgeWrap: { backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, marginBottom: 10 },
  statusBadge: { color: '#2e7d32', fontWeight: 'bold' },
  statusBadgeOngoingWrap: { backgroundColor: '#e3f2fd', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, marginBottom: 10 },
  statusBadgeOngoing: { color: '#1976d2', fontWeight: 'bold' },

  completionEmoji: { fontSize: 50, marginBottom: 10 },

  modalOverlay: { flex: 1, backgroundColor: '#fff' },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee', marginTop: 10 },
  searchBar: { flex: 1, backgroundColor: '#f0f0f0', padding: 15, borderRadius: 10, fontSize: 16, marginRight: 10 },
  closeTextBtn: { padding: 5 },
  liveLocationOption: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  liveLocationText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
  resultItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  resultName: { fontSize: 16, color: '#333' },

  fareContainer: { backgroundColor: '#e8f5e9', padding: 15, borderRadius: 15, width: '100%', alignItems: 'center', marginBottom: 15 },
  fareText: { fontSize: 20, fontWeight: 'bold', color: '#2e7d32' },
  splitText: { fontSize: 16, color: '#2e7d32', marginTop: 5, fontWeight: '600' },
  splitInputContainer: { flexDirection: 'row', width: '100%', marginBottom: 10 },
  splitInput: { flex: 1, backgroundColor: '#f0f0f0', padding: 12, borderRadius: 10, marginRight: 10 },
  addButton: { backgroundColor: '#000', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 10 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  splitUsersList: { width: '100%', backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  splitUsersTitle: { fontSize: 12, color: '#666', fontWeight: 'bold', marginBottom: 5 },
  splitUsersNames: { fontSize: 14, color: '#333', fontWeight: '500' },

  poolBanner: { backgroundColor: '#e8f5e9', padding: 14, borderRadius: 15, width: '100%', alignItems: 'center', marginVertical: 10, borderWidth: 1, borderColor: '#c8e6c9' },
  poolBannerTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32' },
  poolBannerText: { fontSize: 14, color: '#333', textAlign: 'center', marginTop: 4 },
  poolBannerSave: { fontSize: 14, fontWeight: 'bold', color: '#2e7d32', marginTop: 5 },

  safetyToolkit: { position: 'absolute', right: 16, zIndex: 10, alignItems: 'flex-end', gap: 8 },
  safetyButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, elevation: 5, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  safetyText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  paymentSection: { width: '100%', alignItems: 'center' },
  paymentSubtitle: { fontSize: 16, color: '#666', marginBottom: 15, fontWeight: '500' },
  paymentOptionsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  paymentMethodCard: { flex: 1, backgroundColor: '#f9f9f9', padding: 18, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#eee', gap: 8 },
  paymentMethodText: { fontWeight: 'bold', color: '#333' },
  cashButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ccc', paddingVertical: 16, borderRadius: 15, marginTop: 14 },
  successText: { color: '#2e7d32', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  qrContainer: { alignItems: 'center', width: '100%' },
  qrBox: { backgroundColor: '#f5f5f5', padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 15, width: 220, borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  qrText: { fontWeight: 'bold', marginTop: 10, color: '#333' },

  schedulesContainer: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  schedulesTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  scheduleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },

  savedSection: { padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  savedPlacesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 10 },
  savedPlaceCard: { width: '30%', backgroundColor: '#f9f9f9', padding: 12, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  savedPlaceIcon: { fontSize: 24, marginBottom: 5 },
  savedPlaceLabel: { fontWeight: 'bold', color: '#333', fontSize: 13 },
  recentSearchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  recentSearchName: { fontSize: 15, color: '#333', flex: 1 },

  mlCard: { padding: 16, borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: '#bbdefb' },
  chipScroll: { flexDirection: 'row', marginVertical: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginRight: 10, height: 40, gap: 6 },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  chipTextActive: { color: '#fff' },
  mlCompactTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', gap: 4 },
  mlCompactTagActive: { backgroundColor: '#1E88E5', borderColor: '#1E88E5' },
  mlCompactTagText: { fontSize: 11, color: '#666', fontWeight: 'bold' },
  mlTagTextActive: { color: '#fff' },

  etaPill: { position: 'absolute', alignSelf: 'center', zIndex: 5 },
  etaGradient: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, gap: 6,
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  etaText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // === Clean booking layout ===
  h1: { fontSize: 26, fontWeight: '900', color: '#0a0a0a', letterSpacing: -0.4 },
  h1Sub: { fontSize: 14, color: '#666', fontWeight: '500', marginTop: 4 },
  sectionH: { fontSize: 12, fontWeight: '900', color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  cardClean: {
    backgroundColor: '#fff', borderRadius: 18, padding: 4,
    borderWidth: 1, borderColor: '#eef0f5',
    shadowColor: '#0a1628', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardSurge: { backgroundColor: '#d32f2f', borderColor: '#b71c1c', padding: 14 },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 14 },
  routeDotWrap: { width: 24, alignItems: 'center' },
  routeDotOuter: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  routeDotInner: { width: 6, height: 6, borderRadius: 3 },
  routeSquare: { width: 14, height: 14, backgroundColor: '#d32f2f', borderRadius: 3 },
  routeRowDivider: { flexDirection: 'row', alignItems: 'center', marginLeft: 18, marginRight: 14, height: 24 },
  routeRowDots: { flex: 1, height: 0, borderStyle: 'dashed', borderTopWidth: 1, borderColor: '#dde1e8' },
  routeSwapClean: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e3f2fd', borderWidth: 1, borderColor: '#bbdefb' },
  routeRowLabelClean: { fontSize: 11, fontWeight: '900', color: '#9aa0a6', letterSpacing: 1 },
  routeRowValueClean: { fontSize: 16, fontWeight: '700', color: '#0a0a0a', marginTop: 2 },
  routeRowValuePhClean: { fontSize: 16, fontWeight: '600', color: '#aaa', marginTop: 2 },

  // Vehicle list rows
  vehicleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, borderRadius: 14 },
  vehicleRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f2f6' },
  vehicleRowActive: { backgroundColor: '#e3f2fd' },
  vehicleIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f7fb', alignItems: 'center', justifyContent: 'center' },
  vehicleLabel: { fontSize: 16, fontWeight: '900', color: '#0a0a0a' },
  vehicleSub: { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 2 },
  vehiclePrice: { fontSize: 17, fontWeight: '900', color: '#0a0a0a' },

  // AI price card
  aiBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center' },
  aiLabel: { fontSize: 13, fontWeight: '900', color: '#0a0a0a', letterSpacing: 0.2 },
  aiSub: { fontSize: 11, color: '#666', fontWeight: '500', marginTop: 2 },
  aiPrice: { fontSize: 26, fontWeight: '900', color: '#0a0a0a' },
  factTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f7fb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4, borderWidth: 1, borderColor: '#eef0f5' },
  factTagActive: { backgroundColor: '#1E88E5', borderColor: '#1E88E5' },
  factTagText: { fontSize: 11, color: '#666', fontWeight: '800' },

  // Schedule rows
  scheduleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  scheduleRowTitle: { fontSize: 14, fontWeight: '800', color: '#0a0a0a' },
  scheduleRowSub: { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 2 },
  scheduleSimBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0a0a0a', borderRadius: 10 },
  scheduleSimBtnText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.4 },

  // Vibrant idle hero
  heroBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: 22, marginBottom: 18,
    shadowColor: '#6A11CB', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4, letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 4 },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },

  // Vibrant route card
  routeCardVibrant: {
    backgroundColor: '#fff', borderRadius: 20, padding: 8, marginBottom: 16,
    elevation: 6, shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 14,
    borderWidth: 1, borderColor: '#eef0f5',
  },
  routeRowVibrant: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 14 },
  routeIconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  routeIconDot: { width: 12, height: 12, borderRadius: 6 },
  routeRowLabel: { fontSize: 10, fontWeight: '900', color: '#888', letterSpacing: 1.2 },
  routeRowValue: { fontSize: 15, fontWeight: '800', color: '#111', marginTop: 2 },
  routeRowValuePh: { fontSize: 15, fontWeight: '600', color: '#aaa', marginTop: 2 },
  routeDivider: { flexDirection: 'row', alignItems: 'center', marginLeft: 24 },
  routeDividerLine: { flex: 1, height: 1, backgroundColor: '#eef0f5' },
  routeSwapBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#e3f2fd',
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 10,
    borderWidth: 1, borderColor: '#bbdefb',
  },

  sectionLabel: { fontSize: 12, fontWeight: '900', color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 10 },

  rideTypeCard: {
    width: 110, padding: 14, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#eef0f5',
  },
  rideTypeCardActive: {
    borderColor: 'transparent',
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  rideTypeLabel: { fontSize: 13, fontWeight: '900', color: '#111', marginTop: 8 },
  rideTypeSub: { fontSize: 10, fontWeight: '700', color: '#888', marginTop: 2 },
  rideTypePrice: { fontSize: 16, fontWeight: '900', color: '#111', marginTop: 6 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  ratingSheet: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 50, height: 5, borderRadius: 3, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 16 },
  ratingTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#111' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 24 },
  tipTitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 10, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 18 },
  tipChip: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  tipChipActive: { backgroundColor: '#1E88E5', borderColor: '#1E88E5' },
  tipChipText: { fontWeight: '800', color: '#333' },
});
