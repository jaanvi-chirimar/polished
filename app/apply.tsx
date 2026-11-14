import { ChipSelect, LocationPicker } from '@/components/profile/ProfileFields';
import { formStyles as fs } from '@/components/profile/formStyles';
import { NAIL_TECH_DESIGNS, NAIL_TECH_TOOLS } from '@/constants/nailTechOptions';
import { Polish } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase/config';
import { formFromProfile, useProfileForm } from '@/lib/profileForm';
import { buildFullName } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
      Alert.alert('Already approved', 'You are already a nail tech on Polish!');
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
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color={Polish.colors.success} />
          </View>
          <Text style={styles.successTitle}>Application submitted!</Text>
          <Text style={styles.successBody}>
            We’ll review your application and get back to you soon. Once approved, your profile will appear in the directory.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Polish.colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Become a Nail Tech</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Tell us about yourself and we’ll review your application within a few days.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Location *</Text>
          <LocationPicker form={form} set={set} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bio *</Text>
          <Text style={styles.hint}>A short intro about your style, experience, and what makes you unique.</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. I'm a self-taught nail artist specializing in minimalist gel designs..."
            placeholderTextColor={Polish.colors.textMuted}
            value={form.bio}
            onChangeText={(v) => set('bio', v)}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Instagram (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="@yourhandle"
            placeholderTextColor={Polish.colors.textMuted}
            value={form.instagramHandle}
            onChangeText={(text) => {
              const handle = text.replace(/^@+/, '');
              set('instagramHandle', handle ? `@${handle}` : '');
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Services / Techniques</Text>
          <Text style={styles.hint}>Select all that apply.</Text>
          <ChipSelect options={NAIL_TECH_TOOLS} selected={form.tools} onChange={(v) => set('tools', v)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Design Styles</Text>
          <ChipSelect options={NAIL_TECH_DESIGNS} selected={form.designs} onChange={(v) => set('designs', v)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Why do you want to join? (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Anything else you'd like us to know..."
            placeholderTextColor={Polish.colors.textMuted}
            value={whyApply}
            onChangeText={setWhyApply}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Application</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Polish.colors.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Polish.spacing.lg,
    paddingTop: 56,
    paddingBottom: Polish.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Polish.colors.borderLight,
    backgroundColor: Polish.colors.background,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  navTitle: { ...Polish.typography.subtitle, color: Polish.colors.text },
  scroll: { flex: 1 },
  content: { padding: Polish.spacing.xl, paddingBottom: 48 },
  subtitle: {
    ...Polish.typography.body,
    color: Polish.colors.textSecondary,
    marginBottom: Polish.spacing.xxl,
    lineHeight: 22,
  },
  section: { marginBottom: Polish.spacing.xxl },
  label: { ...Polish.typography.bodyMedium, color: Polish.colors.text, marginBottom: Polish.spacing.sm },
  hint: { ...Polish.typography.caption, color: Polish.colors.textMuted, marginBottom: Polish.spacing.md },
  input: { ...fs.input, marginBottom: 0, color: Polish.colors.text },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: Polish.colors.primary,
    borderRadius: Polish.radius.lg,
    paddingVertical: Polish.spacing.lg,
    alignItems: 'center',
    ...Polish.shadow,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { ...Polish.typography.button, color: '#fff' },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Polish.spacing.xxxl,
  },
  successIcon: { marginBottom: Polish.spacing.xl },
  successTitle: { ...Polish.typography.title, color: Polish.colors.text, textAlign: 'center', marginBottom: Polish.spacing.lg },
  successBody: {
    ...Polish.typography.body,
    color: Polish.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Polish.spacing.xxxl,
  },
  doneButton: {
    backgroundColor: Polish.colors.primary,
    borderRadius: Polish.radius.lg,
    paddingVertical: Polish.spacing.lg,
    paddingHorizontal: Polish.spacing.xxxl,
  },
  doneButtonText: { ...Polish.typography.button, color: '#fff' },
});
