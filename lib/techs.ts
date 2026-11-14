import { DEFAULT_PRICING_TIERS } from '@/constants/nailTechOptions';
import { NailTechProfile, PRICING_TIER_KEYS, PricingTier, PricingTierKey } from '@/contexts/AuthContext';
import { db } from '@/firebase/config';
import { buildFullName } from '@/lib/utils';
import { DocumentData, doc, getDocFromServer } from 'firebase/firestore';

/** A nail tech as shown to customers. */
export type Tech = {
  id: string;
  name: string;
  location: string;
  isTech: boolean;
  profile: NailTechProfile;
};

export function toTech(id: string, data: DocumentData): Tech {
  const profile: NailTechProfile = data.nailTechProfile ?? {};
  return {
    id,
    name: buildFullName(data.firstName, data.lastName, 'Unnamed Tech'),
    location: profile.location || data.location || '',
    isTech: Array.isArray(data.roles) && data.roles.includes('nailTech'),
    profile,
  };
}

/** Loads one tech, skipping the local cache so recent edits show up. Null if the user doesn't exist. */
export async function fetchTech(id: string): Promise<Tech | null> {
  const snap = await getDocFromServer(doc(db, 'users', id));
  return snap.exists() ? toTech(snap.id, snap.data()) : null;
}

/** Older profiles have no `usePricingTiers` flag: they use tiers if any tier is turned on. */
export function usesPricingTiers(profile: NailTechProfile | undefined): boolean {
  return profile?.usePricingTiers ?? PRICING_TIER_KEYS.some((k) => profile?.pricingTiers?.[k]?.enabled);
}

/** The tiers a customer can pick, with their real keys (tier1–3) and display labels. */
export function enabledTiers(profile: NailTechProfile | undefined) {
  return PRICING_TIER_KEYS.flatMap((key, i) => {
    const tier = profile?.pricingTiers?.[key];
    return tier?.enabled
      ? [{ key, tier, label: `Tier ${i + 1}: ${tier.name || DEFAULT_PRICING_TIERS[key].name}` }]
      : [];
  }) as { key: PricingTierKey; tier: PricingTier; label: string }[];
}
