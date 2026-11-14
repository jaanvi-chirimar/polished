import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { user, userProfile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Auth guard: no user → /auth, unfinished profile → /setup, finished → tabs.
  useEffect(() => {
    if (loading) return;
    const route = segments[0];

    if (!user) {
      if (route !== 'auth') router.replace('/auth');
      return;
    }
    if (!userProfile?.profileCompleted) {
      if (route !== 'setup') router.replace('/setup');
      return;
    }
    if (route === 'auth' || route === 'setup') router.replace('/(tabs)');
  }, [user, userProfile, loading, segments]);

  // The app is always light-themed.
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="book/[id]" />
        <Stack.Screen name="tech/[id]" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
