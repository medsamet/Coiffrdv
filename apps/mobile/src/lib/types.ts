/** Types de la base, écrits à la main pour rester lisibles.
 *  (`supabase gen types typescript` peut les régénérer si le schéma bouge.) */

export type AppRole = 'client' | 'barber';
export type ServiceKind = 'beard' | 'hair' | 'beard_hair' | 'kids';
export type NotifyChannel = 'email' | 'sms';
export type AppointmentStatus =
  | 'pending' | 'confirmed' | 'rejected'
  | 'cancelled_by_client' | 'cancelled_by_barber'
  | 'completed' | 'no_show';

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  notify_channel: NotifyChannel;
}

export interface Salon {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  phone: string | null;
  timezone: string;
  currency: string;
  booking_horizon_days: number;
  min_lead_minutes: number;
  cancel_deadline_minutes: number;
  slot_step_minutes: number;
  auto_confirm_regulars: boolean;
}

export interface Service {
  id: string;
  salon_id: string;
  kind: ServiceKind;
  name: string;
  description: string;
  duration_minutes: number;
  cleanup_minutes: number;
  price_millimes: number;
  active: boolean;
  position: number;
}

export interface OpeningHour {
  id: string;
  salon_id: string;
  weekday: number;      // 0 = dimanche … 6 = samedi
  is_open: boolean;
  opens_at: string;     // "09:00:00"
  closes_at: string;
}

export interface Appointment {
  id: string;
  salon_id: string;
  client_id: string;
  service_id: string;
  starts_at: string;    // ISO
  duration_minutes: number;
  cleanup_minutes: number;
  price_millimes: number;
  service_kind: ServiceKind;
  status: AppointmentStatus;
  client_note: string;
  decision_reason: string;
  cancel_reason: string;
  requested_at: string;
  decided_at: string | null;
  cancelled_at: string | null;
}

/** Rendez-vous joint au profil du client — vue du back-office. */
export interface AppointmentWithClient extends Appointment {
  client: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone' | 'notify_channel'> | null;
}

export interface AvailableSlot {
  slot_start: string;
  slot_end: string;
}
