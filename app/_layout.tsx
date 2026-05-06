import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RideProvider } from '../context/RideContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RideProvider>
          <BottomSheetModalProvider>
            <StatusBar style="auto" />
            <Stack>
              <Stack.Screen name="index" options={{ title: 'Login', headerShown: false }} />
              <Stack.Screen name="dashboard" options={{ title: 'Dashboard', headerShown: false }} />
              <Stack.Screen name="passenger" options={{ title: 'Passenger App', headerShown: false }} />
              <Stack.Screen name="driver" options={{ title: 'Driver App', headerShown: false }} />
              <Stack.Screen name="places" options={{ title: 'Saved Places', headerShown: false }} />
            </Stack>
          </BottomSheetModalProvider>
        </RideProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
