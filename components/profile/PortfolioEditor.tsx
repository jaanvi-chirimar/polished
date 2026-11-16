import { Polished } from '@/constants/theme';
import { pickAndUploadPhotos } from '@/lib/portfolio';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Portfolio photo grid: tap a photo to make it the cover, long-press to remove, + to upload.
 * Only changes the list; the screen decides when removed photos are deleted from Storage.
 */
export default function PortfolioEditor({
  uid,
  photos,
  onChange,
}: {
  uid: string;
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const addPhotos = async () => {
    setUploading(true);
    const urls = await pickAndUploadPhotos(uid);
    setUploading(false);
    if (urls.length) onChange([...photos, ...urls]);
  };

  return (
    <>
      <Text style={styles.hint}>Tap to set cover · Long press to remove</Text>
      <View style={styles.grid}>
        {photos.map((url, idx) => (
          <TouchableOpacity
            key={url}
            onPress={() => onChange([url, ...photos.filter((u) => u !== url)])}
            onLongPress={() => onChange(photos.filter((u) => u !== url))}
            activeOpacity={0.85}
          >
            <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
            {idx === 0 && (
              <View style={styles.coverBadge}>
                <Ionicons name="star" size={10} color="#fff" />
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            )}
            <View style={styles.removeIcon}>
              <Ionicons name="close-circle" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addPhotos} disabled={uploading} activeOpacity={0.8}>
          {uploading ? (
            <ActivityIndicator color={Polished.colors.primary} />
          ) : (
            <Ionicons name="add" size={28} color={Polished.colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

const THUMB_SIZE = 100;

const styles = StyleSheet.create({
  hint: { ...Polished.typography.caption, color: Polished.colors.textMuted, marginBottom: Polished.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Polished.spacing.sm, marginBottom: Polished.spacing.lg },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: Polished.radius.md, backgroundColor: Polished.colors.surface },
  removeIcon: { position: 'absolute', top: 4, right: 4 },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Polished.colors.primary,
    borderRadius: Polished.radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  coverBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  addButton: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Polished.radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Polished.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Polished.colors.surface,
  },
});
