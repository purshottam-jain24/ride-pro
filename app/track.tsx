import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapComponent from '../components/MapComponent';
import { db } from '../FirebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { getRoadRoute } from '../utils/locationUtils';

export default function TrackRide() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [rideData, setRideData] = useState<any>(null);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Listen to the specific ride ID in Firestore
    const unsubscribe = onSnapshot(doc(db, 'active_rides', id as string), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRideData(data);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (rideData?.pickup && rideData?.dropoff) {
      getRoadRoute(
        { lat: rideData.pickup.latitude, lon: rideData.pickup.longitude },
        { lat: rideData.dropoff.latitude, lon: rideData.dropoff.longitude }
      ).then(setRouteCoords);
    }
  }, [rideData?.pickup, rideData?.dropoff]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 10 }}>Connecting to Live Feed...</Text>
      </SafeAreaView>
    );
  }

  if (!rideData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Live Tracking</Text>
        </View>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
          <Text style={{fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20}}>
            No active ride found for this tracking link. The ride may have completed.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.button}>
            <Text style={styles.buttonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusText = () => {
    const s = rideData.status;
    if (s === 'ongoing') return 'En route to destination';
    if (s === 'arrived') return 'Waiting at pickup location';
    if (s === 'accepted') return 'Driver is arriving soon';
    if (s === 'completed') return 'Ride has been completed';
    return 'Connecting to ride...';
  };

  return (
    <View style={styles.container}>
      <MapComponent 
        style={styles.map} 
        pickup={rideData.pickup} 
        dropoff={rideData.dropoff} 
        routeCoordinates={routeCoords}
        driverLocation={rideData.driverLocation}
      />
      
      <SafeAreaView style={styles.overlay}>
        <View style={styles.headerCard}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {rideData.status !== 'completed' && <View style={styles.liveIndicator} />}
            <Text style={styles.title}>Live Tracking</Text>
          </View>
          <Text style={styles.subtitle}>Watching {rideData.passengerName}'s Ride</Text>
        </View>
      </SafeAreaView>

      <View style={styles.bottomSheet}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <View style={styles.liveDotInline} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        <View style={styles.driverInfo}>
          <View style={styles.driverIconBubble}>
            <MaterialCommunityIcons name="car-side" size={28} color="#1E88E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#111' }}>{rideData.driverName || 'Driver'}</Text>
            <Text style={{ color: '#666', fontSize: 14, marginTop: 2 }}>White Toyota Prius · DL 01 AB 1234</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffde7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Ionicons name="star" size={12} color="#f9a825" />
            <Text style={{ color: '#f57c00', fontWeight: '900', fontSize: 12, marginLeft: 3 }}>4.9</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.9}>
          <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Get RidePro App</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  map: { flex: 1 },
  header: { padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  overlay: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10 },
  headerCard: { backgroundColor: '#fff', padding: 18, borderRadius: 15, elevation: 5, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 5 },
  liveIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d32f2f', marginRight: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, elevation: 20, paddingBottom: 40 },
  statusText: { fontSize: 18, fontWeight: '900', color: '#1E88E5' },
  liveDotInline: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d32f2f' },
  driverInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 16, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#eee', gap: 14 },
  driverIconBubble: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
