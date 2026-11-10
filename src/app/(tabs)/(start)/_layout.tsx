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
        // back only from the edge: on iOS 26 a swipe anywhere would take the drag on a video's bar (owner 10.11.2026: "das ganze Video geht nach rechts")
        fullScreenGestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
