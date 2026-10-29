// The "Profil" tab: its own stack (room for settings later).
import { Stack } from 'expo-router';
import { usePalette } from '@/lib/theme';

export default function ProfileStack() {
  const p = usePalette();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />;
}
