import { Polish } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { auth, db } from '@/firebase/config';
import { storeGoogleTokens } from '@/lib/googleCalendar';
import type { TokenResponse } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

/** Non-Cornell accounts allowed in for testing. */
const DEMO_EMAILS = ['polish.app12@gmail.com'];

/** Signs in to Firebase with the Google tokens, checks for a Cornell email, and saves calendar tokens. */
async function completeSignIn(
  authentication: TokenResponse,
  saveProfile: ReturnType<typeof useAuth>['saveProfile']
) {
  try {
    const credential = GoogleAuthProvider.credential(authentication.idToken, authentication.accessToken);
    const { user } = await signInWithCredential(auth, credential);

    if (!user.email?.endsWith('@cornell.edu') && !DEMO_EMAILS.includes(user.email ?? '')) {
      await signOut(auth);
      Alert.alert('Cornell email required', 'Please sign in with your @cornell.edu Google account.');
      return;
    }

    // First sign-in: create the user doc. Roles are chosen in /setup.
    const existing = await getDoc(doc(db, 'users', user.uid));
    if (!existing.exists()) {
      await saveProfile({ uid: user.uid, email: user.email, roles: [], profileCompleted: false });
    }

    await storeGoogleTokens(user.uid, {
      accessToken: authentication.accessToken,
      // Google doesn't always send a refresh token on iOS.
      refreshToken: authentication.refreshToken ?? '',
      expiresAt: Date.now() + (authentication.expiresIn ?? 3600) * 1000,
    });
  } catch (error: any) {
    console.error('Google auth error:', error);
    Alert.alert('Sign in failed', error.message || 'Please try again.');
  }
}

/**
 * Cornell Google sign-in. Calendar access is requested here too.
 * Where to go next is decided by the auth guard in _layout.tsx:
 * new users go to /setup (which asks for their role), returning users to the tabs.
 */
export default function AuthScreen() {
  const { saveProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['profile', 'email', 'openid', 'https://www.googleapis.com/auth/calendar.events'],
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success' || !googleResponse.authentication?.accessToken) return;
    setLoading(true);
    completeSignIn(googleResponse.authentication, saveProfile).finally(() => setLoading(false));
  }, [googleResponse, saveProfile]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.appName}>Polish</Text>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          Sign in with your Cornell Google account to book or offer nail appointments.
        </Text>
        <Button
          variant="outline"
          icon="logo-google"
          title="Sign in with Cornell Google"
          loading={loading}
          disabled={!googleRequest}
          onPress={() => googlePromptAsync()}
        />
        <Text style={styles.note}>@cornell.edu accounts only</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Polish.colors.background },
  content: { flex: 1, padding: Polish.spacing.xl, paddingTop: 100, gap: Polish.spacing.md },
  appName: { ...Polish.typography.caption, color: Polish.colors.primary, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  title: { ...Polish.typography.title, color: Polish.colors.text },
  subtitle: { ...Polish.typography.body, color: Polish.colors.textSecondary, marginBottom: Polish.spacing.xxl, lineHeight: 22 },
  note: { ...Polish.typography.caption, color: Polish.colors.textMuted, textAlign: 'center' },
});
