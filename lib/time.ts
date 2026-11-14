/** Times are stored as 24-hour "HH:MM" strings, e.g. "14:30". */
export type TimeBlock = { start: string; end: string };

/** A tech's weekly hours: day name → time blocks, e.g. { Monday: [{ start: "14:00", end: "18:00" }] }. */
export type Schedule = Record<string, TimeBlock[]>;

/** Monday-first, for showing a week. */
export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAYS_BY_JS_INDEX = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Monday", "Tuesday"… for a date. */
export function dayName(date: Date): string {
  return DAYS_BY_JS_INDEX[date.getDay()];
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmFromDate(date: Date): string {
  return fromMinutes(date.getHours() * 60 + date.getMinutes());
}

/** A Date on the same day as `base`, at the given "HH:MM". */
export function dateAtTime(hhmm: string, base: Date = new Date()): Date {
  const d = new Date(base);
  const mins = toMinutes(hhmm);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

/** "14:30" → "2:30 PM" */
export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Cuts time blocks into slot start times, e.g. 14:00–15:00 → ["14:00", "14:30"]. */
export function generateSlots(blocks: TimeBlock[], stepMinutes = 30): string[] {
  const slots: string[] = [];
  for (const block of blocks) {
    const end = toMinutes(block.end);
    for (let t = toMinutes(block.start); t < end; t += stepMinutes) {
      slots.push(fromMinutes(t));
    }
  }
  return slots;
}

/** "Mon 2:00 PM–6:00 PM · Wed 10:00 AM–12:00 PM", in week order. Empty string if no hours. */
export function formatSchedule(schedule: Schedule | undefined): string {
  if (!schedule) return '';
  return DAYS_OF_WEEK.filter((day) => schedule[day]?.length)
    .map((day) => {
      const times = schedule[day].map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`).join(', ');
      return `${day.slice(0, 3)} ${times}`;
    })
    .join(' · ');
}
