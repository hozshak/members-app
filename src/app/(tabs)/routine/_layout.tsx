// The "Routine" tab: overview (today, streak, calendar, reminder, photos); the routine itself and the camera open full
// screen above the tab bar.
import { Stack } from 'expo-router';
import { usePalette } from '@/lib/theme';

export default function RoutineStack() {
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
      <Stack.Screen name="[id]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="zone" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="plan" options={{ title: 'Dein Plan' }} />
      <Stack.Screen name="fotos" options={{ title: 'Fortschrittsfotos' }} />
      <Stack.Screen name="ziel" options={{ title: 'Mein Ziel' }} />
      <Stack.Screen name="kamera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
