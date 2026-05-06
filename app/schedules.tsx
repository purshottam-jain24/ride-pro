import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRide } from '../context/RideContext';
import { goBack } from '../utils/nav';

export default function SchedulesApp() {
  const router = useRouter();
  const { schedules, toggleSchedule, deleteSchedule } = useRide();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBack()}>
          <Ionicons name="chevron-back" size={20} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Scheduled Rides</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {schedules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={56} color="#e65100" />
            </View>
            <Text style={styles.emptyTitle}>No Schedules Yet</Text>
            <Text style={styles.emptyDesc}>Set up daily commutes from the passenger screen and never miss a ride.</Text>
            <TouchableOpacity onPress={() => router.push('/passenger')} activeOpacity={0.9}>
              <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyCta}>
                <Ionicons name="car" size={18} color="#fff" />
                <Text style={styles.emptyCtaText}>Book a Ride</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          schedules.map(schedule => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, !schedule.isActive && styles.badgePaused]}>
                  <View style={[styles.badgeDot, { backgroundColor: schedule.isActive ? '#2e7d32' : '#999' }]} />
                  <Text style={[styles.badgeText, !schedule.isActive && { color: '#666' }]}>
                    {schedule.isActive ? 'Active' : 'Paused'}
                  </Text>
                </View>
                <Switch
                  value={schedule.isActive}
                  onValueChange={() => { Haptics.selectionAsync().catch(() => {}); toggleSchedule(schedule.id); }}
                  trackColor={{ false: '#e0e0e0', true: '#2e7d32' }}
                />
              </View>

              <View style={styles.routeContainer}>
                <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: '#2e7d32' }]} />
                  <Text style={styles.locationText} numberOfLines={1}>{schedule.pickup.name}</Text>
                </View>
                <View style={styles.locationLine} />
                <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: '#d32f2f' }]} />
                  <Text style={styles.locationText} numberOfLines={1}>{schedule.dropoff.name}</Text>
                </View>
              </View>

              <View style={styles.timeContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="time-outline" size={16} color="#1E88E5" />
                  <Text style={styles.timeText}>{schedule.time}</Text>
                </View>
                <Text style={styles.daysText}>
                  {schedule.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(' · ')}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); deleteSchedule(schedule.id); }}
              >
                <Ionicons name="trash-outline" size={14} color="#d32f2f" />
                <Text style={styles.deleteButtonText}> Delete Schedule</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#111' },
  content: { flex: 1, padding: 20 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 30 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff3e0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8, color: '#111' },
  emptyDesc: { color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, gap: 8 },
  emptyCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  scheduleCard: { backgroundColor: '#fff', padding: 20, borderRadius: 18, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
  badgePaused: { backgroundColor: '#f0f0f0' },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: '#2e7d32', fontWeight: 'bold', fontSize: 12 },
  routeContainer: { backgroundColor: '#f9f9f9', padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#eee' },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  locationText: { fontSize: 14, fontWeight: '600', flex: 1, color: '#333' },
  locationLine: { width: 2, height: 16, backgroundColor: '#ddd', marginLeft: 3, marginVertical: 2 },
  timeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  timeText: { fontSize: 16, fontWeight: '800', color: '#111' },
  daysText: { color: '#666', fontSize: 13, fontWeight: '600' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#ffebee', borderRadius: 12, borderWidth: 1, borderColor: '#ffcdd2' },
  deleteButtonText: { color: '#d32f2f', fontWeight: 'bold' },
});
