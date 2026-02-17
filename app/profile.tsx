import {
  CUSTOMER_PREFERENCES_OPTIONS,
  DESIGNS_HINT,
  DESIGNS_LABEL,
  LOCATION_OPTIONS,
  NAIL_TECH_DESIGNS,
  NAIL_TECH_TOOLS,
  PREFERENCES_HINT,
  TOOLS_HINT,
  TOOLS_LABEL,
} from '@/constants/nailTechOptions';
import { Polish } from '@/constants/theme';
import { NailTechProfile, useAuth, UserType } from '@/contexts/AuthContext';
import { auth, db } from '@/firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, userProfile, setUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Basic info
  const [firstName, setFirstName] = useState(userProfile?.firstName || '');
  const [lastName, setLastName] = useState(userProfile?.lastName || '');
  
  // User profile (optional). Single location for both user and nail tech when they have both roles.
  const [location, setLocation] = useState(() => {
    const saved = userProfile?.location || userProfile?.nailTechProfile?.location || '';
    return LOCATION_OPTIONS.includes(saved as any) ? saved : '';
  });
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>(
    () => Array.isArray(userProfile?.preferences) ? userProfile.preferences : (userProfile?.preferences ? [userProfile.preferences] : [])
  );
  
  // Nail tech profile
  const [bio, setBio] = useState(userProfile?.nailTechProfile?.bio || '');
  const [selectedTools, setSelectedTools] = useState<string[]>(userProfile?.nailTechProfile?.tools || []);
  const [selectedDesigns, setSelectedDesigns] = useState<string[]>(userProfile?.nailTechProfile?.designs || []);
  const [availableDays, setAvailableDays] = useState<string[]>(userProfile?.nailTechProfile?.availabilities?.days || []);
  
  // Editable roles when in edit mode; otherwise use saved profile
  const [selectedRoles, setSelectedRoles] = useState<UserType[]>(userProfile?.roles ?? []);
  
  const isNailTech = editing ? selectedRoles.includes('nailTech') : (userProfile?.roles?.includes('nailTech') ?? false);
  const isUser = editing ? selectedRoles.includes('user') : (userProfile?.roles?.includes('user') ?? false);
  
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const toggleRole = (role: UserType) => {
    if (selectedRoles.includes(role)) {
      // Require at least one role
      if (selectedRoles.length <= 1) return;
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };
  
  // Sync from saved profile when profile loads or when not editing
  useEffect(() => {
    if (userProfile && !editing) {
      if (userProfile.roles?.length) setSelectedRoles(userProfile.roles);
      setLocation(userProfile.location || userProfile.nailTechProfile?.location || '');
      setSelectedPreferences(Array.isArray(userProfile.preferences) ? userProfile.preferences : (userProfile.preferences ? [userProfile.preferences] : []));
      setSelectedTools(Array.isArray(userProfile.nailTechProfile?.tools) ? userProfile.nailTechProfile.tools : []);
      setSelectedDesigns(Array.isArray(userProfile.nailTechProfile?.designs) ? userProfile.nailTechProfile.designs : []);
      setAvailableDays(Array.isArray(userProfile.nailTechProfile?.availabilities?.days) ? userProfile.nailTechProfile.availabilities.days : []);
    }
  }, [userProfile?.roles, userProfile?.location, userProfile?.nailTechProfile?.location, userProfile?.preferences, userProfile?.nailTechProfile?.tools, userProfile?.nailTechProfile?.designs, userProfile?.nailTechProfile?.availabilities?.days, editing]);

  // Re-fetch profile from Firestore when profile screen mounts so we always show latest (fixes "not showing on my own profile")
  useEffect(() => {
    if (!user?.uid || editing) return;
    let mounted = true;
    (async () => {
      try {
        const snap = await getDocFromServer(doc(db, 'users', user.uid));
        if (!mounted || !snap.exists()) return;
        const data = snap.data();
        const np = data.nailTechProfile;
        setSelectedTools(Array.isArray(np?.tools) ? np.tools : []);
        setSelectedDesigns(Array.isArray(np?.designs) ? np.designs : []);
        setAvailableDays(Array.isArray(np?.availabilities?.days) ? np.availabilities.days : []);
        const saved = data.location || np?.location || '';
        setLocation(LOCATION_OPTIONS.includes(saved as any) ? saved : '');
        setSelectedPreferences(Array.isArray(data.preferences) ? data.preferences : (data.preferences ? [data.preferences] : []));
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [user?.uid, editing]);
  
  const toggleDay = (day: string) => {
    if (availableDays.includes(day)) {
      setAvailableDays(availableDays.filter(d => d !== day));
    } else {
      setAvailableDays([...availableDays, day]);
    }
  };

  const toggleTool = (tool: string) => {
    if (selectedTools.includes(tool)) {
      setSelectedTools(selectedTools.filter(t => t !== tool));
    } else {
      setSelectedTools([...selectedTools, tool]);
    }
  };

  const toggleDesign = (design: string) => {
    if (selectedDesigns.includes(design)) {
      setSelectedDesigns(selectedDesigns.filter(d => d !== design));
    } else {
      setSelectedDesigns([...selectedDesigns, design]);
    }
  };
  
  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required Fields', 'Please enter your first and last name');
      return;
    }
    
    if (selectedRoles.length === 0) {
      Alert.alert('Select a role', 'Please choose at least one: Customer or Nail Tech');
      return;
    }
    if (isNailTech && !location) {
      Alert.alert('Required Fields', 'Please select your location');
      return;
    }
    
    setLoading(true);
    try {
      if (!user || !userProfile) throw new Error('User not found');
      
      // Build nail tech profile if applicable
      let nailTechProfile: NailTechProfile | undefined;
      if (isNailTech) {
        nailTechProfile = {
          ...userProfile.nailTechProfile,
          bio: bio.trim() || undefined,
          location: location,
          tools: selectedTools.length > 0 ? [...selectedTools] : undefined,
          designs: selectedDesigns.length > 0 ? [...selectedDesigns] : undefined,
          availabilities: {
            ...userProfile.nailTechProfile?.availabilities,
            days: availableDays,
          },
        };
      }
      
      const updatedProfile = {
        ...userProfile,
        roles: selectedRoles,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        preferences: isUser && selectedPreferences.length > 0 ? [...selectedPreferences] : undefined,
        location: (isUser || isNailTech) && location ? location : undefined,
        nailTechProfile: nailTechProfile,
      };
      
      const writeData: Record<string, unknown> = {
        phoneNumber: user.phoneNumber,
        roles: selectedRoles,
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        profileCompleted: true,
        createdAt: userProfile.createdAt || new Date(),
      };
      if (updatedProfile.preferences != null && updatedProfile.preferences !== undefined) {
        writeData.preferences = Array.isArray(updatedProfile.preferences) ? updatedProfile.preferences : updatedProfile.preferences;
      }
      if (updatedProfile.location) writeData.location = updatedProfile.location;
      if (updatedProfile.nailTechProfile != null) writeData.nailTechProfile = updatedProfile.nailTechProfile;
      await setDoc(doc(db, 'users', user.uid), writeData, { merge: true });
      
      setUserProfile(updatedProfile);
      
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
  
  const performLogout = async () => {
    try {
      setLoading(true);
      console.log('Logging out...');
      await signOut(auth);
      console.log('Sign out successful');
      // The AuthContext's onAuthStateChanged will detect the logout
      // and the routing in _layout.tsx will automatically redirect to /auth
      // But we'll also force navigation just in case
      setTimeout(() => {
        router.replace('/auth' as any);
      }, 100);
    } catch (error: any) {
      console.error('Logout error:', error);
      setLoading(false);
      Alert.alert('Error', error.message || 'Failed to log out. Please try again.');
    }
  };

  const handleLogout = () => {
    console.log('Logout button clicked');
    
    // On web, Alert.alert might not work well, so use window.confirm as fallback
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        performLogout();
      }
    } else {
      // On native, use Alert
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
          },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: performLogout,
          },
        ],
        { cancelable: true }
      );
    }
  };
  
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Profile';
  const topPadding = insets.top + 24;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Polish.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!editing ? (
          <TouchableOpacity
            onPress={() => {
              setSelectedRoles(userProfile?.roles ?? []);
              setEditing(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={Polish.colors.primary} />
        </View>
        <Text style={styles.heroTitle}>{displayName}</Text>
        {userProfile?.phoneNumber ? (
          <Text style={styles.heroSubtext}>{userProfile.phoneNumber}</Text>
        ) : null}
      </View>

      {editing && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I am a</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleChip, isUser && styles.roleChipSelected]}
              onPress={() => toggleRole('user')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={isUser ? '#fff' : Polish.colors.textSecondary}
              />
              <Text style={[styles.roleChipText, isUser && styles.roleChipTextSelected]}>
                Customer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleChip, isNailTech && styles.roleChipSelected]}
              onPress={() => toggleRole('nailTech')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="sparkles-outline"
                size={20}
                color={isNailTech ? '#fff' : Polish.colors.textSecondary}
              />
              <Text style={[styles.roleChipText, isNailTech && styles.roleChipTextSelected]}>
                Nail Tech
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.roleHint}>Choose at least one. You can be both.</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
          editable={editing}
          autoCapitalize="words"
        />
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          placeholder="Last Name"
          value={lastName}
          onChangeText={setLastName}
          editable={editing}
          autoCapitalize="words"
        />
        {!editing && (
          <Text style={styles.infoText}>Phone: {userProfile?.phoneNumber || 'N/A'}</Text>
        )}
      </View>

      {(isUser || isNailTech) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          {editing ? (
            <View style={styles.chipRow}>
              {LOCATION_OPTIONS.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.chip, location === loc && styles.chipSelected]}
                  onPress={() => setLocation(location === loc ? '' : loc)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      location === loc && styles.chipTextSelected,
                    ]}
                  >
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={location ? styles.readOnlyText : styles.readOnlyTextMuted}>
              {location || 'Not specified'}
            </Text>
          )}
        </View>
      )}

      {isUser && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Preferences</Text>
          {editing ? (
            <>
              <Text style={styles.optionHint}>{PREFERENCES_HINT}</Text>
              <View style={styles.chipRow}>
                {CUSTOMER_PREFERENCES_OPTIONS.map((pref) => (
                  <TouchableOpacity
                    key={pref}
                    style={[
                      styles.chip,
                      selectedPreferences.includes(pref) && styles.chipSelected,
                    ]}
                    onPress={() => {
                      if (selectedPreferences.includes(pref)) {
                        setSelectedPreferences(selectedPreferences.filter((p) => p !== pref));
                      } else {
                        setSelectedPreferences([...selectedPreferences, pref]);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedPreferences.includes(pref) && styles.chipTextSelected,
                      ]}
                    >
                      {pref}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            selectedPreferences.length > 0 && (
              <Text style={styles.readOnlyText}>{selectedPreferences.join(', ')}</Text>
            )
          )}
        </View>
      )}

      {isNailTech && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nail Tech Profile</Text>
          <TextInput
            style={[styles.input, styles.textArea, !editing && styles.inputDisabled]}
            placeholder="Bio"
            value={bio}
            onChangeText={setBio}
            editable={editing}
            multiline
            numberOfLines={3}
          />

          {editing ? (
            <>
              <Text style={styles.label}>{TOOLS_LABEL}</Text>
              <Text style={styles.optionHint}>{TOOLS_HINT}</Text>
              <View style={styles.chipRow}>
                {NAIL_TECH_TOOLS.map((tool) => (
                  <TouchableOpacity
                    key={tool}
                    style={[
                      styles.chip,
                      selectedTools.includes(tool) && styles.chipSelected,
                    ]}
                    onPress={() => toggleTool(tool)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedTools.includes(tool) && styles.chipTextSelected,
                      ]}
                    >
                      {tool}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.label, { marginTop: Polish.spacing.xl }]}>{DESIGNS_LABEL}</Text>
              <Text style={styles.optionHint}>{DESIGNS_HINT}</Text>
              <View style={styles.chipRow}>
                {NAIL_TECH_DESIGNS.map((design) => (
                  <TouchableOpacity
                    key={design}
                    style={[
                      styles.chip,
                      selectedDesigns.includes(design) && styles.chipSelected,
                    ]}
                    onPress={() => toggleDesign(design)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedDesigns.includes(design) && styles.chipTextSelected,
                      ]}
                    >
                      {design}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.readOnlySection}>
              <Text style={styles.label}>{TOOLS_LABEL}</Text>
              {selectedTools.length > 0 ? (
                <Text style={styles.readOnlyText}>{selectedTools.join(', ')}</Text>
              ) : (
                <Text style={styles.readOnlyTextMuted}>Not specified</Text>
              )}
              <Text style={[styles.label, { marginTop: Polish.spacing.lg }]}>{DESIGNS_LABEL}</Text>
              {selectedDesigns.length > 0 ? (
                <Text style={styles.readOnlyText}>{selectedDesigns.join(', ')}</Text>
              ) : (
                <Text style={styles.readOnlyTextMuted}>Not specified</Text>
              )}
            </View>
          )}
          
          {editing && (
            <>
              <Text style={styles.label}>Available Days</Text>
              <View style={styles.daysContainer}>
                {daysOfWeek.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      availableDays.includes(day) && styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        availableDays.includes(day) && styles.dayButtonTextSelected,
                      ]}
                    >
                      {day.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}
      
      {editing && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => {
              setSelectedRoles(userProfile?.roles ?? []);
              setFirstName(userProfile?.firstName || '');
              setLastName(userProfile?.lastName || '');
              const saved = userProfile?.location || userProfile?.nailTechProfile?.location || '';
              setLocation(LOCATION_OPTIONS.includes(saved as any) ? saved : '');
              setSelectedPreferences(Array.isArray(userProfile?.preferences) ? userProfile.preferences : (userProfile?.preferences ? [userProfile.preferences] : []));
              setBio(userProfile?.nailTechProfile?.bio || '');
              setSelectedTools(userProfile?.nailTechProfile?.tools || []);
              setSelectedDesigns(userProfile?.nailTechProfile?.designs || []);
              setAvailableDays(userProfile?.nailTechProfile?.availabilities?.days || []);
              setEditing(false);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, styles.logoutButton, loading && styles.buttonDisabled]}
        onPress={handleLogout}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log Out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Polish.colors.background,
  },
  content: {
    paddingHorizontal: Polish.spacing.xl,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Polish.spacing.xl,
  },
  backButton: {
    padding: Polish.spacing.sm,
    marginRight: Polish.spacing.sm,
  },
  headerTitle: {
    ...Polish.typography.title,
    color: Polish.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 50,
  },
  editButton: {
    ...Polish.typography.button,
    color: Polish.colors.primary,
  },
  hero: {
    alignItems: 'center',
    marginBottom: Polish.spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Polish.colors.accent + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Polish.spacing.lg,
  },
  heroTitle: {
    ...Polish.typography.title,
    color: Polish.colors.text,
    textAlign: 'center',
  },
  heroSubtext: {
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
    marginTop: Polish.spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Polish.spacing.md,
    marginBottom: Polish.spacing.sm,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Polish.spacing.sm,
    paddingVertical: Polish.spacing.md,
    paddingHorizontal: Polish.spacing.lg,
    borderRadius: Polish.radius.xl,
    borderWidth: 2,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
  },
  roleChipSelected: {
    borderColor: Polish.colors.primary,
    backgroundColor: Polish.colors.primary,
  },
  roleChipText: {
    ...Polish.typography.bodyMedium,
    color: Polish.colors.textSecondary,
  },
  roleChipTextSelected: {
    color: '#fff',
  },
  roleHint: {
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
  },
  section: {
    backgroundColor: Polish.colors.surface,
    borderRadius: Polish.radius.lg,
    padding: Polish.spacing.xl,
    marginBottom: Polish.spacing.xxl,
    borderWidth: 1,
    borderColor: Polish.colors.borderLight,
    ...Polish.shadowSm,
  },
  sectionTitle: {
    ...Polish.typography.subtitle,
    marginBottom: Polish.spacing.lg,
    color: Polish.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Polish.colors.border,
    borderRadius: Polish.radius.md,
    padding: Polish.spacing.lg,
    ...Polish.typography.body,
    marginBottom: Polish.spacing.lg,
    backgroundColor: Polish.colors.surface,
  },
  inputDisabled: {
    backgroundColor: Polish.colors.borderLight,
    color: Polish.colors.textSecondary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  infoText: {
    ...Polish.typography.caption,
    color: Polish.colors.textSecondary,
    marginTop: -8,
    marginBottom: Polish.spacing.lg,
  },
  label: {
    ...Polish.typography.bodyMedium,
    marginBottom: Polish.spacing.md,
    color: Polish.colors.text,
  },
  optionHint: {
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
    marginBottom: Polish.spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Polish.spacing.lg,
    gap: Polish.spacing.sm,
  },
  chip: {
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.xl,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
  },
  chipSelected: {
    backgroundColor: Polish.colors.primary,
    borderColor: Polish.colors.primary,
  },
  chipText: {
    ...Polish.typography.caption,
    color: Polish.colors.textSecondary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  readOnlySection: {
    marginBottom: Polish.spacing.lg,
  },
  readOnlyText: {
    ...Polish.typography.body,
    color: Polish.colors.textSecondary,
  },
  readOnlyTextMuted: {
    ...Polish.typography.body,
    color: Polish.colors.textMuted,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Polish.spacing.lg,
    gap: Polish.spacing.sm,
  },
  dayButton: {
    paddingHorizontal: Polish.spacing.lg,
    paddingVertical: Polish.spacing.md,
    borderRadius: Polish.radius.xl,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
    marginRight: Polish.spacing.sm,
    marginBottom: Polish.spacing.sm,
  },
  dayButtonSelected: {
    backgroundColor: Polish.colors.primary,
    borderColor: Polish.colors.primary,
  },
  dayButtonText: {
    ...Polish.typography.caption,
    color: Polish.colors.textSecondary,
    fontWeight: '500',
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Polish.spacing.md,
    marginBottom: Polish.spacing.lg,
  },
  button: {
    flex: 1,
    borderRadius: Polish.radius.lg,
    padding: Polish.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Polish.shadow,
  },
  saveButton: {
    backgroundColor: Polish.colors.primary,
  },
  cancelButton: {
    backgroundColor: Polish.colors.surface,
    borderWidth: 2,
    borderColor: Polish.colors.border,
  },
  cancelButtonText: {
    color: Polish.colors.text,
  },
  logoutButton: {
    backgroundColor: Polish.colors.error,
    marginTop: Polish.spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...Polish.typography.button,
    color: '#fff',
  },
});
