/**
 * Génération de la grille de créneaux — miroir TypeScript de la fonction SQL
 * `public.available_slots`.
 *
 * Pourquoi deux implémentations ? La version SQL fait autorité : c'est elle qui
 * décide si une demande est recevable, et elle est la seule à voir les
 * rendez-vous des autres clients. La version TypeScript sert à afficher la
 * grille instantanément (aperçu du back-office, affichage optimiste après un
 * changement de durée) sans aller-retour réseau.
 *
 * Les deux suivent le même algorithme, et le test de parité
 * `tests/slots.test.ts` compare leurs résultats sur les mêmes données.
 */

export interface DayWindow {
  /** Minutes depuis minuit, heure du salon. */
  opensAtMinutes: number;
  closesAtMinutes: number;
}

export interface MinuteRange {
  startMinutes: number;
  endMinutes: number;
}

export interface SlotInput {
  window: DayWindow | null;      // null = salon fermé ce jour-là
  /** Pauses récurrentes et blocages, exprimés en minutes depuis minuit. */
  unavailable: readonly MinuteRange[];
  /** Durée facturée + marge de nettoyage. */
  occupancyMinutes: number;
  /** Durée facturée seule : sert à calculer l'heure de fin montrée au client. */
  durationMinutes: number;
  stepMinutes: number;
  /** Première minute réservable (délai minimum). Absente = pas de contrainte. */
  earliestStartMinutes?: number;
}

export interface Slot {
  startMinutes: number;
  endMinutes: number;
}

function rangesOverlap(a: MinuteRange, b: MinuteRange): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/**
 * Rend la liste des départs possibles.
 *
 * Un créneau est retenu si sa plage d'occupation entière tient dans les heures
 * d'ouverture et ne touche aucune indisponibilité. On ne « rogne » jamais un
 * créneau : mieux vaut ne pas le proposer que de faire déborder le coiffeur sur
 * sa pause.
 */
export function buildSlots(input: SlotInput): Slot[] {
  const {
    window, unavailable, occupancyMinutes, durationMinutes,
    stepMinutes, earliestStartMinutes,
  } = input;

  if (!window) return [];
  if (occupancyMinutes <= 0 || stepMinutes <= 0) return [];

  const slots: Slot[] = [];
  for (
    let start = window.opensAtMinutes;
    start + occupancyMinutes <= window.closesAtMinutes;
    start += stepMinutes
  ) {
    if (earliestStartMinutes !== undefined && start < earliestStartMinutes) continue;

    const occupancy: MinuteRange = { startMinutes: start, endMinutes: start + occupancyMinutes };
    if (unavailable.some((range) => rangesOverlap(occupancy, range))) continue;

    slots.push({ startMinutes: start, endMinutes: start + durationMinutes });
  }
  return slots;
}

/** 690 → "11:30" */
export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "11:30" → 690 */
export function labelToMinutes(label: string): number {
  const [h, m] = label.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Combien de créneaux gagnerait-on en raccourcissant une prestation ?
 * Alimente l'encart « passer la durée à 30 min ferait apparaître N créneaux »
 * de l'écran Prestations.
 */
export function slotCountDelta(base: SlotInput, newDurationMinutes: number): number {
  const cleanup = base.occupancyMinutes - base.durationMinutes;
  const after = buildSlots({
    ...base,
    durationMinutes: newDurationMinutes,
    occupancyMinutes: newDurationMinutes + cleanup,
  });
  return after.length - buildSlots(base).length;
}
