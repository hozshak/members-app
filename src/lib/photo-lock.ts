// The lock of the progress photos: with "Fotos schützen" on, the photos stay hidden until Face ID / fingerprint / the
// phone's code confirms it is the owner; leaving the app locks them again. (Expo Go has no Face ID — there the phone's
// code is asked instead; the store version uses Face ID.)
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

let unlocked = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export async function unlockPhotos(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Fortschrittsfotos entsperren', cancelLabel: 'Abbrechen' });
  if (res.success) {
    unlocked = true;
    emit();
  }
  return res.success;
}

/** True when the photos may be shown (lock off, or unlocked in this visit of the app). */
export function usePhotosVisible(locked: boolean): boolean {
  const isUnlocked = useSyncExternalStore(subscribe, () => unlocked, () => unlocked);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' && unlocked) {
        unlocked = false;
        emit();
      }
    });
    return () => sub.remove();
  }, []);
  return !locked || isUnlocked;
}
