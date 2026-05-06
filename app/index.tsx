import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRide } from '../context/RideContext';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';

const isExpoGo = Constants.appOwnership === 'expo';

let GoogleSignin: any = null;
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      console.warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not set — Google Sign-In disabled.');
    } else {
      GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
      GoogleSignin.configure({ webClientId });
    }
  } catch (e) {
    console.warn('Google Sign-In native module unavailable:', e);
    GoogleSignin = null;
  }
}

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');

  const { setActiveDriverGender, setPassengerGender } = useRide();

  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Missing info', 'Please fill all fields');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    setIsLoading(true);
    try {
      let resolvedRole: 'passenger' | 'driver' = 'passenger';
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          resolvedRole = userData.role === 'driver' ? 'driver' : 'passenger';
          if (resolvedRole === 'driver') {
            setActiveDriverGender(userData.gender === 'female' ? 'female' : 'male');
          } else {
            setPassengerGender(userData.gender);
          }
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name,
          email,
          role,
          gender,
          createdAt: new Date().toISOString(),
        });

        resolvedRole = role;
        if (role === 'driver') {
          setActiveDriverGender(gender === 'female' ? 'female' : 'male');
        } else {
          setPassengerGender(gender);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(resolvedRole === 'driver' ? '/driver' : '/dashboard');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Authentication Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      setIsLoading(true);
      let userCredential;

      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        // Force account selection
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        userCredential = await signInWithPopup(auth, provider);
      } else {
        if (!GoogleSignin) {
          Alert.alert('Google Sign-In Unavailable', 'Run a development build (npx expo run:android) to enable Google Sign-In.');
          setIsLoading(false);
          return;
        }
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        
        const idToken = (userInfo as any).idToken || (userInfo as any).data?.idToken;
        
        if (!idToken) throw new Error("No ID token found from Google");
        
        const googleCredential = GoogleAuthProvider.credential(idToken);
        userCredential = await signInWithCredential(auth, googleCredential);
      }
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      let resolvedRole: 'passenger' | 'driver' = 'passenger';

      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: userCredential.user.displayName || 'Google User',
          email: userCredential.user.email,
          role: role,
          gender: gender,
          createdAt: new Date().toISOString(),
        });
        resolvedRole = role;
        if (role === 'driver') {
          setActiveDriverGender(gender === 'female' ? 'female' : 'male');
        } else {
          setPassengerGender(gender);
        }
      } else {
        const userData = userDoc.data();
        resolvedRole = userData.role === 'driver' ? 'driver' : 'passenger';
        if (resolvedRole === 'driver') {
          setActiveDriverGender(userData.gender === 'female' ? 'female' : 'male');
        } else {
          setPassengerGender(userData.gender);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(resolvedRole === 'driver' ? '/driver' : '/dashboard');
    } catch (error: any) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Google Sign-In Error', error.message + (Platform.OS !== 'web' ? '\n\nGoogle Sign-In requires a production build.' : ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <LinearGradient
              colors={['#1E88E5', '#6A11CB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoContainer}
            >
              <MaterialCommunityIcons name="taxi" size={42} color="#fff" />
            </LinearGradient>
            <Text style={styles.title}>RidePro</Text>
            <Text style={styles.subtitle}>{isLogin ? 'Welcome back, ready to ride?' : 'Create an account to get started'}</Text>
          </View>

          <View style={styles.formContainer}>
            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="hello@ridepro.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {!isLogin && (
              <>
                <View style={styles.roleContainer}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[styles.roleButton, gender === 'male' && styles.roleButtonActive]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setGender('male'); }}
                    >
                      <Ionicons name="man" size={28} color={gender === 'male' ? '#1E88E5' : '#888'} />
                      <Text style={[styles.roleText, gender === 'male' && styles.roleTextActive]}>Male</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleButton, gender === 'female' && styles.roleButtonActive]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setGender('female'); }}
                    >
                      <Ionicons name="woman" size={28} color={gender === 'female' ? '#ff4081' : '#888'} />
                      <Text style={[styles.roleText, gender === 'female' && styles.roleTextActive]}>Female</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.roleContainer}>
                  <Text style={styles.label}>I am a...</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[styles.roleButton, role === 'passenger' && styles.roleButtonActive]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setRole('passenger'); }}
                    >
                      <Ionicons name="person" size={28} color={role === 'passenger' ? '#1E88E5' : '#888'} />
                      <Text style={[styles.roleText, role === 'passenger' && styles.roleTextActive]}>Passenger</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleButton, role === 'driver' && styles.roleButtonActiveDriver]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setRole('driver'); }}
                    >
                      <MaterialCommunityIcons name="steering" size={28} color={role === 'driver' ? '#00897b' : '#888'} />
                      <Text style={[styles.roleText, role === 'driver' && styles.roleTextActiveDriver]}>Driver</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity onPress={handleAuth} disabled={isLoading} activeOpacity={0.9}>
              <LinearGradient
                colors={['#111', '#1E88E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name={isLogin ? 'log-in-outline' : 'person-add-outline'} size={18} color="#fff" />
                    <Text style={styles.primaryButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleAuth} activeOpacity={0.9}>
              <FontAwesome name="google" size={18} color="#4285F4" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{isLogin ? "Don't have an account?" : 'Already have an account?'}</Text>
              <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); setIsLogin(!isLogin); setEmail(''); setPassword(''); setName(''); }}>
                <Text style={styles.footerLink}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  logoContainer: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 18, elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 16,
    paddingHorizontal: 14, borderWidth: 1, borderColor: '#eee',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, paddingVertical: 18, fontSize: 16, color: '#111',
  },
  roleContainer: {
    marginBottom: 30,
  },
  roleSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1E88E5',
  },
  roleButtonActiveDriver: {
    backgroundColor: '#e0f2f1',
    borderColor: '#00897b',
  },
  roleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 8,
  },
  roleTextActive: {
    color: '#1E88E5',
  },
  roleTextActiveDriver: {
    color: '#00897b',
  },
  primaryButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    paddingVertical: 18, borderRadius: 16, marginTop: 10,
    shadowColor: '#1E88E5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    color: '#999',
    paddingHorizontal: 15,
    fontWeight: 'bold',
  },
  googleButton: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 18, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: '#ddd',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 15,
  },
  footerLink: {
    color: '#1E88E5',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 5,
  },
});
