import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';

const STAR_COLOR = '#F5A623';

/** Shows a 1–5 star rating. Pass `onChange` to make the stars tappable. */
export default function Stars({
  rating,
  size = 14,
  onChange,
}: {
  rating: number;
  size?: number;
  onChange?: (rating: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const star = <Ionicons name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={STAR_COLOR} />;
        return onChange ? (
          <TouchableOpacity key={i} onPress={() => onChange(i)} activeOpacity={0.7}>
            {star}
          </TouchableOpacity>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}
