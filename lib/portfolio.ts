import { storage } from '@/firebase/config';
import * as ImagePicker from 'expo-image-picker';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Alert } from 'react-native';

/** Reads a local file as a Blob. XHR is more reliable than fetch() for this in React Native. */
function readBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Could not read photo'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/** Lets the user pick photos and uploads them. Returns the new download URLs ([] if cancelled or failed). */
export async function pickAndUploadPhotos(uid: string): Promise<string[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow access to your photo library.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: true,
  });
  if (result.canceled || !result.assets.length) return [];

  try {
    return await Promise.all(
      result.assets.map(async (asset) => {
        const photoRef = ref(storage, `portfolios/${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
        await uploadBytes(photoRef, await readBlob(asset.uri));
        return getDownloadURL(photoRef);
      })
    );
  } catch (e) {
    console.error('Portfolio upload error:', e);
    Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
    return [];
  }
}

/** Deletes photos that were in `before` but not in `after`. Best effort: failures are ignored. */
export function deleteRemovedPhotos(before: string[], after: string[]) {
  for (const url of before) {
    if (!after.includes(url)) deleteObject(ref(storage, url)).catch(() => {});
  }
}
