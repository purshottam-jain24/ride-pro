import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import { auth, db } from '../FirebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, query, collection, where, limit, deleteDoc } from 'firebase/firestore';

export type RideState = 'idle' | 'searching' | 'accepted' | 'arrived' | 'ongoing' | 'completed';

export interface LocationData {
  latitude: number;
  longitude: number;
  name: string;
}

export interface SavedPlace {
  id: string;
  label: string;
  location: LocationData;
  icon: string;
}

export interface CompletedRide {
  id: string;
  role: 'passenger' | 'driver';
  pickup: LocationData;
  dropoff: LocationData;
  fare: number;
  splitUsers?: string[];
  date: string;
}

export interface PoolMatch {
  name: string;
  savedAmount: number;
  description: string;
}

export interface RideSchedule {
  id: string;
  pickup: LocationData;
  dropoff: LocationData;
  days: number[]; // 0=Sun, 1=Mon...
  time: string; // HH:mm format
  isActive: boolean;
}

interface RideContextType {
  rideState: RideState;
  setRideState: (state: RideState) => void;
  pickup: LocationData | null;
  setPickup: (loc: LocationData | null) => void;
  dropoff: LocationData | null;
  setDropoff: (loc: LocationData | null) => void;
  driverName: string;
  passengerName: string;
  rideOtp: string;
  setRideOtp: (otp: string) => void;
  isFemaleOnly: boolean;
  setIsFemaleOnly: (isFemale: boolean) => void;
  activeDriverGender: 'male' | 'female';
  setActiveDriverGender: (gender: 'male' | 'female') => void;
  passengerGender: 'male' | 'female' | 'other';
  setPassengerGender: (gender: 'male' | 'female' | 'other') => void;
  rideHistory: CompletedRide[];
  addRideToHistory: (ride: CompletedRide) => void;
  deleteRideFromHistory: (id: string) => void;
  isPoolEnabled: boolean;
  setIsPoolEnabled: (enabled: boolean) => void;
  poolMatch: PoolMatch | null;
  setPoolMatch: (match: PoolMatch | null) => void;
  driverLocation: LocationData | null;
  setDriverLocation: React.Dispatch<React.SetStateAction<LocationData | null>>;
  passengerWallet: number;
  setPassengerWallet: React.Dispatch<React.SetStateAction<number>>;
  driverWallet: number;
  setDriverWallet: React.Dispatch<React.SetStateAction<number>>;
  schedules: RideSchedule[];
  addSchedule: (schedule: RideSchedule) => void;
  toggleSchedule: (id: string) => void;
  deleteSchedule: (id: string) => void;
  savedPlaces: SavedPlace[];
  addSavedPlace: (place: SavedPlace) => void;
  updateSavedPlace: (id: string, patch: Partial<Omit<SavedPlace, 'id'>>) => void;
  removeSavedPlace: (id: string) => void;
  recentSearches: LocationData[];
  addRecentSearch: (loc: LocationData) => void;
  clearRecentSearches: () => void;
  currentUserName: string;
  widgetPickupId: string | null;
  widgetDropoffId: string | null;
  setWidgetPickupId: (id: string | null) => void;
  setWidgetDropoffId: (id: string | null) => void;
  userRole: 'passenger' | 'driver' | null;
}

const RideContext = createContext<RideContextType>({} as RideContextType);

export const RideProvider = ({ children }: { children: React.ReactNode }) => {
  const [rideState, setRideState] = useState<RideState>('idle');
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  const [isFemaleOnly, setIsFemaleOnly] = useState<boolean>(false);
  const [activeDriverGender, setActiveDriverGender] = useState<'male' | 'female'>('male');
  const [passengerGender, setPassengerGender] = useState<'male' | 'female' | 'other'>('male');
  const [rideHistory, setRideHistory] = useState<CompletedRide[]>([]);
  const [isPoolEnabled, setIsPoolEnabled] = useState<boolean>(false);
  const [poolMatch, setPoolMatch] = useState<PoolMatch | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationData | null>(null);
  const [passengerWallet, setPassengerWallet] = useState<number>(500);
  const [driverWallet, setDriverWallet] = useState<number>(150);
  const [schedules, setSchedules] = useState<RideSchedule[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentSearches, setRecentSearches] = useState<LocationData[]>([]);
  const [widgetPickupId, setWidgetPickupIdState] = useState<string | null>(null);
  const [widgetDropoffId, setWidgetDropoffIdState] = useState<string | null>(null);
  const [rideOtp, setRideOtp] = useState<string>("----");
  const [currentUserName, setCurrentUserName] = useState<string>('User');
  const [passengerName, setPassengerName] = useState<string>('Passenger');
  const [driverName, setDriverName] = useState<string>('Driver');
  const [userRole, setUserRole] = useState<'passenger' | 'driver' | null>(null);
  const [currentUserGender, setCurrentUserGender] = useState<'male' | 'female' | 'other'>('male');

  // Firebase Data Syncing
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Load data from Firestore when user logs in
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.name) {
              setCurrentUserName(data.name);
            }
            if (data.role) {
              setUserRole(data.role);
            }
            if (data.rideHistory) setRideHistory(data.rideHistory);
            if (data.schedules) setSchedules(data.schedules);
            if (data.role === 'passenger' && data.passengerWallet !== undefined) setPassengerWallet(data.passengerWallet);
            if (data.role === 'driver' && data.driverWallet !== undefined) setDriverWallet(data.driverWallet);
            if (data.savedPlaces) setSavedPlaces(data.savedPlaces);
            if (data.widgetPickupId !== undefined) setWidgetPickupIdState(data.widgetPickupId);
            if (data.widgetDropoffId !== undefined) setWidgetDropoffIdState(data.widgetDropoffId);
            if (data.gender) {
              const g = data.gender.toLowerCase() as 'male' | 'female' | 'other';
              setCurrentUserGender(g);
              if (data.role === 'driver') {
                setActiveDriverGender(g === 'female' ? 'female' : 'male');
              } else {
                setPassengerGender(g);
              }
            }
          }
        } catch (error) {
          console.error("Failed to load user data", error);
        }
      } else {
        setCurrentUserName('Guest');
      }
    });
    return unsubscribe;
  }, []);

  // Helpers to update Firestore when data changes
  const syncToFirestore = async (update: any) => {
    if (auth.currentUser) {
      try {
        const cleanUpdate = JSON.parse(JSON.stringify(update));
        await updateDoc(doc(db, 'users', auth.currentUser.uid), cleanUpdate);
      } catch (e) {
        console.error("Failed to sync to Firestore", e);
      }
    }
  };

  const addRideToHistory = (ride: CompletedRide) => {
    const newHistory = [ride, ...rideHistory];
    setRideHistory(newHistory);
    syncToFirestore({ rideHistory: newHistory });
  };

  const deleteRideFromHistory = (id: string) => {
    const newHistory = rideHistory.filter(r => r.id !== id);
    setRideHistory(newHistory);
    syncToFirestore({ rideHistory: newHistory });
  };

  const addSchedule = (schedule: RideSchedule) => {
    const newSchedules = [...schedules, schedule];
    setSchedules(newSchedules);
    syncToFirestore({ schedules: newSchedules });
  };

  const toggleSchedule = (id: string) => {
    const newSchedules = schedules.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s);
    setSchedules(newSchedules);
    syncToFirestore({ schedules: newSchedules });
  };

  const deleteSchedule = (id: string) => {
    const newSchedules = schedules.filter(s => s.id !== id);
    setSchedules(newSchedules);
    syncToFirestore({ schedules: newSchedules });
  };

  const addSavedPlace = (place: SavedPlace) => {
    const existingIndex = savedPlaces.findIndex(p => p.label.toLowerCase() === place.label.toLowerCase());
    let newPlaces;
    if (existingIndex >= 0) {
      newPlaces = [...savedPlaces];
      newPlaces[existingIndex] = { ...newPlaces[existingIndex], location: place.location };
    } else {
      newPlaces = [...savedPlaces, place];
    }
    setSavedPlaces(newPlaces);
    syncToFirestore({ savedPlaces: newPlaces });
  };

  const updateSavedPlace = (id: string, patch: Partial<Omit<SavedPlace, 'id'>>) => {
    const newPlaces = savedPlaces.map(p => (p.id === id ? { ...p, ...patch } : p));
    setSavedPlaces(newPlaces);
    syncToFirestore({ savedPlaces: newPlaces });
  };

  const removeSavedPlace = (id: string) => {
    const newPlaces = savedPlaces.filter(p => p.id !== id);
    setSavedPlaces(newPlaces);
    syncToFirestore({ savedPlaces: newPlaces });
    // If the widget pointed at this place, clear it so the dashboard doesn't show stale data
    if (widgetPickupId === id) {
      setWidgetPickupIdState(null);
      syncToFirestore({ widgetPickupId: null });
    }
    if (widgetDropoffId === id) {
      setWidgetDropoffIdState(null);
      syncToFirestore({ widgetDropoffId: null });
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  const setWidgetPickupId = (id: string | null) => {
    setWidgetPickupIdState(id);
    syncToFirestore({ widgetPickupId: id });
  };

  const setWidgetDropoffId = (id: string | null) => {
    setWidgetDropoffIdState(id);
    syncToFirestore({ widgetDropoffId: id });
  };

  const addRecentSearch = (loc: LocationData) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(l => l.name !== loc.name);
      return [loc, ...filtered].slice(0, 5); // Keep top 5
    });
  };

  const updatePassengerWallet = (newVal: React.SetStateAction<number>) => {
    setPassengerWallet(prev => {
      const val = typeof newVal === 'function' ? newVal(prev) : newVal;
      syncToFirestore({ passengerWallet: val });
      return val;
    });
  };

  const updateDriverWallet = (newVal: React.SetStateAction<number>) => {
    setDriverWallet(prev => {
      const val = typeof newVal === 'function' ? newVal(prev) : newVal;
      syncToFirestore({ driverWallet: val });
      return val;
    });
  };
  
  // ---------------------------------------------------------
  // GLOBAL RIDE SYNC (Cross-Device Support)
  // ---------------------------------------------------------
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  // 1. Sync local state changes TO Firestore
  useEffect(() => {
    const syncRideToGlobal = async () => {
      if (!auth.currentUser) return;

      // If passenger starts searching, create/update a global ride doc
      if (rideState === 'searching' && !currentRideId) {
        const rideId = `ride_${auth.currentUser.uid}`;
        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        setRideOtp(newOtp);
        setCurrentRideId(rideId);
        
        try {
          await setDoc(doc(db, 'active_rides', rideId), {
            id: rideId,
            passengerId: auth.currentUser.uid,
            passengerName: currentUserName,
            driverName: '', 
            pickup,
            dropoff,
            otp: newOtp,
            status: 'searching',
            timestamp: Date.now(),
          });
        } catch (e: any) {
          console.error("Failed to create active ride", e);
          Alert.alert("Database Error", "Could not create ride request: " + e.message);
        }
      } 
      
      // If driver is accepted, set their name and gender in the doc
      if (currentRideId && rideState === 'accepted') {
        try {
          await updateDoc(doc(db, 'active_rides', currentRideId), {
            driverName: currentUserName,
            driverGender: currentUserGender,
            status: rideState,
          });
        } catch (e) {
          console.error("Failed to update ride status", e);
        }
      }

      // If driver is accepted/ongoing, sync driver location to the ride doc
      if (currentRideId && (rideState === 'accepted' || rideState === 'arrived' || rideState === 'ongoing')) {
        try {
          await updateDoc(doc(db, 'active_rides', currentRideId), {
            driverLocation,
          });
        } catch (e) {
          // silent fail for transient location updates
        }
      }

      // If ride completed or cancelled, clean up from Firestore
      if (rideState === 'completed' || (rideState === 'idle' && currentRideId)) {
        if (currentRideId) {
          try {
            // Delete the doc from cloud so it doesn't pollute the collection
            await deleteDoc(doc(db, 'active_rides', currentRideId));
          } catch (e) {
            console.error("Failed to delete ride doc", e);
          }
          setCurrentRideId(null);
        }
        setPickup(null);
        setDropoff(null);
        setDriverLocation(null);
      }
    };

    syncRideToGlobal();
  }, [rideState, driverLocation, currentRideId, currentUserName, pickup, dropoff]);

  // 2. Listen FOR changes from the other user
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (currentRideId) {
      // Both roles listen to their active ride
      unsubscribe = onSnapshot(doc(db, 'active_rides', currentRideId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status && data.status !== rideState) setRideState(data.status);
          if (data.driverLocation && rideState !== 'idle') setDriverLocation(data.driverLocation);
          if (data.otp) setRideOtp(data.otp);
          if (data.passengerName) setPassengerName(data.passengerName);
          if (data.driverName) setDriverName(data.driverName);
          if (data.driverGender) setActiveDriverGender(data.driverGender);
        } else {
          // If doc is deleted (e.g. cancelled by other party), return to idle
          if (rideState !== 'completed' && rideState !== 'idle') {
            setRideState('idle');
            setCurrentRideId(null);
          }
        }
      });
    } else if (rideState === 'idle' && userRole === 'driver') {
      // ONLY DRIVERS listen for new requests
      // Simplified query to avoid index requirements
      const q = query(
        collection(db, 'active_rides'), 
        where('status', '==', 'searching'), 
        limit(5) // Get a few to filter manually
      );
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty && rideState === 'idle') {
          const tenMinsAgo = Date.now() - 10 * 60 * 1000;
          
          // Find the first valid ride (recent and not own)
          const validRide = snapshot.docs.find(d => {
            const data = d.data();
            return data.timestamp >= tenMinsAgo && data.passengerId !== auth.currentUser?.uid;
          });

          if (validRide) {
            const docData = validRide.data();
            setPickup(docData.pickup);
            setDropoff(docData.dropoff);
            setPassengerName(docData.passengerName);
            setRideOtp(docData.otp);
            setCurrentRideId(docData.id);
            setRideState('searching');
          }
        }
      }, (error) => {
        console.error("Driver listener error:", error);
        // Alert.alert("Driver Sync Error", error.message);
      });
    }

    return () => unsubscribe();
  }, [currentRideId, rideState, userRole]);

  return (
    <RideContext.Provider value={{
      rideState, setRideState: (s) => {
        setRideState(s);
        if (currentRideId) updateDoc(doc(db, 'active_rides', currentRideId), { status: s });
      },
      pickup, setPickup,
      dropoff, setDropoff,
      activeDriverGender, setActiveDriverGender,
      passengerGender, setPassengerGender,
      rideHistory, addRideToHistory, deleteRideFromHistory,
      isFemaleOnly, setIsFemaleOnly,
      isPoolEnabled, setIsPoolEnabled,
      poolMatch, setPoolMatch,
      driverLocation, setDriverLocation,
      passengerWallet, setPassengerWallet: updatePassengerWallet,
      driverWallet, setDriverWallet: updateDriverWallet,
      schedules, addSchedule, toggleSchedule, deleteSchedule,
      savedPlaces, addSavedPlace, updateSavedPlace, removeSavedPlace,
      recentSearches, addRecentSearch, clearRecentSearches,
      widgetPickupId, widgetDropoffId, setWidgetPickupId, setWidgetDropoffId,
      driverName,
      passengerName,
      rideOtp, setRideOtp,
      currentUserName,
      userRole,
    }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => useContext(RideContext);
