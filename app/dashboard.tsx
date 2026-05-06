import { useRouter } from 'expo-router';
import React, { useState, useMemo, useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRide } from '../context/RideContext';

export default function RoleSelection() {
  const router = useRouter();
  const {
    savedPlaces,
    widgetPickupId,
    widgetDropoffId,
    setWidgetPickupId,
    setWidgetDropoffId,
    passengerWallet,
    currentUserName,
    rideHistory,
    userRole,
  } = useRide();

  // Drivers don't have a dashboard — bounce to driver UI.
  useEffect(() => {
    if (userRole === 'driver') router.replace('/driver');
  }, [userRole]);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<'pickup' | 'dropoff'>('pickup');

  const widgetPickup = useMemo(
    () => savedPlaces.find(p => p.id === widgetPickupId) || savedPlaces[0],
    [savedPlaces, widgetPickupId]
  );
  const widgetDropoff = useMemo(
    () => savedPlaces.find(p => p.id === widgetDropoffId) || savedPlaces[1],
    [savedPlaces, widgetDropoffId]
  );

  const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
    Haptics.impactAsync(style).catch(() => {});

  const launchWidget = () => {
    if (!widgetPickup || !widgetDropoff) return;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    router.push(
      `/passenger?pickupName=${encodeURIComponent(widgetPickup.label)}&dropoffName=${encodeURIComponent(widgetDropoff.label)}`
    );
  };

  const openEditor = (mode: 'pickup' | 'dropoff') => {
    tap();
    setEditorMode(mode);
    setEditorVisible(true);
  };

  const pickPlace = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (editorMode === 'pickup') setWidgetPickupId(id);
    else setWidgetDropoffId(id);
    setEditorVisible(false);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const lastTrip = rideHistory[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greet}>{greeting},</Text>
            <Text style={styles.greetName} numberOfLines={1}>{currentUserName?.split(' ')[0] || 'there'} ✦</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.walletPill}>
              <MaterialCommunityIcons name="wallet" size={14} color="#2e7d32" />
              <Text style={styles.walletPillText}>₹{passengerWallet}</Text>
            </View>
            <TouchableOpacity style={styles.profilePill} onPress={() => { tap(); router.push('/profile'); }}>
              <Ionicons name="person-circle-outline" size={26} color="#1E88E5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* "Where to?" hero search */}
        <Pressable onPress={() => { tap(); router.push('/passenger'); }}>
          {({ pressed }) => (
            <LinearGradient
              colors={['#0d47a1', '#1E88E5', '#6A11CB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.searchHero, pressed && { transform: [{ scale: 0.99 }] }]}
            >
              <View style={styles.searchHeroLeft}>
                <View style={styles.searchIconBubble}>
                  <Ionicons name="search" size={20} color="#0d47a1" />
                </View>
                <View>
                  <Text style={styles.searchHeroLabel}>WHERE TO?</Text>
                  <Text style={styles.searchHeroSub}>Tap to book a ride now</Text>
                </View>
              </View>
              <View style={styles.searchTimePill}>
                <Ionicons name="time-outline" size={12} color="#0d47a1" />
                <Text style={styles.searchTimeText}>Now</Text>
              </View>
            </LinearGradient>
          )}
        </Pressable>

        {/* Saved places strip */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
          <Text style={[styles.sectionHeader, { marginBottom: 0, marginTop: 0 }]}>Saved Places</Text>
          <TouchableOpacity onPress={() => { tap(); router.push('/places'); }} style={styles.manageBtn}>
            <Ionicons name="options-outline" size={14} color="#1E88E5" />
            <Text style={styles.manageBtnText}>Manage</Text>
          </TouchableOpacity>
        </View>
        {savedPlaces.length === 0 ? (
          <TouchableOpacity style={styles.savedEmpty} onPress={() => { tap(); router.push('/places'); }} activeOpacity={0.85}>
            <View style={styles.savedEmptyIcon}>
              <Ionicons name="location-outline" size={20} color="#1E88E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedEmptyTitle}>No saved places yet</Text>
              <Text style={styles.savedEmptySub}>Add Home, Work, Gym — book in one tap.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#1E88E5" />
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
            {savedPlaces.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.placeChip}
                onPress={() => {
                  tap();
                  router.push(`/passenger?prefillDropoff=${encodeURIComponent(p.label)}`);
                }}
                onLongPress={() => { tap(Haptics.ImpactFeedbackStyle.Medium); router.push('/places'); }}
              >
                <Text style={styles.placeChipIcon}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.placeChipLabel} numberOfLines={1}>{p.label}</Text>
                  <Text style={styles.placeChipSub} numberOfLines={1}>{p.location.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.placeChipAdd} onPress={() => { tap(); router.push('/places'); }}>
              <Ionicons name="add" size={22} color="#1E88E5" />
              <Text style={styles.placeChipAddText}>Add</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {widgetPickup && widgetDropoff && (
        <>
        <Text style={styles.sectionHeader}>1-Tap Commute</Text>

        <Pressable onPress={launchWidget} disabled={!widgetPickup || !widgetDropoff}>
          {({ pressed }) => (
            <LinearGradient
              colors={['#1E88E5', '#6A11CB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.widgetCard, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={styles.widgetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color="#fff" />
                  <Text style={styles.widgetTitle}>Quick Book</Text>
                </View>
                <TouchableOpacity
                  style={styles.widgetEditBtn}
                  onPress={(e) => { e.stopPropagation?.(); openEditor('pickup'); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="settings-outline" size={14} color="#fff" />
                  <Text style={styles.widgetEditText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.widgetRoute}>
                <TouchableOpacity
                  style={styles.locationPill}
                  onPress={(e) => { e.stopPropagation?.(); openEditor('pickup'); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.locationPillIcon}>{widgetPickup?.icon || '📍'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pillLabel}>FROM</Text>
                    <Text style={styles.widgetLocation} numberOfLines={1}>
                      {widgetPickup?.label || 'Set pickup'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginHorizontal: 6 }} />

                <TouchableOpacity
                  style={styles.locationPill}
                  onPress={(e) => { e.stopPropagation?.(); openEditor('dropoff'); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.locationPillIcon}>{widgetDropoff?.icon || '🏁'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pillLabel}>TO</Text>
                    <Text style={styles.widgetLocation} numberOfLines={1}>
                      {widgetDropoff?.label || 'Set dropoff'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.widgetFooter}>
                <Text style={styles.widgetHint}>Tap card to book instantly</Text>
              </View>
            </LinearGradient>
          )}
        </Pressable>
        </>
        )}

        {/* Services row — Uber-style service tiles */}
        <Text style={styles.sectionHeader}>Services</Text>
        <View style={styles.servicesGrid}>
          <ServiceTile
            label="Ride"
            sub="Solo or shared"
            colors={['#fff', '#fff']}
            iconColor="#1E88E5"
            iconBg="#e3f2fd"
            icon={<FontAwesome5 name="car" size={20} color="#1E88E5" />}
            onPress={() => { tap(); router.push('/passenger'); }}
          />
          <ServiceTile
            label="History"
            sub={lastTrip ? `Last: ₹${lastTrip.fare}` : 'Past rides'}
            colors={['#e8f5e9', '#e8f5e9']}
            iconColor="#2e7d32"
            iconBg="#c8e6c9"
            icon={<Ionicons name="time-outline" size={22} color="#2e7d32" />}
            onPress={() => { tap(); router.push('/history'); }}
          />
          <ServiceTile
            label="Schedules"
            sub="Daily routes"
            colors={['#fff3e0', '#fff3e0']}
            iconColor="#e65100"
            iconBg="#ffe0b2"
            icon={<Ionicons name="calendar-outline" size={22} color="#e65100" />}
            onPress={() => { tap(); router.push('/schedules'); }}
          />

          <ServiceTile
            label="Saved Places"
            sub={`${savedPlaces.length} saved`}
            colors={['#f3e5f5', '#f3e5f5']}
            iconColor="#7b1fa2"
            iconBg="#e1bee7"
            icon={<Ionicons name="bookmark" size={22} color="#7b1fa2" />}
            onPress={() => { tap(); router.push('/places'); }}
          />
        </View>

        {/* Promo */}
        <LinearGradient
          colors={['#fce4ec', '#f8bbd0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoCard}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="woman" size={16} color="#c2185b" />
              <Text style={styles.promoTitle}>Women-only rides</Text>
            </View>
            <Text style={styles.promoSub}>Verified female drivers, end-to-end protection.</Text>
          </View>
          <TouchableOpacity onPress={() => { tap(); router.push('/passenger'); }} style={styles.promoCta}>
            <Text style={styles.promoCtaText}>Try</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>

      {/* Saved place editor modal */}
      <Modal visible={editorVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Choose {editorMode === 'pickup' ? 'pickup' : 'destination'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Pick from your saved places. Manage them in the Passenger tab.
            </Text>

            <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
              {savedPlaces.map(p => {
                const selected =
                  (editorMode === 'pickup' && p.id === widgetPickupId) ||
                  (editorMode === 'dropoff' && p.id === widgetDropoffId);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.placeRow, selected && styles.placeRowActive]}
                    onPress={() => pickPlace(p.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{p.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeLabel}>{p.label}</Text>
                      <Text style={styles.placeName} numberOfLines={1}>{p.location.name}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color="#1E88E5" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setEditorVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ServiceTile({
  label, sub, icon, iconBg, onPress, colors, textColor, subColor,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  colors: [string, string];
  textColor?: string;
  subColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ width: '48%' }}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tileStyles.card}>
        <View style={[tileStyles.iconBubble, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={[tileStyles.title, textColor && { color: textColor }]}>{label}</Text>
        <Text style={[tileStyles.sub, subColor && { color: subColor }]}>{sub}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const tileStyles = StyleSheet.create({
  card: {
    borderRadius: 22, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  iconBubble: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '900', color: '#111', marginBottom: 2 },
  sub: { fontSize: 12, color: '#666', fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 20, paddingTop: 30, paddingBottom: 60 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greet: { fontSize: 14, color: '#888', fontWeight: '600' },
  greetName: { fontSize: 26, fontWeight: '900', color: '#111', letterSpacing: -0.5 },
  walletPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, gap: 4, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  walletPillText: { color: '#2e7d32', fontWeight: '900', fontSize: 13 },
  profilePill: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },

  searchHero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 24,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14,
    borderWidth: 1, borderColor: '#eef0f5',
  },
  searchHeroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  searchIconBubble: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  searchHeroLabel: { fontSize: 16, fontWeight: '900', color: '#111', letterSpacing: 0.3 },
  searchHeroSub: { fontSize: 12, color: '#888', fontWeight: '500', marginTop: 2 },
  searchTimePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, gap: 4 },
  searchTimeText: { color: '#1E88E5', fontWeight: '800', fontSize: 12 },

  sectionHeader: { fontSize: 12, fontWeight: '900', color: '#999', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginTop: 8 },

  placeChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, marginRight: 10,
    minWidth: 160, maxWidth: 200, gap: 10,
    borderWidth: 1, borderColor: '#eef0f5',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  placeChipIcon: { fontSize: 22 },
  placeChipLabel: { fontSize: 14, fontWeight: '800', color: '#111' },
  placeChipSub: { fontSize: 11, color: '#888', marginTop: 1 },
  placeChipAdd: {
    width: 90, paddingVertical: 14, marginRight: 10, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#e3f2fd',
    borderWidth: 1, borderColor: '#bbdefb', gap: 4,
  },
  placeChipAddText: { color: '#1E88E5', fontWeight: '900', fontSize: 12 },
  savedEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: '#eef0f5',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  savedEmptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center' },
  savedEmptyTitle: { fontSize: 14, fontWeight: '900', color: '#111' },
  savedEmptySub: { fontSize: 12, color: '#666', marginTop: 2 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, gap: 4 },
  manageBtnText: { color: '#1E88E5', fontWeight: '900', fontSize: 12 },

  widgetCard: {
    borderRadius: 24, padding: 20, marginTop: 14, marginBottom: 24,
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 10,
  },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  widgetTitle: { color: '#fff', fontWeight: '900', fontSize: 18, marginLeft: 6 },
  widgetEditBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, gap: 4,
  },
  widgetEditText: { color: '#fff', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  widgetRoute: { flexDirection: 'row', alignItems: 'center' },
  locationPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16,
    flex: 1, gap: 8,
  },
  locationPillIcon: { fontSize: 22 },
  pillLabel: { color: '#1E88E5', fontWeight: '900', fontSize: 9, letterSpacing: 1 },
  widgetLocation: { color: '#0d47a1', fontWeight: '900', fontSize: 14 },
  widgetFooter: { marginTop: 14, alignItems: 'center' },
  widgetHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },

  promoCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 20, marginTop: 8, gap: 12,
  },
  promoTitle: { color: '#c2185b', fontWeight: '900', fontSize: 15 },
  promoSub: { color: '#7b1fa2', fontSize: 12, marginTop: 4, fontWeight: '600' },
  promoCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#c2185b', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14,
  },
  promoCtaText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 50, height: 5, borderRadius: 3, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#111' },
  modalSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#f9f9f9', borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#eee',
  },
  placeRowActive: { backgroundColor: '#e3f2fd', borderColor: '#1E88E5' },
  placeLabel: { fontSize: 16, fontWeight: '800', color: '#111' },
  placeName: { fontSize: 12, color: '#666', marginTop: 2 },
  modalClose: { marginTop: 14, alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  modalCloseText: { color: '#666', fontWeight: '700', fontSize: 15 },
});
