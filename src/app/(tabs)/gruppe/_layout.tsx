// The "Gruppe" tab (owner 10.11.2026): one screen — the offer page, the rules, or the chat (src/app/(tabs)/gruppe/index.tsx).
import { Stack } from 'expo-router';
import { usePalette } from '@/lib/theme';

export default function GroupStack() {
  const p = usePalette();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
