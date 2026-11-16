import { ChipSelect, LocationPicker } from '@/components/profile/ProfileFields';
import { BackHeader, Button, CenterMessage, ui } from '@/components/ui';
import { NAIL_TECH_DESIGNS, NAIL_TECH_TOOLS } from '@/constants/nailTechOptions';
import { Polished } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase/config';
import { formFromProfile, useProfileForm } from '@/lib/profileForm';
import { buildFullName } from '@/lib/utils';
import { router } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

/** "Become a Nail Tech" application. Approving it (adding the nailTech role) happens outside the app. */
export default function ApplyScreen() {
  const { user, userProfile, saveProfile } = useAuth();
  const { form, set } = useProfileForm(formFromProfile(userProfile));
  const [whyApply, setWhyApply] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.location.trim()) {
      Alert.alert('Required', 'Please select your location.');
      return;
    }
    if (!form.bio.trim()) {
      Alert.alert('Required', 'Please tell clients a bit about yourself.');
      return;
    }
    if (!user || !userProfile) return;

    // One application per person, stored at applications/{uid}.
    const applicationRef = doc(db, 'applications', user.uid);
    const existing = await getDoc(applicationRef);
    const status = existing.exists() ? existing.data().status : null;
    if (status === 'pending') {
      Alert.alert('Already applied', 'Your application is still under review.');
      return;
    }
    if (status === 'approved') {
      Alert.alert('Already approved', 'You are already a nail tech on Polished!');
      return;
    }

    setSubmitting(true);
    try {
      const bio = form.bio.trim();
      const location = form.location.trim();
      await setDoc(applicationRef, {
        uid: user.uid,
        name: buildFullName(userProfile.firstName, userProfile.lastName, ''),
        email: user.email,
        bio,
        location,
        tools: form.tools,
        designs: form.designs,
        instagramHandle: form.instagramHandle.trim() || null,
        whyApply: whyApply.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      // Pre-fill the tech profile so it's ready if they're approved.
      await saveProfile({
        ...userProfile,
        instagramHandle: form.instagramHandle.trim() || userProfile.instagramHandle,
        nailTechProfile: {
          ...userProfile.nailTechProfile,
          bio,
          location,
          tools: form.tools.length ? form.tools : undefined,
          designs: form.designs.length ? form.designs : undefined,
        },
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Application error:', err);
      Alert.alert('Error', 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[ui.screen, styles.page]}>
        <CenterMessage
          icon="checkmark-circle-outline"
          title="Application submitted!"
          subtitle="We’ll review your application and get back to you soon. Once approved, your profile will appear in the directory."
        />
        <Button title="Done" onPress={() => router.back()} style={{ marginBottom: 48 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[ui.screen, styles.page]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <BackHeader title="Become a Nail Tech" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text style={[ui.body, styles.intro]}>Tell us about yourself and we’ll review your application within a few days.</Text>

        <Text style={ui.label}>Location *</Text>
        <LocationPicker form={form} set={set} />

        <Text style={[ui.label, ui.spaced]}>Bio *</Text>
        <Text style={ui.hint}>A short intro about your style, experience, and what makes you unique.</Text>
        <TextInput
          style={[ui.input, ui.textArea]}
          placeholder="e.g. I'm a self-taught nail artist specializing in minimalist gel designs..."
          placeholderTextColor={Polished.colors.textMuted}
          value={form.bio}
          onChangeText={(v) => set('bio', v)}
          multiline
        />

        <Text style={ui.label}>Instagram (optional)</Text>
        <TextInput
          style={ui.input}
          placeholder="@yourhandle"
          placeholderTextColor={Polished.colors.textMuted}
          value={form.instagramHandle}
          onChangeText={(text) => {
            const handle = text.replace(/^@+/, '');
            set('instagramHandle', handle ? `@${handle}` : '');
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[ui.label, ui.spaced]}>Services / Techniques</Text>
        <ChipSelect options={NAIL_TECH_TOOLS} selected={form.tools} onChange={(v) => set('tools', v)} />

        <Text style={[ui.label, ui.spaced]}>Design Styles</Text>
        <ChipSelect options={NAIL_TECH_DESIGNS} selected={form.designs} onChange={(v) => set('designs', v)} />

        <Text style={[ui.label, ui.spaced]}>Why do you want to join? (optional)</Text>
        <TextInput
          style={[ui.input, ui.textArea]}
          placeholder="Anything else you'd like us to know..."
          placeholderTextColor={Polished.colors.textMuted}
          value={whyApply}
          onChangeText={setWhyApply}
          multiline
        />

        <Button title="Submit Application" loading={submitting} onPress={handleSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingHorizontal: Polished.spacing.xl },
  intro: { marginBottom: Polished.spacing.xxl, lineHeight: 22 },
});
