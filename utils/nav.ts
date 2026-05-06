import { router } from 'expo-router';

/**
 * Safe back: if navigation stack has a previous entry, pop. Otherwise route to a fallback
 * (defaults to /dashboard). Use this everywhere instead of bare router.back() so the
 * top-level screens after `router.replace('/dashboard')` still have a usable back button.
 */
export function goBack(fallback: string = '/dashboard') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
