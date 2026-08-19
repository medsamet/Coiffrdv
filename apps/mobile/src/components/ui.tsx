/**
 * Briques d'interface communes aux deux parcours et aux trois plateformes.
 * Rien de spécifique à iOS, Android ou au web : React Native Web rend le même
 * arbre dans un navigateur.
 */
import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { colors, radius, tones } from '../theme';

/* ------------------------------------------------------------------ texte */

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h2, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}
export function Small({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.small, style]}>{children}</Text>;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

/* ------------------------------------------------------------- conteneurs */

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={s.screen}>{children}</View>;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenContent}>
      {children}
    </ScrollView>
  );
}

export function Card({
  children, style, tone,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'wait' | 'ok' | 'danger' | 'neutral';
}) {
  const toned = tone ? { backgroundColor: tones[tone].bg, borderColor: tones[tone].bg } : null;
  return <View style={[s.card, toned, style]}>{children}</View>;
}

export function Row({
  children, gap = 10, style, align = 'center',
}: {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  align?: ViewStyle['alignItems'];
}) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function Separator() {
  return <View style={s.separator} />;
}

/* ---------------------------------------------------------------- actions */

type ButtonVariant = 'primary' | 'ghost' | 'dark' | 'danger' | 'success';

export function Button({
  label, onPress, variant = 'primary', disabled, loading, style, small,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        s[`btn_${variant}`],
        inactive && s.btnDisabled,
        pressed && !inactive && s.btnPressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'ghost' ? colors.ink : colors.onAccent} />
        : <Text style={[s.btnLabel, s[`btnLabel_${variant}`], small && s.btnLabelSmall]}>{label}</Text>}
    </Pressable>
  );
}

export function Pill({
  children, tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <View style={[s.pill, { backgroundColor: tones[tone].bg }]}>
      <Text style={[s.pillText, { color: tones[tone].fg }]}>{children}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- saisies */

export function Field({
  label, value, onChangeText, placeholder, keyboardType, secureTextEntry,
  autoCapitalize = 'none', error, editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words';
  error?: string | null;
  editable?: boolean;
}) {
  return (
    <View>
      <View style={[s.field, error ? s.fieldError : null, !editable && s.fieldDisabled]}>
        <Text style={s.fieldLabel}>{label}</Text>
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#b6aca4"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
        />
      </View>
      {error ? <Text style={s.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

/** Sélecteur segmenté — utilisé pour « Email / Téléphone » à l'inscription. */
export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[s.segment, active && s.segmentActive]}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ états */

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={s.centered}>
      <ActivityIndicator color={colors.accent} />
      <Small style={{ marginTop: 10 }}>{label}</Small>
    </View>
  );
}

export function Empty({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <View style={s.centered}>
      <Text style={{ fontSize: 34 }}>{icon}</Text>
      <Heading style={{ marginTop: 10, textAlign: 'center' }}>{title}</Heading>
      {hint ? <Small style={{ marginTop: 6, textAlign: 'center' }}>{hint}</Small> : null}
    </View>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="danger">
      <Text style={[s.body, { color: colors.danger }]}>{message}</Text>
      {onRetry ? <Button label="Réessayer" variant="ghost" small onPress={onRetry} style={{ marginTop: 10 }} /> : null}
    </Card>
  );
}

/* ----------------------------------------------------------------- styles */

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceAlt },
  screenContent: { padding: 16, gap: 12, paddingBottom: 40 },

  h1: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  body: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  small: { fontSize: 12.5, color: colors.muted, lineHeight: 17 },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', color: colors.muted,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
  },
  separator: { height: 1, backgroundColor: colors.line, marginVertical: 8 },

  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 46,
  },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 12, minHeight: 36, borderRadius: radius.sm },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.45 },
  btn_primary: { backgroundColor: colors.accent },
  btn_dark: { backgroundColor: colors.ink },
  btn_success: { backgroundColor: colors.ok },
  btn_ghost: { backgroundColor: colors.surface, borderColor: colors.line2 },
  btn_danger: { backgroundColor: colors.surface, borderColor: '#eccfcb' },
  btnLabel: { fontSize: 14, fontWeight: '700', color: colors.onAccent },
  btnLabelSmall: { fontSize: 12.5 },
  btnLabel_primary: { color: colors.onAccent },
  btnLabel_dark: { color: colors.onAccent },
  btnLabel_success: { color: colors.onAccent },
  btnLabel_ghost: { color: colors.ink },
  btnLabel_danger: { color: colors.danger },

  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },

  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  fieldDisabled: { backgroundColor: colors.surfaceAlt },
  fieldError: { borderColor: colors.danger },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.muted,
  },
  fieldInput: { fontSize: 15, color: colors.ink, paddingVertical: 4, minHeight: 26 },
  fieldErrorText: { fontSize: 12, color: colors.danger, marginTop: 4, marginLeft: 4 },

  segmented: {
    flexDirection: 'row', backgroundColor: '#efeae5',
    borderRadius: radius.md, padding: 3, gap: 3,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segmentTextActive: { color: colors.ink, fontWeight: '700' },

  centered: { alignItems: 'center', justifyContent: 'center', padding: 32 },
});
