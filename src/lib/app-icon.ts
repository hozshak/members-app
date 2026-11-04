// The icon of the app on the home screen can be changed in the profile, like in Instagram (owner 04.11.2026). The native module only exists in
// a build with it, so it is loaded when needed; in the browser preview nothing changes.
import { Platform } from 'react-native';

type Native = typeof import('expo-alternate-app-icons');

/** `id`: the name in app.json (plugin expo-alternate-app-icons); null is the normal icon. */
export const APP_ICONS = [
  { id: null, name: 'Rosé', source: require('../../assets/images/icon-preview-rose.png') as number },
  { id: 'Gold', name: 'Gold', source: require('../../assets/images/icon-preview-gold.png') as number },
] as const;

export type AppIconId = (typeof APP_ICONS)[number]['id'];

function native(): Native | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- only in a build that has the native module
    return require('expo-alternate-app-icons') as Native;
  } catch {
    return null;
  }
}

export function currentAppIcon(): AppIconId {
  return native()?.getAppIconName() === 'Gold' ? 'Gold' : null;
}

export async function setAppIcon(id: AppIconId): Promise<void> {
  await native()?.setAlternateAppIcon(id);
}
