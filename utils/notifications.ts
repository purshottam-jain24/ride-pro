import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGoAndroid = Constants.appOwnership === 'expo' && Platform.OS === 'android';

let Notifications: any = null;
if (!isExpoGoAndroid) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    Notifications = null;
  }
}

export const notificationsAvailable = Notifications !== null;

export async function ensurePermissionsAndChannel() {
  if (!Notifications) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  } catch {
    // swallow; not critical for demo
  }
}

export function notify(title: string, body: string) {
  if (!Notifications) return;
  try {
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
