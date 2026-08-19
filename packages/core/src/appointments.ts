/**
 * Règles de rendez-vous côté application.
 *
 * ⚠️ Ces fonctions servent à afficher la bonne interface (griser un bouton,
 * annoncer une échéance). Elles ne PROTÈGENT rien : l'autorité, c'est la base
 * de données (`cancel_appointment`, `request_appointment`, la contrainte
 * d'exclusion). Un client modifié qui contournerait ce fichier se ferait
 * refuser côté serveur. On duplique la règle ici uniquement pour éviter
 * d'envoyer l'utilisateur au-devant d'un refus qu'on peut prévoir.
 */

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled_by_client'
  | 'cancelled_by_barber'
  | 'completed'
  | 'no_show';

export type ServiceKind = 'beard' | 'hair' | 'beard_hair' | 'kids';

export interface StatusMeta {
  label: string;
  tone: 'wait' | 'ok' | 'danger' | 'neutral';
  /** Le rendez-vous compte-t-il encore dans « à venir » ? */
  active: boolean;
}

export const STATUS_META: Record<AppointmentStatus, StatusMeta> = {
  pending:             { label: 'En attente de validation', tone: 'wait',    active: true },
  confirmed:           { label: 'Confirmé',                 tone: 'ok',      active: true },
  rejected:            { label: 'Refusé par le coiffeur',   tone: 'danger',  active: false },
  cancelled_by_client: { label: 'Annulé par vous',          tone: 'neutral', active: false },
  cancelled_by_barber: { label: 'Annulé par le coiffeur',   tone: 'danger',  active: false },
  completed:           { label: 'Honoré',                   tone: 'neutral', active: false },
  no_show:             { label: 'Absence',                  tone: 'danger',  active: false },
};

export const SERVICE_LABELS: Record<ServiceKind, string> = {
  beard: 'Barbe',
  hair: 'Cheveux',
  beard_hair: 'Barbe + Cheveux',
  kids: 'Coupe enfant',
};

export const SERVICE_EMOJI: Record<ServiceKind, string> = {
  beard: '🪒',
  hair: '💇',
  beard_hair: '✨',
  kids: '🧒',
};

export interface SalonRules {
  cancelDeadlineMinutes: number;
  minLeadMinutes: number;
  bookingHorizonDays: number;
}

export interface AppointmentLike {
  status: AppointmentStatus;
  startsAt: Date;
}

/** Instant limite au-delà duquel le client ne peut plus annuler lui-même. */
export function cancelDeadline(startsAt: Date, rules: SalonRules): Date {
  return new Date(startsAt.getTime() - rules.cancelDeadlineMinutes * 60_000);
}

export type CancelDecision =
  | { allowed: true }
  | { allowed: false; reason: 'not_cancellable' | 'deadline_passed'; message: string };

/**
 * Le client peut-il annuler ?
 *
 * Une demande encore « en attente » se retire à tout moment — le coiffeur n'a
 * rien réservé. Un rendez-vous confirmé, lui, est soumis au délai fixé par le
 * salon.
 */
export function canClientCancel(
  appointment: AppointmentLike,
  rules: SalonRules,
  now: Date = new Date(),
): CancelDecision {
  if (appointment.status === 'pending') return { allowed: true };

  if (appointment.status !== 'confirmed') {
    return {
      allowed: false,
      reason: 'not_cancellable',
      message: "Ce rendez-vous n'est plus annulable.",
    };
  }

  const deadline = cancelDeadline(appointment.startsAt, rules);
  if (now.getTime() > deadline.getTime()) {
    return {
      allowed: false,
      reason: 'deadline_passed',
      message: `L'annulation n'est plus possible moins de ${rules.cancelDeadlineMinutes} minutes avant le rendez-vous. Appelez le salon.`,
    };
  }
  return { allowed: true };
}

/** Le coiffeur annule quand il veut : c'est son agenda. */
export function canBarberCancel(appointment: AppointmentLike): boolean {
  return appointment.status === 'pending' || appointment.status === 'confirmed';
}

/** Deux plages [début, fin) se chevauchent-elles ? */
export function overlaps(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Repère les demandes en attente qui se marchent dessus, pour afficher
 * l'avertissement « conflit d'horaire » du back-office.
 */
export function findConflicts<T extends { id: string; start: Date; end: Date; status: AppointmentStatus }>(
  appointments: readonly T[],
): Map<string, T[]> {
  const conflicts = new Map<string, T[]>();
  const relevant = appointments.filter((a) => a.status === 'pending' || a.status === 'confirmed');

  for (const a of relevant) {
    const against = relevant.filter((b) => b.id !== a.id && overlaps(a, b));
    if (against.length > 0) conflicts.set(a.id, against);
  }
  return conflicts;
}

/** Tri d'affichage : les demandes les plus anciennes d'abord, elles attendent. */
export function sortPendingFirst<T extends { status: AppointmentStatus; requestedAt: Date; startsAt: Date }>(
  appointments: readonly T[],
): T[] {
  return [...appointments].sort((a, b) => {
    const aPending = a.status === 'pending' ? 0 : 1;
    const bPending = b.status === 'pending' ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    if (aPending === 0) return a.requestedAt.getTime() - b.requestedAt.getTime();
    return a.startsAt.getTime() - b.startsAt.getTime();
  });
}
