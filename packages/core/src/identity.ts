/**
 * Identifiant de connexion : email OU téléphone.
 * Toute la normalisation des numéros tunisiens tient ici.
 */

export type IdentityMode = 'email' | 'phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Met un numéro tunisien au format international attendu par Supabase.
 *
 *   "98 76 54 32"    → "+21698765432"
 *   "0021698765432"  → "+21698765432"
 *   "+216 98765432"  → "+21698765432"
 *
 * Renvoie null si ce n'est pas un numéro tunisien à 8 chiffres.
 */
export function normalizeTunisianPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, '');

  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('216')) digits = digits.slice(3);

  // Un numéro tunisien fait 8 chiffres et commence par 2, 4, 5, 7 ou 9.
  if (!/^[24579]\d{7}$/.test(digits)) return null;
  return `+216${digits}`;
}

/** "+21698765432" → "+216 98 76 54 32" */
export function formatTunisianPhone(e164: string): string {
  const local = e164.replace('+216', '');
  if (local.length !== 8) return e164;
  return `+216 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
}

/** Masque partiellement un identifiant, pour l'écran de vérification. */
export function maskIdentity(value: string, mode: IdentityMode): string {
  if (mode === 'phone') {
    const local = value.replace('+216', '');
    return `+216 ${local.slice(0, 2)} •• •• ${local.slice(6)}`;
  }
  const [user = '', domain = ''] = value.split('@');
  const head = user.slice(0, Math.min(3, user.length));
  return `${head}${'•'.repeat(Math.max(1, user.length - head.length))}@${domain}`;
}

export interface IdentityCheck {
  ok: boolean;
  value: string;
  error: string | null;
}

export function checkIdentity(raw: string, mode: IdentityMode): IdentityCheck {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return {
      ok: false,
      value: trimmed,
      error: mode === 'email' ? 'Indiquez votre adresse email.' : 'Indiquez votre numéro.',
    };
  }

  if (mode === 'email') {
    return isValidEmail(trimmed)
      ? { ok: true, value: trimmed.toLowerCase(), error: null }
      : { ok: false, value: trimmed, error: "Cette adresse email n'a pas l'air valide." };
  }

  const normalized = normalizeTunisianPhone(trimmed);
  return normalized
    ? { ok: true, value: normalized, error: null }
    : { ok: false, value: trimmed, error: 'Entrez un numéro tunisien à 8 chiffres.' };
}
