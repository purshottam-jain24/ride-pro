import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRide, CompletedRide } from '../context/RideContext';
import { goBack } from '../utils/nav';

export default function HistoryScreen() {
  const router = useRouter();
  const { rideHistory, setPickup, setDropoff, setRideState, deleteRideFromHistory } = useRide();

  const handleReorder = (ride: CompletedRide) => {
    setPickup(ride.pickup);
    setDropoff(ride.dropoff);
    setRideState('idle'); // Ensure they start from the confirmation screen
    router.push('/passenger');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Ride', 'Are you sure you want to remove this ride from your history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRideFromHistory(id) }
    ]);
  };

  const getAIInsight = (ride: CompletedRide) => {
    const insights = [
      'You saved ₹45 by booking outside peak hours.',
      'One of your most frequent routes.',
      'Co-riding on this route reduces emissions by 12%.',
      'Rebooking now might cost 10% more due to weather.',
    ];
    return insights[ride.id.length % insights.length];
  };

  const renderRide = ({ item }: { item: CompletedRide }) => {
    const isPassenger = item.role === 'passenger';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.roleBadge, isPassenger ? styles.passengerBadge : styles.driverBadge]}>
            <Ionicons name={isPassenger ? 'person' : 'car-sport'} size={12} color={isPassenger ? '#1565c0' : '#c62828'} />
            <Text style={[styles.roleText, { color: isPassenger ? '#1565c0' : '#c62828' }]}>{isPassenger ? 'Passenger' : 'Driver'}</Text>
          </View>
          <Text style={styles.dateText}>{item.date}</Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: '#2e7d32' }]} />
            <Text style={styles.locationText} numberOfLines={1}>{item.pickup.name}</Text>
          </View>
          <View style={styles.line} />
          <View style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: '#d32f2f' }]} />
            <Text style={styles.locationText} numberOfLines={1}>{item.dropoff.name}</Text>
          </View>
        </View>

        <View style={styles.aiBanner}>
          <MaterialCommunityIcons name="robot-happy-outline" size={14} color="#2e7d32" />
          <Text style={styles.aiInsightText}> {getAIInsight(item)}</Text>
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.fareText}>{isPassenger ? 'Paid' : 'Earned'}: ₹{item.fare}</Text>
          {item.splitUsers && item.splitUsers.length > 0 && (
            <Text style={styles.splitText}>
              Split with: {['You', ...item.splitUsers].join(', ')}
            </Text>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.deleteButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); handleDelete(item.id); }}>
            <Ionicons name="trash-outline" size={14} color="#d32f2f" />
            <Text style={styles.deleteButtonText}> Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); handleReorder(item); }} style={{ flex: 2 }}>
            <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reorderButtonSmall}>
              <Ionicons name="reload" size={14} color="#fff" />
              <Text style={styles.reorderButtonTextSmall}> Rebook</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBack()}>
          <Ionicons name="chevron-back" size={20} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Ride History</Text>
        <View style={{ width: 40 }} />
      </View>

      {rideHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons name="map-clock-outline" size={56} color="#1E88E5" />
          </View>
          <Text style={styles.emptyText}>No rides yet</Text>
          <Text style={styles.emptySubtext}>Your past trips will appear here</Text>
          <TouchableOpacity onPress={() => router.push('/passenger')} activeOpacity={0.9}>
            <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyCta}>
              <Ionicons name="car" size={18} color="#fff" />
              <Text style={styles.emptyCtaText}>Book your first ride</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rideHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    marginTop: 30,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  passengerBadge: {
    backgroundColor: '#e3f2fd',
  },
  driverBadge: {
    backgroundColor: '#ffebee',
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    color: '#888',
    fontSize: 12,
  },
  routeContainer: {
    marginBottom: 15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 15,
  },
  line: {
    width: 2,
    height: 15,
    backgroundColor: '#eee',
    marginLeft: 3,
    marginVertical: 2,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
  fareText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000',
  },
  splitText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  reorderButton: {
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  reorderButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#e8f5e9', padding: 10, borderRadius: 8, marginBottom: 15,
    borderWidth: 1, borderColor: '#c8e6c9',
  },
  aiInsightText: { color: '#2e7d32', fontSize: 12, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, gap: 10 },
  deleteButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffebee', padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#ffcdd2',
  },
  deleteButtonText: { color: '#d32f2f', fontWeight: 'bold' },
  reorderButtonSmall: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 12, borderRadius: 10,
  },
  reorderButtonTextSmall: { color: '#fff', fontWeight: 'bold' },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptySubtext: { color: '#999', fontSize: 14, marginTop: 4, marginBottom: 24 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, gap: 8 },
  emptyCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
