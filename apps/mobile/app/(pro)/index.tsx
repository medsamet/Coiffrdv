import { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  formatTime, formatTND, SERVICE_LABELS, STATUS_META, sumMillimes,
} from '@coiffrdv/core';
import { fetchSalon, fetchSalonAppointments } from '../../src/lib/api';
import { useAsync } from '../../src/lib/useAsync';
import {
  Body, Button, Card, Empty, ErrorNotice, Heading, Label, Loading,
  Pill, Row, Screen, Separator, Small, Title,
} from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function ProDashboard() {
  const load = useCallback(async () => {
    const salon = await fetchSalon();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

    const [today, pending] = await Promise.all([
      fetchSalonAppointments(salon.id, { from: startOfDay, to: endOfDay }),
      fetchSalonAppointments(salon.id, { from: startOfDay }),
    ]);

    return { salon, today, pending: pending.filter((a) => a.status === 'pending') };
  }, []);

  const { data, error, loading, reload } = useAsync(load, []);

  if (loading) return <Loading />;
  if (error || !data) {
    return (
      <Screen>
        <ErrorNotice message={error ?? 'Chargement impossible.'} onRetry={reload} />
      </Screen>
    );
  }

  const { salon, today, pending } = data;
  const confirmedToday = today.filter((a) => a.status === 'confirmed');
  const revenue = sumMillimes(confirmedToday.map((a) => a.price_millimes));

  const now = new Date();
  const remaining = confirmedToday
    .filter((a) => new Date(a.starts_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <Screen>
      <View>
        <Small>
          {new Intl.DateTimeFormat('fr-FR', {
            timeZone: salon.timezone, weekday: 'long', day: 'numeric', month: 'long',
          }).format(now)}
        </Small>
        <Title>Tableau de bord</Title>
      </View>

      {pending.length > 0 ? (
        <Card tone="wait">
          <Body style={{ color: colors.warn, fontWeight: '700', fontSize: 15 }}>
            {pending.length} demande{pending.length > 1 ? 's' : ''} en attente
          </Body>
          <Small style={{ color: colors.warn }}>
            La plus ancienne a été reçue{' '}
            {relativeAge(new Date(pending[0]!.requested_at), now)}.
          </Small>
          <Button
            label="Traiter les demandes"
            small
            style={{ marginTop: 10, backgroundColor: colors.warn }}
            onPress={() => router.push('/(pro)/requests')}
          />
        </Card>
      ) : (
        <Card tone="ok">
          <Body style={{ color: colors.ok, fontWeight: '700' }}>Aucune demande en attente</Body>
          <Small style={{ color: colors.ok }}>Tout est traité.</Small>
        </Card>
      )}

      <Row gap={10}>
        <Card style={{ flex: 1 }}>
          <Label>RDV aujourd'hui</Label>
          <Heading style={{ fontSize: 26, marginTop: 2 }}>{confirmedToday.length}</Heading>
          <Small>{remaining.length} restant{remaining.length > 1 ? 's' : ''}</Small>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>Recette du jour</Label>
          <Heading style={{ fontSize: 26, marginTop: 2, color: colors.accentDark }}>
            {formatTND(revenue)}
          </Heading>
          <Small>prévisionnel</Small>
        </Card>
      </Row>

      <Label>Suite de la journée</Label>
      {remaining.length === 0 ? (
        <Empty icon="✅" title="Journée terminée" hint="Plus aucun rendez-vous après maintenant." />
      ) : (
        <Card>
          {remaining.map((appointment, index) => (
            <View key={appointment.id}>
              {index > 0 ? <Separator /> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700', color: colors.ink }}>
                    {appointment.client?.full_name ?? 'Client'}
                  </Body>
                  <Small>
                    {formatTime(new Date(appointment.starts_at), salon.timezone)} ·{' '}
                    {SERVICE_LABELS[appointment.service_kind]} ·{' '}
                    {formatTND(appointment.price_millimes)}
                  </Small>
                </View>
                <Pill tone={STATUS_META[appointment.status].tone}>
                  {STATUS_META[appointment.status].label}
                </Pill>
              </Row>
            </View>
          ))}
        </Card>
      )}

      <Button label="Voir l'agenda" variant="ghost" onPress={() => router.push('/(pro)/agenda')} />
    </Screen>
  );
}

function relativeAge(since: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((now.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}
