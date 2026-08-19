/**
 * Charte visuelle — reprise à l'identique des maquettes validées.
 * Un seul endroit pour les couleurs, les rayons et les échelles typographiques :
 * si la charte bouge, elle bouge ici.
 */

export const colors = {
  ink: '#1a1614',
  ink2: '#4a423d',
  muted: '#8a807a',

  bg: '#efe9e3',
  surface: '#ffffff',
  surfaceAlt: '#faf7f4',

  line: '#e6ded6',
  line2: '#d6ccc2',

  accent: '#b3762a',
  accentDark: '#8d5b1c',
  accentLight: '#fbf1e2',

  ok: '#2f7a4f',
  okLight: '#e8f4ed',
  warn: '#a8690c',
  warnLight: '#fdf1de',
  danger: '#ad3227',
  dangerLight: '#fbeae8',

  onAccent: '#ffffff',
} as const;

/** Couleurs de pastille par ton de statut (voir STATUS_META dans @coiffrdv/core). */
export const tones = {
  wait: { bg: colors.warnLight, fg: colors.warn },
  ok: { bg: colors.okLight, fg: colors.ok },
  danger: { bg: colors.dangerLight, fg: colors.danger },
  neutral: { bg: '#f0ebe6', fg: colors.muted },
} as const;

export const radius = { sm: 8, md: 11, lg: 14, pill: 999 } as const;

export const spacing = (n: number) => n * 4;

export const text = {
  h1: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  h3: { fontSize: 15, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  small: { fontSize: 12.5, color: colors.muted, lineHeight: 17 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
} as const;
