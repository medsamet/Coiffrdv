/**
 * Accès aux données. Une seule couche entre l'interface et Supabase, pour que
 * les écrans ne manipulent jamais de requête brute.
 *
 * Les fonctions métier (`request_appointment`, `decide_appointment`,
 * `cancel_appointment`) lèvent des exceptions PostgreSQL avec un code court —
 * `SLOT_UNAVAILABLE`, `CANCEL_DEADLINE_PASSED`… On les traduit ici en messages
 * lisibles, une fois pour toutes.
 */
import { supabase } from './supabase';
import type {
  Appointment, AppointmentWithClient, AvailableSlot,
  OpeningHour, Profile, Salon, Service,
} from './types';

/* ------------------------------------------------------------ traductions */

const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Connectez-vous pour demander un rendez-vous.',
  CLIENT_ONLY: 'Ce compte est un compte coiffeur : il ne peut pas réserver.',
  SERVICE_UNAVAILABLE: "Cette prestation n'est plus proposée par le salon.",
  SLOT_UNAVAILABLE: "Ce créneau vient d'être pris. Choisissez-en un autre.",
  CLIENT_DOUBLE_BOOKING: 'Vous avez déjà un rendez-vous sur ce créneau.',
  SLOT_TAKEN: 'Un rendez-vous confirmé occupe déjà ce créneau.',
  ALREADY_DECIDED: 'Cette demande a déjà été traitée.',
  NOT_CANCELLABLE: "Ce rendez-vous n'est plus annulable.",
  CANCEL_DEADLINE_PASSED:
    "Le délai d'annulation est dépassé. Appelez le salon pour prévenir.",
  FORBIDDEN: "Vous n'avez pas les droits pour cette action.",
  NOT_FOUND: 'Ce rendez-vous est introuvable.',
};

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, fallback: string) {
    super(MESSAGES[code] ?? fallback);
    this.code = code;
    this.name = 'ApiError';
  }
}

function fail(error: { message: string } | null): never {
  const raw = error?.message ?? 'Erreur inconnue';
  // Les codes métier sont levés seuls, en majuscules : « SLOT_UNAVAILABLE ».
  const code = raw.trim().split(/\s/)[0] ?? '';
  if (code in MESSAGES) throw new ApiError(code, raw);
  throw new ApiError('UNKNOWN', `Une erreur est survenue. (${raw})`);
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) fail(result.error);
  if (result.data === null) fail({ message: 'NOT_FOUND' });
  return result.data;
}

/* ---------------------------------------------------------------- lecture */

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  if (error) fail(error);
  return data as Profile | null;
}

/** Version 1 : un seul salon. On prend le premier. */
export async function fetchSalon(): Promise<Salon> {
  return unwrap(await supabase.from('salons').select('*').limit(1).single());
}

export async function fetchServices(salonId: string, includeInactive = false): Promise<Service[]> {
  let query = supabase.from('services').select('*').eq('salon_id', salonId).order('position');
  if (!includeInactive) query = query.eq('active', true);
  return unwrap(await query);
}

export async function fetchOpeningHours(salonId: string): Promise<OpeningHour[]> {
  return unwrap(
    await supabase.from('opening_hours').select('*').eq('salon_id', salonId).order('weekday'),
  );
}

/**
 * Les créneaux réellement libres, calculés par la base.
 * `day` est une date au format « 2026-08-27 », interprétée dans le fuseau du salon.
 */
export async function fetchAvailableSlots(serviceId: string, day: string): Promise<Date[]> {
  const { data, error } = await supabase.rpc('available_slots', {
    p_service_id: serviceId,
    p_day: day,
  });
  if (error) fail(error);
  return ((data ?? []) as AvailableSlot[]).map((slot) => new Date(slot.slot_start));
}

export async function fetchMyAppointments(): Promise<Appointment[]> {
  return unwrap(
    await supabase.from('appointments').select('*').order('starts_at', { ascending: false }),
  );
}

/** Vue du coiffeur : les rendez-vous du salon, avec la fiche du client. */
export async function fetchSalonAppointments(
  salonId: string,
  options: { from?: Date; to?: Date } = {},
): Promise<AppointmentWithClient[]> {
  let query = supabase
    .from('appointments')
    .select('*, client:profiles!appointments_client_id_fkey(id, full_name, email, phone, notify_channel)')
    .eq('salon_id', salonId)
    .order('starts_at');

  if (options.from) query = query.gte('starts_at', options.from.toISOString());
  if (options.to) query = query.lt('starts_at', options.to.toISOString());

  return unwrap(await query) as unknown as AppointmentWithClient[];
}

export async function fetchPendingRequests(salonId: string): Promise<AppointmentWithClient[]> {
  return unwrap(
    await supabase
      .from('appointments')
      .select('*, client:profiles!appointments_client_id_fkey(id, full_name, email, phone, notify_channel)')
      .eq('salon_id', salonId)
      .eq('status', 'pending')
      .order('requested_at'),
  ) as unknown as AppointmentWithClient[];
}

/* --------------------------------------------------------------- écriture */

export async function requestAppointment(
  serviceId: string, start: Date, note = '',
): Promise<Appointment> {
  const { data, error } = await supabase.rpc('request_appointment', {
    p_service_id: serviceId,
    p_start: start.toISOString(),
    p_note: note,
  });
  if (error) fail(error);
  return data as Appointment;
}

export async function decideAppointment(
  appointmentId: string, approve: boolean, reason = '',
): Promise<Appointment> {
  const { data, error } = await supabase.rpc('decide_appointment', {
    p_appointment_id: appointmentId,
    p_approve: approve,
    p_reason: reason,
  });
  if (error) fail(error);
  return data as Appointment;
}

export async function cancelAppointment(
  appointmentId: string, reason = '',
): Promise<Appointment> {
  const { data, error } = await supabase.rpc('cancel_appointment', {
    p_appointment_id: appointmentId,
    p_reason: reason,
  });
  if (error) fail(error);
  return data as Appointment;
}

export async function updateService(
  serviceId: string,
  patch: Partial<Pick<Service, 'duration_minutes' | 'cleanup_minutes' | 'price_millimes' | 'active' | 'name'>>,
): Promise<Service> {
  return unwrap(
    await supabase.from('services').update(patch).eq('id', serviceId).select().single(),
  );
}

export async function updateOpeningHour(
  id: string,
  patch: Partial<Pick<OpeningHour, 'is_open' | 'opens_at' | 'closes_at'>>,
): Promise<OpeningHour> {
  return unwrap(
    await supabase.from('opening_hours').update(patch).eq('id', id).select().single(),
  );
}

export async function blockTime(
  salonId: string, from: Date, to: Date, label: string,
  reason: 'break' | 'holiday' | 'training' | 'other' = 'other',
): Promise<void> {
  const { error } = await supabase.from('time_blocks').insert({
    salon_id: salonId,
    during: `[${from.toISOString()},${to.toISOString()})`,
    label,
    reason,
  });
  if (error) fail(error);
}
