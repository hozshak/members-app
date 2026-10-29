// The "Start" tab: home → product → category → lesson, with the native header and back gesture.
import { Stack } from 'expo-router';
import { usePalette } from '@/lib/theme';

export default function StartStack() {
  const p = usePalette();
  return (
    <Stack
      screenOptions={{
        headerTintColor: p.accent,
        headerStyle: { backgroundColor: p.bg },
        headerTitleStyle: { color: p.text },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: p.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
