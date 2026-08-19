import { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  formatDayLong, formatSlotRange, formatTND, SERVICE_LABELS, STATUS_META,
} from '@coiffrdv/core';
import { fetchMyAppointments, fetchSalon, fetchServices } from '../../src/lib/api';
import { useAsync } from '../../src/lib/useAsync';
import { useSession } from '../../src/lib/session';
import { ServiceCard } from '../../src/components/ServiceCard';
import {
  Body, Button, Card, ErrorNotice, Heading, Label, Loading, Pill, Row, Screen, Small, Title,
} from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function ClientHome() {
  const { profile } = useSession();

  const load = useCallback(async () => {
    const salon = await fetchSalon();
    const [services, appointments] = await Promise.all([
      fetchServices(salon.id),
      fetchMyAppointments(),
    ]);
    return { salon, services, appointments };
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

  const { salon, services, appointments } = data;
  const next = appointments
    .filter((a) => STATUS_META[a.status].active && new Date(a.starts_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'vous';

  return (
    <Screen>
      <View>
        <Small>Bonjour</Small>
        <Title>{firstName} 👋</Title>
      </View>

      {next ? (
        <Card style={{ backgroundColor: colors.ink, borderColor: colors.ink }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ color: '#b9ada0', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
              PROCHAIN RENDEZ-VOUS
            </Body>
            <Pill tone={STATUS_META[next.status].tone}>{STATUS_META[next.status].label}</Pill>
          </Row>
          <Body style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 8 }}>
            {formatDayLong(new Date(next.starts_at), salon.timezone)}
          </Body>
          <Body style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
            {formatSlotRange(new Date(next.starts_at), next.duration_minutes, salon.timezone)}
          </Body>
          <Body style={{ color: '#c7bcb0', fontSize: 13, marginTop: 4 }}>
            {SERVICE_LABELS[next.service_kind]} · {formatTND(next.price_millimes)}
          </Body>
          <Button
            label="Voir mes rendez-vous"
            variant="ghost"
            small
            style={{ marginTop: 12 }}
            onPress={() => router.push('/(client)/appointments')}
          />
        </Card>
      ) : (
        <Card>
          <Heading>Aucun rendez-vous à venir</Heading>
          <Small>Choisissez une prestation et un créneau, le coiffeur validera votre demande.</Small>
        </Card>
      )}

      <Button label="＋  Demander un rendez-vous" onPress={() => router.push('/(client)/book')} />

      <View style={{ marginTop: 8 }}>
        <Label>Prestations & tarifs</Label>
      </View>
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} onPress={() => router.push('/(client)/book')} />
      ))}

      <Card style={{ marginTop: 8 }}>
        <Heading>{salon.name}</Heading>
        <Small>{salon.address}</Small>
        <Small>Réglé sur place · annulation gratuite jusqu'à {salon.cancel_deadline_minutes / 60} h avant</Small>
      </Card>
    </Screen>
  );
}
