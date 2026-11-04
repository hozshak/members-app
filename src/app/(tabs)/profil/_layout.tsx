// The "Profil" tab: overview, then personal data, password, reminders, notifications, devices and purchases — all in the app.
import { Stack } from 'expo-router';
import { usePalette } from '@/lib/theme';

export default function ProfileStack() {
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
      <Stack.Screen name="daten" options={{ title: 'Persönliche Daten' }} />
      <Stack.Screen name="passwort" options={{ title: 'Passwort ändern' }} />
      <Stack.Screen name="erinnerungen" options={{ title: 'Erinnerungen' }} />
      <Stack.Screen name="app-icon" options={{ title: 'App-Icon' }} />
      <Stack.Screen name="benachrichtigungen" options={{ title: 'Benachrichtigungen' }} />
      <Stack.Screen name="geraete" options={{ title: 'Geräte' }} />
      <Stack.Screen name="kaeufe" options={{ title: 'Meine Käufe' }} />
    </Stack>
  );
}
