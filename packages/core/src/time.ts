/**
 * Temps — tout est calculé dans le fuseau du SALON, pas dans celui du téléphone.
 *
 * Un client en déplacement à Paris doit voir « jeudi 11:00 » comme le voit son
 * coiffeur à La Marsa. On ne se repose donc jamais sur le fuseau local de
 * l'appareil : chaque fonction reçoit explicitement le fuseau du salon.
 */

export const DEFAULT_TZ = 'Africa/Tunis';

/** Minutes réellement occupées dans l'agenda : prestation + remise en état. */
export function occupancyMinutes(service: {
  durationMinutes: number;
  cleanupMinutes?: number;
}): number {
  return service.durationMinutes + (service.cleanupMinutes ?? 0);
}

function parts(date: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'long',
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

/** Clé de journée « 2026-08-27 » telle que la voit le salon. */
export function dayKey(date: Date, timeZone: string = DEFAULT_TZ): string {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** « 11:00 » dans le fuseau du salon. */
export function formatTime(date: Date, timeZone: string = DEFAULT_TZ): string {
  const p = parts(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** « jeudi 27 août 2026 » */
export function formatDayLong(date: Date, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

/** « jeu. 27 août » — pour les listes compactes. */
export function formatDayShort(date: Date, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short',
  }).format(date);
}

/** « 11:00 → 11:45 » : la fin affichée exclut la marge de nettoyage. */
export function formatSlotRange(
  start: Date,
  durationMinutes: number,
  timeZone: string = DEFAULT_TZ,
): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTime(start, timeZone)} → ${formatTime(end, timeZone)}`;
}

/** « 45 min », « 1 h », « 1 h 30 » */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/** 0 = dimanche … 6 = samedi, dans le fuseau du salon (même convention qu'en SQL). */
export function weekday(date: Date, timeZone: string = DEFAULT_TZ): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/**
 * Répartit les créneaux entre matin et après-midi, comme sur la maquette.
 * La bascule est à 12:00 heure du salon.
 */
export function splitHalfDay<T extends { start: Date }>(
  slots: readonly T[],
  timeZone: string = DEFAULT_TZ,
): { morning: T[]; afternoon: T[] } {
  const morning: T[] = [];
  const afternoon: T[] = [];
  for (const slot of slots) {
    const hour = Number(formatTime(slot.start, timeZone).slice(0, 2));
    (hour < 12 ? morning : afternoon).push(slot);
  }
  return { morning, afternoon };
}

/** Les N prochains jours à partir d'aujourd'hui, pour la bande de dates. */
export function nextDays(count: number, from: Date = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(from.getTime() + i * 86_400_000));
}
