import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

/** Build a display name from first/last, with a fallback */
export function buildFullName(firstName?: string, lastName?: string, fallback = 'Unknown'): string {
  return [firstName, lastName].filter(Boolean).join(' ') || fallback;
}

// Names rarely change, so each user's name is fetched once per app session.
const nameCache = new Map<string, Promise<{ firstName?: string; lastName?: string } | null>>();

/** Fetch a user's display name from Firestore by uid */
export async function getUserName(uid: string, fallback = 'Unknown'): Promise<string> {
  if (!nameCache.has(uid)) {
    const request = getDoc(doc(db, 'users', uid))
      .then((snap) => (snap.exists() ? (snap.data() as { firstName?: string; lastName?: string }) : null))
      .catch(() => {
        nameCache.delete(uid); // let a later call retry
        return null;
      });
    nameCache.set(uid, request);
  }
  const data = await nameCache.get(uid);
  return buildFullName(data?.firstName, data?.lastName, fallback);
}

/** Format a Date as "Mon, Jan 5 at 2:30 PM" */
export function formatDateTime(dt: Date): string {
  return `${dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })} at ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** Chat thread ID for two users: their uids sorted and joined, so both always get the same thread. */
export function getThreadId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/** The other person's uid in a chat thread. */
export function otherParticipant(threadId: string, myUid: string): string {
  return threadId.split('_').find((id) => id !== myUid) ?? myUid;
}

/** Adds the item if missing, removes it if present. */
export function toggleInList<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}
