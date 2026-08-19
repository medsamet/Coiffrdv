import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { formatTND, STATUS_META, sumMillimes } from '@coiffrdv/core';
import { cancelAppointment, fetchMyAppointments, fetchSalon } from '../../src/lib/api';
import { useAsync } from '../../src/lib/useAsync';
import { AppointmentCard } from '../../src/components/AppointmentCard';
import {
  Card, Empty, ErrorNotice, Heading, Label, Loading, Row, Screen, Segmented, Small, Title,
} from '../../src/components/ui';
import type { Appointment } from '../../src/lib/types';
import { colors } from '../../src/theme';

export default function MyAppointments() {
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const salon = await fetchSalon();
    return { salon, appointments: await fetchMyAppointments() };
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

  const { salon, appointments } = data;
  const upcoming = appointments
    .filter((a) => STATUS_META[a.status].active)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const history = appointments.filter((a) => !STATUS_META[a.status].active);
  const honoured = history.filter((a) => a.status === 'completed');

  async function cancel(appointment: Appointment) {
    setActionError(null);
    setCancelling(appointment.id);
    try {
      await cancelAppointment(appointment.id);
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Annulation impossible.');
    } finally {
      setCancelling(null);
    }
  }

  const shown = tab === 'upcoming' ? upcoming : history;

  return (
    <Screen>
      <Title>Mes rendez-vous</Title>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: `À venir (${upcoming.length})` },
          { value: 'history', label: 'Historique' },
        ]}
      />

      {actionError ? <ErrorNotice message={actionError} /> : null}

      {tab === 'history' && honoured.length > 0 ? (
        <Row gap={10}>
          <Card style={{ flex: 1 }}>
            <Label>RDV honorés</Label>
            <Heading style={{ fontSize: 24, marginTop: 2 }}>{honoured.length}</Heading>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>Total dépensé</Label>
            <Heading style={{ fontSize: 24, marginTop: 2, color: colors.accentDark }}>
              {formatTND(sumMillimes(honoured.map((a) => a.price_millimes)))}
            </Heading>
          </Card>
        </Row>
      ) : null}

      {shown.length === 0 ? (
        <View style={{ marginTop: 20 }}>
          <Empty
            icon={tab === 'upcoming' ? '📅' : '🕘'}
            title={tab === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Pas encore d\'historique'}
            hint={tab === 'upcoming'
              ? 'Demandez un créneau depuis l\'onglet Réserver.'
              : 'Vos rendez-vous passés apparaîtront ici.'}
          />
        </View>
      ) : (
        shown.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            salon={salon}
            busy={cancelling === appointment.id}
            onCancel={tab === 'upcoming' ? cancel : undefined}
          />
        ))
      )}

      {tab === 'upcoming' && upcoming.length > 0 ? (
        <Small style={{ textAlign: 'center' }}>
          Annulation gratuite jusqu'à {salon.cancel_deadline_minutes / 60} h avant le rendez-vous.
        </Small>
      ) : null}
    </Screen>
  );
}
