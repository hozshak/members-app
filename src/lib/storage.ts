// Small persistent storage: the phone's secure storage (Keychain / Keystore) on iOS and Android — the session token
// lives there — and localStorage in the browser (web is only used for development).
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (web) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (web) {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* private mode */ }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (web) {
    try { globalThis.localStorage?.removeItem(key); } catch { /* private mode */ }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
