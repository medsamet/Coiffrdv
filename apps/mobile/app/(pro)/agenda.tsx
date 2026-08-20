import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  dayKey, formatDayShort, formatSlotRange, formatTND, nextDays,
  SERVICE_LABELS, STATUS_META,
} from '@coiffrdv/core';
import { cancelAppointment, fetchSalon, fetchSalonAppointments } from '../../src/lib/api';
import { useAsync } from '../../src/lib/useAsync';
import {
  Body, Button, Card, Empty, ErrorNotice, Loading, Pill, Row, Screen, Small, Title,
} from '../../src/components/ui';
import { colors, radius } from '../../src/theme';

export default function Agenda() {
  const [day, setDay] = useState(new Date());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const salon = await fetchSalon();

    const from = new Date(day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 86_400_000);

    return { salon, appointments: await fetchSalonAppointments(salon.id, { from, to }) };
  }, [day]);

  const { data, error, loading, reload } = useAsync(load, [day.toDateString()]);

  async function cancel(id: string) {
    setActionError(null);
    setBusyId(id);
    try {
      await cancelAppointment(id, 'Annulé par le salon');
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Annulation impossible.');
    } finally {
      setBusyId(null);
    }
  }

  const salon = data?.salon;
  const visible = (data?.appointments ?? []).filter((a) => STATUS_META[a.status].active);

  return (
    <Screen>
      <Title>Agenda</Title>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {nextDays(10, new Date()).map((candidate) => {
          const tz = salon?.timezone ?? 'Africa/Tunis';
          const active = dayKey(candidate, tz) === dayKey(day, tz);
          return (
            <Pressable
              key={candidate.toISOString()}
              onPress={() => setDay(candidate)}
              style={{
                paddingVertical: 8, paddingHorizontal: 12,
                borderRadius: radius.md, borderWidth: 1,
                backgroundColor: active ? colors.ink : colors.surface,
                borderColor: active ? colors.ink : colors.line2,
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#fff' : colors.ink }}>
                {formatDayShort(candidate, tz)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? <Loading /> : null}
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {actionError ? <ErrorNotice message={actionError} /> : null}

      {!loading && !error && salon ? (
        visible.length === 0 ? (
          <View style={{ marginTop: 20 }}>
            <Empty icon="🗓️" title="Journée libre" hint="Aucun rendez-vous ce jour-là." />
          </View>
        ) : (
          <>
            <Small>
              {visible.length} rendez-vous ·{' '}
              {formatTND(
                visible
                  .filter((a) => a.status === 'confirmed')
                  .reduce((total, a) => total + a.price_millimes, 0),
              )}
            </Small>

            {visible.map((appointment) => {
              const meta = STATUS_META[appointment.status];
              return (
                <Card key={appointment.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body style={{ fontWeight: '700', color: colors.ink, fontSize: 15 }}>
                      {formatSlotRange(
                        new Date(appointment.starts_at),
                        appointment.duration_minutes,
                        salon.timezone,
                      )}
                    </Body>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </Row>
                  <Body style={{ fontWeight: '700', color: colors.ink, marginTop: 6 }}>
                    {appointment.client?.full_name ?? 'Client'}
                  </Body>
                  <Small>
                    {SERVICE_LABELS[appointment.service_kind]} ·{' '}
                    {formatTND(appointment.price_millimes)}
                  </Small>
                  {appointment.client_note ? (
                    <Small style={{ fontStyle: 'italic', marginTop: 4 }}>
                      « {appointment.client_note} »
                    </Small>
                  ) : null}
                  <Button
                    label="Annuler ce rendez-vous"
                    variant="danger"
                    small
                    style={{ marginTop: 10 }}
                    loading={busyId === appointment.id}
                    onPress={() => cancel(appointment.id)}
                  />
                </Card>
              );
            })}
          </>
        )
      ) : null}
    </Screen>
  );
}
