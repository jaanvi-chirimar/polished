import { auth, db } from '@/firebase/config';
import type { Schedule } from '@/lib/time';
import { User, onAuthStateChanged } from 'firebase/auth';
import { deleteField, doc, DocumentData, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UserType = 'user' | 'nailTech';
export type PricingTierKey = 'tier1' | 'tier2' | 'tier3';
export const PRICING_TIER_KEYS: PricingTierKey[] = ['tier1', 'tier2', 'tier3'];

export interface PricingTier {
  name: string;
  description?: string;
  price: number;
  enabled: boolean;
}

export interface NailTechProfile {
  portfolio?: string[]; // Storage URLs; [0] is the cover photo
  availabilities?: { schedule: Schedule };
  tools?: string[];
  designs?: string[];
  bio?: string;
  location?: string;
  pricingTiers?: Partial<Record<PricingTierKey, PricingTier>>;
  usePricingTiers?: boolean;
  pricingDescription?: string;
  removalAddOn?: { enabled: boolean; price: number };
  paymentMethods?: string[];
  maxAppointmentsPerWeek?: number; // 0 = unlimited
  policies?: { reschedule?: string; late?: string };
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  roles: UserType[];
  firstName?: string;
  lastName?: string;
  profileCompleted: boolean;
  preferences?: string[];
  location?: string;
  instagramHandle?: string;
  nailTechProfile?: NailTechProfile;
  googleCalendar?: { accessToken: string; refreshToken: string; expiresAt: number };
  createdAt?: Date;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isTech: boolean;
  isCustomer: boolean;
  /** Writes the profile to Firestore and updates it app-wide. Undefined fields are removed. */
  saveProfile: (profile: UserProfile) => Promise<void>;
  /** Re-reads the profile from Firestore (after something else wrote to it). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isTech: false,
  isCustomer: false,
  saveProfile: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Turns a users/{uid} document into a UserProfile, accepting older data shapes. */
function parseProfile(uid: string, email: string | null, data: DocumentData): UserProfile {
  // Older docs stored a single role string or a `userType` field.
  const roles: UserType[] = Array.isArray(data.roles)
    ? data.roles
    : data.roles
      ? [data.roles]
      : data.userType
        ? [data.userType]
        : [];
  return {
    uid,
    email: data.email ?? email,
    roles,
    firstName: data.firstName,
    lastName: data.lastName,
    profileCompleted: data.profileCompleted ?? false,
    preferences: Array.isArray(data.preferences) ? data.preferences : data.preferences ? [data.preferences] : undefined,
    location: data.location,
    instagramHandle: data.instagramHandle,
    nailTechProfile: data.nailTechProfile,
    googleCalendar: data.googleCalendar,
    createdAt: data.createdAt?.toDate?.(),
  };
}

/** Recursively drops undefined values, which Firestore rejects. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value) || value === null || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
  ) as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (firebaseUser: User, fromServer = false) => {
    const ref = doc(db, 'users', firebaseUser.uid);
    try {
      const snap = fromServer ? await getDocFromServer(ref).catch(() => getDoc(ref)) : await getDoc(ref);
      setUserProfile(snap.exists() ? parseProfile(firebaseUser.uid, firebaseUser.email, snap.data()) : null);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      // Stay in the loading state until the profile is read, so the auth guard
      // doesn't briefly send returning users to /setup.
      setLoading(true);
      setUser(firebaseUser);
      if (firebaseUser) await loadProfile(firebaseUser);
      else setUserProfile(null);
      setLoading(false);
    });
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) await loadProfile(auth.currentUser, true);
  }, [loadProfile]);

  const saveProfile = useCallback(async (profile: UserProfile) => {
    // Calendar tokens are managed by lib/googleCalendar, so they're never written here.
    const { uid, googleCalendar, nailTechProfile, createdAt, ...fields } = profile;
    const data: Record<string, unknown> = { createdAt: createdAt ?? new Date() };
    for (const [key, value] of Object.entries(fields)) {
      data[key] = value === undefined ? deleteField() : value;
    }
    // Kept even when the tech role is turned off, so it comes back if it's turned on again.
    if (nailTechProfile) data.nailTechProfile = stripUndefined(nailTechProfile);

    // mergeFields replaces each listed field whole, so removed schedule days,
    // cleared bios, etc. are actually removed instead of deep-merged back in.
    await setDoc(doc(db, 'users', uid), data, { mergeFields: Object.keys(data) });
    setUserProfile(profile);
  }, []);

  const roles = userProfile?.roles ?? [];

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isTech: roles.includes('nailTech'),
        isCustomer: roles.includes('user'),
        saveProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
