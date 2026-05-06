import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRide, SavedPlace } from '../context/RideContext';
import { searchAddress, getAddressFromCoords } from '../utils/locationUtils';
import { goBack } from '../utils/nav';

const ICON_PRESETS = ['🏠', '🎓', '🏢', '🏋️', '🛒', '🍽️', '✈️', '🏥', '🎬', '⛽', '🌳', '📍'];

export default function PlacesScreen() {
  const router = useRouter();
  const { savedPlaces, addSavedPlace, updateSavedPlace, removeSavedPlace } = useRide();

  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<SavedPlace | null>(null);

  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('📍');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pickedLocation, setPickedLocation] = useState<{ name: string; latitude: number; longitude: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUsingLive, setIsUsingLive] = useState(false);

  const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
    Haptics.impactAsync(style).catch(() => {});

  const openCreate = () => {
    tap();
    setEditing(null);
    setLabel('');
    setIcon('📍');
    setPickedLocation(null);
    setSearchQuery('');
    setSearchResults([]);
    setEditorVisible(true);
  };

  const openEdit = (p: SavedPlace) => {
    tap();
    setEditing(p);
    setLabel(p.label);
    setIcon(p.icon);
    setPickedLocation({ name: p.location.name, latitude: p.location.latitude, longitude: p.location.longitude });
    setSearchQuery('');
    setSearchResults([]);
    setEditorVisible(true);
  };

  const confirmDelete = (p: SavedPlace) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Delete saved place?',
      `Remove "${p.label}" from your saved places?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeSavedPlace(p.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ]
    );
  };

  const onSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length <= 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchAddress(text);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const useLiveLocation = async () => {
    setIsUsingLive(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const address = await getAddressFromCoords(loc.coords.latitude, loc.coords.longitude);
      setPickedLocation({ name: address, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setSearchQuery(address);
      setSearchResults([]);
    } catch {
      Alert.alert('Error', 'Could not fetch live location.');
    } finally {
      setIsUsingLive(false);
    }
  };

  const save = () => {
    if (!label.trim()) {
      Alert.alert('Missing label', 'Give this place a short tag like "Home" or "Gym".');
      return;
    }
    if (!pickedLocation) {
      Alert.alert('Missing location', 'Search for an address or use your current location.');
      return;
    }

    if (editing) {
      updateSavedPlace(editing.id, { label: label.trim(), icon, location: pickedLocation });
    } else {
      addSavedPlace({
        id: Date.now().toString(),
        label: label.trim(),
        icon,
        location: pickedLocation,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setEditorVisible(false);
  };

  const renderItem = ({ item }: { item: SavedPlace }) => (
    <View style={styles.placeCard}>
      <View style={styles.placeIconWrap}>
        <Text style={styles.placeIcon}>{item.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.placeLabel}>{item.label}</Text>
        <Text style={styles.placeAddress} numberOfLines={1}>{item.location.name}</Text>
      </View>
      <TouchableOpacity style={[styles.placeActionBtn, { backgroundColor: '#e3f2fd' }]} onPress={() => openEdit(item)}>
        <Ionicons name="pencil" size={16} color="#1E88E5" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.placeActionBtn, { backgroundColor: '#ffebee', marginLeft: 8 }]} onPress={() => confirmDelete(item)}>
        <Ionicons name="trash" size={16} color="#d32f2f" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBack()}>
          <Ionicons name="chevron-back" size={20} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Places</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#1E88E5" />
        </TouchableOpacity>
      </View>

      {savedPlaces.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons name="map-marker-plus-outline" size={56} color="#1E88E5" />
          </View>
          <Text style={styles.emptyText}>No saved places yet</Text>
          <Text style={styles.emptySub}>Add places you visit often to book in one tap.</Text>
          <TouchableOpacity onPress={openCreate} activeOpacity={0.9}>
            <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyCta}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyCtaText}>Add a place</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={savedPlaces}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {savedPlaces.length > 0 && (
        <TouchableOpacity onPress={openCreate} activeOpacity={0.9} style={styles.fabWrap}>
          <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.fabText}>Add place</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Create / Edit modal */}
      <Modal visible={editorVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editing ? 'Edit Place' : 'New Saved Place'}</Text>
            <Text style={styles.modalSub}>{editing ? 'Update the label, icon or address.' : 'Pick a tag and address.'}</Text>

            <ScrollView style={{ maxHeight: 480, marginTop: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Label</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Home, Gym, Mom's"
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {ICON_PRESETS.map(em => (
                  <TouchableOpacity
                    key={em}
                    style={[styles.iconChip, icon === em && styles.iconChipActive]}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setIcon(em); }}
                  >
                    <Text style={{ fontSize: 22 }}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Address</Text>
              <View style={styles.addressRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={searchQuery}
                  onChangeText={onSearch}
                  placeholder="Search for an address"
                />
                <TouchableOpacity style={styles.liveBtn} onPress={useLiveLocation} disabled={isUsingLive}>
                  {isUsingLive ? <ActivityIndicator size="small" color="#1E88E5" /> : <Ionicons name="locate" size={18} color="#1E88E5" />}
                </TouchableOpacity>
              </View>

              {pickedLocation && !searchResults.length && (
                <View style={styles.pickedBox}>
                  <Ionicons name="checkmark-circle" size={16} color="#2e7d32" />
                  <Text style={styles.pickedText} numberOfLines={2}>{pickedLocation.name}</Text>
                </View>
              )}

              {isSearching && <ActivityIndicator style={{ marginTop: 12 }} />}

              {searchResults.map((r, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.resultItem}
                  onPress={() => {
                    setPickedLocation({ name: r.name, latitude: r.latitude, longitude: r.longitude });
                    setSearchQuery(r.name);
                    setSearchResults([]);
                  }}
                >
                  <Ionicons name="location-outline" size={18} color="#1E88E5" />
                  <Text style={styles.resultText} numberOfLines={2}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditorVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} activeOpacity={0.9} style={{ flex: 1 }}>
                <LinearGradient colors={['#111', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Add place'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#111' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 6 },
  emptySub: { color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, gap: 8 },
  emptyCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  placeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 14, borderRadius: 18, gap: 12,
    borderWidth: 1, borderColor: '#eef0f5',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  placeIconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f5f7fb', alignItems: 'center', justifyContent: 'center' },
  placeIcon: { fontSize: 26 },
  placeLabel: { fontSize: 16, fontWeight: '900', color: '#111' },
  placeAddress: { fontSize: 12, color: '#888', marginTop: 2 },
  placeActionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  fabWrap: { position: 'absolute', bottom: 28, right: 20, left: 20 },
  fab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  fabText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 30 },
  modalHandle: { width: 50, height: 5, borderRadius: 3, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#111' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '900', color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#f5f7fb', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, fontSize: 16, color: '#111', borderWidth: 1, borderColor: '#eef0f5' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChip: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f7fb', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eef0f5' },
  iconChipActive: { backgroundColor: '#e3f2fd', borderColor: '#1E88E5' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center' },
  pickedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', padding: 12, borderRadius: 12, marginTop: 10, gap: 8, borderWidth: 1, borderColor: '#c8e6c9' },
  pickedText: { color: '#2e7d32', fontWeight: '700', flex: 1 },
  resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginTop: 8, gap: 10, borderWidth: 1, borderColor: '#eef0f5' },
  resultText: { fontSize: 14, color: '#333', flex: 1 },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 18 },
  cancelBtnText: { color: '#666', fontWeight: '800' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
