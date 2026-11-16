import { Polished } from '@/constants/theme';
import { DAYS_OF_WEEK, Schedule, TimeBlock, dateAtTime, formatTime, fromMinutes, hhmmFromDate, toMinutes } from '@/lib/time';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DEFAULT_BLOCK: TimeBlock = { start: '10:00', end: '18:00' };

type Editing = { day: string; index: number; field: 'start' | 'end' };

/** Weekly hours editor: each day can have several time blocks. */
export default function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);

  const setDay = (day: string, blocks: TimeBlock[]) => {
    const next = { ...schedule, [day]: blocks };
    if (blocks.length === 0) delete next[day];
    onChange(next);
  };

  const pickTime = (day: string, index: number, field: 'start' | 'end', picked: Date) => {
    const block = schedule[day][index];
    const time = hhmmFromDate(picked);
    if (field === 'end' && toMinutes(time) <= toMinutes(block.start)) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }
    // Moving the start past the end pushes the end to an hour later.
    const updated =
      field === 'start' && toMinutes(time) >= toMinutes(block.end)
        ? { start: time, end: fromMinutes(Math.min(toMinutes(time) + 60, 23 * 60 + 59)) }
        : { ...block, [field]: time };
    setDay(day, schedule[day].map((b, i) => (i === index ? updated : b)));
  };

  const copyToAllDays = (day: string) => {
    Alert.alert('Copy to all days', `Apply ${day}'s hours to every day this week?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Copy',
        onPress: () => {
          onChange(Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, schedule[day].map((b) => ({ ...b }))])));
          setEditing(null);
        },
      },
    ]);
  };

  return (
    <View>
      {DAYS_OF_WEEK.map((day) => {
        const blocks = schedule[day] ?? [];
        const hasBlocks = blocks.length > 0;
        return (
          <View key={day} style={styles.day}>
            <View style={[styles.dayCircle, hasBlocks && styles.dayCircleActive]}>
              <Text style={[styles.dayCircleText, hasBlocks && styles.dayCircleTextActive]}>{day[0]}</Text>
            </View>

            <View style={{ flex: 1 }}>
              {!hasBlocks && <Text style={styles.unavailable}>Unavailable</Text>}
              {blocks.map((block, index) => {
                const isEditing = editing?.day === day && editing.index === index;
                return (
                  <View key={index}>
                    <View style={styles.blockRow}>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => setEditing({ day, index, field: 'start' })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.timeText}>{formatTime(block.start)}</Text>
                      </TouchableOpacity>
                      <Text style={styles.dash}>–</Text>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => setEditing({ day, index, field: 'end' })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.timeText}>{formatTime(block.end)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                          setDay(day, blocks.filter((_, i) => i !== index));
                          setEditing(null);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={16} color={Polished.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    {isEditing && Platform.OS !== 'web' && (
                      <DateTimePicker
                        value={dateAtTime(block[editing.field])}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        themeVariant="light"
                        onChange={(_e, picked) => {
                          if (Platform.OS !== 'ios') setEditing(null);
                          if (picked) pickTime(day, index, editing.field, picked);
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.dayActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setDay(day, [...blocks, { ...DEFAULT_BLOCK }]);
                  setEditing(null);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color={Polished.colors.primary} />
              </TouchableOpacity>
              {hasBlocks && (
                <TouchableOpacity style={styles.iconButton} onPress={() => copyToAllDays(day)} activeOpacity={0.8}>
                  <Ionicons name="copy-outline" size={17} color={Polished.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Polished.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Polished.colors.borderLight,
    gap: Polished.spacing.md,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Polished.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dayCircleActive: { backgroundColor: Polished.colors.primary, borderColor: Polished.colors.primary },
  dayCircleText: { ...Polished.typography.caption, fontWeight: '700', color: Polished.colors.textMuted },
  dayCircleTextActive: { color: '#fff' },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: Polished.spacing.sm, marginBottom: 4 },
  timeButton: {
    paddingHorizontal: Polished.spacing.md,
    paddingVertical: 6,
    borderRadius: Polished.radius.md,
    borderWidth: 1,
    borderColor: Polished.colors.border,
    backgroundColor: Polished.colors.background,
  },
  timeText: { ...Polished.typography.caption, color: Polished.colors.text, fontWeight: '500' },
  dash: { ...Polished.typography.caption, color: Polished.colors.textMuted },
  unavailable: { ...Polished.typography.caption, color: Polished.colors.textMuted, paddingVertical: 6 },
  dayActions: { alignItems: 'center', gap: 2 },
  iconButton: { padding: 4 },
});
