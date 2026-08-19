import { View } from 'react-native';
import {
  canClientCancel, formatDayLong, formatDuration, formatSlotRange, formatTND,
  SERVICE_EMOJI, SERVICE_LABELS, STATUS_META,
} from '@coiffrdv/core';
import type { Appointment, Salon } from '../lib/types';
import { Body, Button, Card, Pill, Row, Separator, Small } from './ui';
import { colors } from '../theme';

export function AppointmentCard({
  appointment, salon, onCancel, busy,
}: {
  appointment: Appointment;
  salon: Salon;
  onCancel?: (appointment: Appointment) => void;
  busy?: boolean;
}) {
  const startsAt = new Date(appointment.starts_at);
  const meta = STATUS_META[appointment.status];

  const cancellable = canClientCancel(
    { status: appointment.status, startsAt },
    {
      cancelDeadlineMinutes: salon.cancel_deadline_minutes,
      minLeadMinutes: salon.min_lead_minutes,
      bookingHorizonDays: salon.booking_horizon_days,
    },
  );

  return (
    <Card style={!meta.active ? { opacity: 0.8 } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        <Small>{formatDayLong(startsAt, salon.timezone).split(' ').slice(0, 3).join(' ')}</Small>
      </Row>

      <Row style={{ marginTop: 10 }} align="flex-start">
        <Body style={{ fontSize: 20 }}>{SERVICE_EMOJI[appointment.service_kind]}</Body>
        <View style={{ flex: 1 }}>
          <Body style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>
            {formatDayLong(startsAt, salon.timezone)}
          </Body>
          <Body style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>
            {formatSlotRange(startsAt, appointment.duration_minutes, salon.timezone)}
          </Body>
          <Small style={{ marginTop: 2 }}>
            {SERVICE_LABELS[appointment.service_kind]} ·{' '}
            {formatDuration(appointment.duration_minutes)} ·{' '}
            {formatTND(appointment.price_millimes)}
          </Small>
        </View>
      </Row>

      {appointment.decision_reason ? (
        <Small style={{ marginTop: 8, fontStyle: 'italic' }}>
          « {appointment.decision_reason} »
        </Small>
      ) : null}

      {onCancel && meta.active ? (
        <>
          <Separator />
          {cancellable.allowed ? (
            <Button
              label={appointment.status === 'pending' ? 'Annuler la demande' : 'Annuler le rendez-vous'}
              variant="danger"
              small
              loading={busy}
              onPress={() => onCancel(appointment)}
            />
          ) : (
            <Small style={{ color: colors.danger }}>{cancellable.message}</Small>
          )}
        </>
      ) : null}
    </Card>
  );
}
