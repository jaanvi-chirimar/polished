import { db } from '@/firebase/config';
import { getUserName } from '@/lib/utils';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export type AppointmentStatus = 'pending' | 'confirmed' | 'declined';

export type Appointment = {
  id: string;
  clientId: string;
  techId: string;
  dateTime: Date;
  status: AppointmentStatus;
  appointmentType?: string;
  note?: string;
  altTimeRequest?: string;
  clientCalendarEventId?: string;
  techCalendarEventId?: string;
  /** The other person's name: the tech's for a client, the client's for a tech. */
  otherName: string;
};

/**
 * Live list of the user's appointments, either as the client or as the tech,
 * with the other person's name filled in. Returns the unsubscribe function.
 */
export function subscribeToAppointments(
  as: 'client' | 'tech',
  uid: string,
  onChange: (appointments: Appointment[]) => void,
  onError?: (error: Error) => void
) {
  const field = as === 'client' ? 'clientId' : 'techId';
  let latest = 0;

  return onSnapshot(
    query(collection(db, 'appointments'), where(field, '==', uid)),
    async (snapshot) => {
      const run = ++latest;
      const appointments = await Promise.all(
        snapshot.docs
          .filter((d) => d.data().dateTime?.toDate)
          .map(async (d) => {
            const data = d.data();
            const otherId = as === 'client' ? data.techId : data.clientId;
            return {
              id: d.id,
              clientId: data.clientId,
              techId: data.techId,
              dateTime: data.dateTime.toDate(),
              status: data.status || 'pending',
              appointmentType: data.appointmentType,
              note: data.note,
              altTimeRequest: data.altTimeRequest,
              clientCalendarEventId: data.clientCalendarEventId,
              techCalendarEventId: data.techCalendarEventId,
              otherName: await getUserName(otherId, as === 'client' ? 'Tech' : 'Client'),
            } as Appointment;
          })
      );
      // Ignore results from an older snapshot that finished after a newer one.
      if (run === latest) onChange(appointments);
    },
    (error) => {
      console.error(`Appointments (${as}) listener:`, error);
      onError?.(error);
    }
  );
}

export const byDateAsc = (a: Appointment, b: Appointment) => a.dateTime.getTime() - b.dateTime.getTime();
export const byDateDesc = (a: Appointment, b: Appointment) => b.dateTime.getTime() - a.dateTime.getTime();
