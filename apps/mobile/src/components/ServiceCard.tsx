import { Pressable, Text, View } from 'react-native';
import { formatDuration, formatTND, SERVICE_EMOJI } from '@coiffrdv/core';
import type { Service } from '../lib/types';
import { colors, radius } from '../theme';

export function ServiceCard({
  service, selected, onPress,
}: {
  service: Service;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: selected ? colors.accentLight : colors.surface,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.accent : colors.line,
          borderRadius: radius.lg,
          padding: selected ? 12 : 13,
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View
        style={{
          width: 38, height: 38, borderRadius: radius.md,
          backgroundColor: selected ? colors.surface : colors.accentLight,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18 }}>{SERVICE_EMOJI[service.kind]}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{service.name}</Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
          {service.description ? `${service.description} · ` : ''}
          {formatDuration(service.duration_minutes)}
        </Text>
      </View>

      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>
        {formatTND(service.price_millimes)}
      </Text>
    </Pressable>
  );
}
