import { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  findConflicts, formatDayLong, formatDuration, formatSlotRange, formatTND,
  formatTunisianPhone, SERVICE_EMOJI, SERVICE_LABELS,
} from '@coiffrdv/core';
import { decideAppointment, fetchPendingRequests, fetchSalon } from '../../src/lib/api';
import { useAsync } from '../../src/lib/useAsync';
import {
  Body, Button, Card, Empty, ErrorNotice, Field, Loading, Pill, Row, Screen,
  Separator, Small, Title,
} from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function Requests() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const salon = await fetchSalon();
    return { salon, requests: await fetchPendingRequests(salon.id) };
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

  const { salon, requests } = data;

  // Deux demandes peuvent viser le même créneau : on le signale avant de valider.
  const conflicts = findConflicts(
    requests.map((request) => ({
      id: request.id,
      status: request.status,
      start: new Date(request.starts_at),
      end: new Date(
        new Date(request.starts_at).getTime()
        + (request.duration_minutes + request.cleanup_minutes) * 60_000,
      ),
    })),
  );

  async function decide(id: string, approve: boolean, why = '') {
    setActionError(null);
    setBusyId(id);
    try {
      await decideAppointment(id, approve, why);
      setRejecting(null);
      setReason('');
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Action impossible.');
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <Title>Demandes</Title>
      <Small>
        {requests.length === 0
          ? 'Rien à traiter.'
          : `${requests.length} demande${requests.length > 1 ? 's' : ''} en attente de votre décision.`}
      </Small>

      {actionError ? <ErrorNotice message={actionError} /> : null}

      {requests.length === 0 ? (
        <View style={{ marginTop: 24 }}>
          <Empty icon="✅" title="Aucune demande en attente" hint="Vous êtes à jour." />
        </View>
      ) : null}

      {requests.map((request) => {
        const conflictWith = conflicts.get(request.id);
        const startsAt = new Date(request.starts_at);
        const contact = request.client?.notify_channel === 'sms'
          ? `📱 ${formatTunisianPhone(request.client?.phone ?? '')}`
          : `✉️ ${request.client?.email ?? ''}`;

        return (
          <Card key={request.id} style={conflictWith ? { borderColor: '#eccfcb' } : undefined}>
            <Row style={{ justifyContent: 'space-between' }} align="flex-start">
              <View style={{ flex: 1 }}>
                <Body style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>
                  {request.client?.full_name ?? 'Client'}
                </Body>
                <Small>{contact}</Small>
              </View>
              {conflictWith ? <Pill tone="danger">⚠ Conflit</Pill> : <Pill tone="wait">En attente</Pill>}
            </Row>

            <Separator />

            <Row align="flex-start">
              <Body style={{ fontSize: 20 }}>{SERVICE_EMOJI[request.service_kind]}</Body>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700', color: colors.ink }}>
                  {formatDayLong(startsAt, salon.timezone)}
                </Body>
                <Body style={{ fontWeight: '700', color: colors.ink }}>
                  {formatSlotRange(startsAt, request.duration_minutes, salon.timezone)}
                </Body>
                <Small>
                  {SERVICE_LABELS[request.service_kind]} ·{' '}
                  {formatDuration(request.duration_minutes)} ·{' '}
                  {formatTND(request.price_millimes)}
                </Small>
              </View>
            </Row>

            {request.client_note ? (
              <Small style={{ fontStyle: 'italic', marginTop: 6 }}>« {request.client_note} »</Small>
            ) : null}

            {conflictWith ? (
              <Card tone="danger" style={{ marginTop: 8 }}>
                <Small style={{ color: colors.danger }}>
                  Cette demande chevauche {conflictWith.length} autre
                  {conflictWith.length > 1 ? 's' : ''} demande
                  {conflictWith.length > 1 ? 's' : ''}. En valider une refusera
                  automatiquement l'autre.
                </Small>
              </Card>
            ) : null}

            {rejecting === request.id ? (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Field
                  label="Motif du refus (transmis au client)"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Ex. créneau finalement indisponible"
                  autoCapitalize="words"
                />
                <Row gap={8}>
                  <Button
                    label="Retour"
                    variant="ghost"
                    small
                    style={{ flex: 1 }}
                    onPress={() => { setRejecting(null); setReason(''); }}
                  />
                  <Button
                    label="Confirmer le refus"
                    variant="danger"
                    small
                    style={{ flex: 2 }}
                    loading={busyId === request.id}
                    onPress={() => decide(request.id, false, reason)}
                  />
                </Row>
              </View>
            ) : (
              <Row gap={8} style={{ marginTop: 10 }}>
                <Button
                  label="Refuser"
                  variant="danger"
                  small
                  style={{ flex: 1 }}
                  onPress={() => { setRejecting(request.id); setReason(''); }}
                />
                <Button
                  label="✓  Valider"
                  variant="success"
                  small
                  style={{ flex: 1.6 }}
                  loading={busyId === request.id}
                  onPress={() => decide(request.id, true)}
                />
              </Row>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
