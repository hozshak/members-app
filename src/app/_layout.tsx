// Root of the app: data cache, session, and the three stages as protected stacks — choose a community, log in, the
// member area (tabs). Expo Router shows the first stage whose guard is true; the splash screen stays until the stored
// session has been checked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SessionProvider, useSession } from '@/lib/session';
import { usePalette } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync();

// the routine reminder (a local notification) also shows while the app is open
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

function RootStack() {
  const { ready, community, token } = useSession();
  const p = usePalette();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const base = p.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: p.accent, background: p.bg, card: p.surface, text: p.text, border: p.line } };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
        <Stack.Protected guard={!community}>
          <Stack.Screen name="community" />
        </Stack.Protected>
        <Stack.Protected guard={!!community && !token}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={!!community && !!token}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pdf" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="einfuehrung" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="foto" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="tools" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RootStack />
      </SessionProvider>
    </QueryClientProvider>
  );
}
