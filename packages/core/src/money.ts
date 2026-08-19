/**
 * Argent — dinar tunisien.
 *
 * Le dinar se divise en 1000 millimes. On stocke et on manipule des ENTIERS de
 * millimes ; aucun nombre à virgule flottante ne touche à un montant. `0.1 + 0.2`
 * ne vaut pas `0.3` en JavaScript, et ce genre de dérive n'a rien à faire dans
 * une addition de prix.
 */

export const MILLIMES_PER_DINAR = 1000;

/** 7 DT → 7000 millimes. */
export function dinarsToMillimes(dinars: number): number {
  return Math.round(dinars * MILLIMES_PER_DINAR);
}

/**
 * Formate un montant pour l'affichage.
 *
 *   formatTND(7000)  → "7 DT"
 *   formatTND(7500)  → "7,500 DT"
 *   formatTND(20000) → "20 DT"
 *
 * Les millimes ne sont affichés que s'il y en a : personne n'écrit « 20,000 DT »
 * sur une carte de tarifs de salon.
 */
export function formatTND(millimes: number, options: { withSuffix?: boolean } = {}): string {
  const { withSuffix = true } = options;
  const negative = millimes < 0;
  const abs = Math.abs(Math.round(millimes));

  const dinars = Math.floor(abs / MILLIMES_PER_DINAR);
  const rest = abs % MILLIMES_PER_DINAR;

  // Usage tunisien : quand il y a des millimes, on les écrit sur 3 chiffres
  // (« 7,500 DT »), jamais tronqués en « 7,5 ».
  const body = rest === 0
    ? String(dinars)
    : `${dinars},${String(rest).padStart(3, '0')}`;

  return `${negative ? '-' : ''}${body}${withSuffix ? ' DT' : ''}`;
}

/**
 * Lit une saisie utilisateur ("12", "12,5", "12.500") et rend des millimes.
 * Renvoie null si la saisie n'est pas un montant valide — au champ de décider
 * quoi en faire.
 */
export function parseTND(input: string): number | null {
  const cleaned = input.trim().replace(/\s|DT/gi, '').replace(',', '.');
  if (cleaned === '' || !/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;

  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * MILLIMES_PER_DINAR + Number(frac.padEnd(3, '0'));
}

/** Somme sûre d'une liste de montants. */
export function sumMillimes(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + Math.round(amount), 0);
}
