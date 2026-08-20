import { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';
import {
  formatTND, parseTND, SERVICE_EMOJI, slotCountDelta, labelToMinutes,
} from '@coiffrdv/core';
import {
  fetchOpeningHours, fetchSalon, fetchServices, updateOpeningHour, updateService,
} from '../../src/lib/api';
import { useAsync } from '../../src/lib/useAsync';
import { useSession } from '../../src/lib/session';
import {
  Body, Button, Card, ErrorNotice, Field, Label, Loading, Row, Screen,
  Separator, Small, Title,
} from '../../src/components/ui';
import { colors } from '../../src/theme';
import type { Service } from '../../src/lib/types';

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function Settings() {
  const { signOut } = useSession();
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const salon = await fetchSalon();
    const [services, hours] = await Promise.all([
      fetchServices(salon.id, true),
      fetchOpeningHours(salon.id),
    ]);
    return { salon, services, hours };
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

  const { salon, services, hours } = data;

  async function saveService(service: Service, patch: Parameters<typeof updateService>[1]) {
    setActionError(null);
    setSaving(service.id);
    try {
      await updateService(service.id, patch);
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen>
      <Title>Réglages</Title>

      {actionError ? <ErrorNotice message={actionError} /> : null}

      <Label>Prestations, durées & tarifs</Label>
      <Small>
        La durée fixée ici détermine la taille des créneaux proposés aux clients.
      </Small>

      {services.map((service) => (
        <ServiceEditor
          key={service.id}
          service={service}
          salonStep={salon.slot_step_minutes}
          saving={saving === service.id}
          onSave={(patch) => saveService(service, patch)}
        />
      ))}

      <Label>Horaires d'ouverture</Label>
      <Card>
        {hours.map((hour, index) => (
          <View key={hour.id}>
            {index > 0 ? <Separator /> : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ width: 90, fontWeight: '600', color: colors.ink }}>
                {WEEKDAYS[hour.weekday]}
              </Body>
              <Small style={{ flex: 1 }}>
                {hour.is_open
                  ? `${hour.opens_at.slice(0, 5)} – ${hour.closes_at.slice(0, 5)}`
                  : 'Fermé'}
              </Small>
              <Switch
                value={hour.is_open}
                trackColor={{ true: colors.ok, false: '#ddd5cd' }}
                onValueChange={async (next) => {
                  setActionError(null);
                  try {
                    await updateOpeningHour(hour.id, { is_open: next });
                    reload();
                  } catch (cause) {
                    setActionError(cause instanceof Error ? cause.message : 'Erreur.');
                  }
                }}
              />
            </Row>
          </View>
        ))}
      </Card>

      <Label>Règles de réservation</Label>
      <Card>
        <Rule label="Réservation possible jusqu'à" value={`${salon.booking_horizon_days} jours à l'avance`} />
        <Separator />
        <Rule label="Délai minimum avant un RDV" value={`${salon.min_lead_minutes} min`} />
        <Separator />
        <Rule label="Annulation client autorisée jusqu'à" value={`${salon.cancel_deadline_minutes} min avant`} />
        <Separator />
        <Rule label="Pas de la grille de créneaux" value={`${salon.slot_step_minutes} min`} />
      </Card>

      <Button label="Se déconnecter" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Small style={{ flex: 1 }}>{label}</Small>
      <Body style={{ fontWeight: '700', color: colors.ink }}>{value}</Body>
    </Row>
  );
}

function ServiceEditor({
  service, salonStep, saving, onSave,
}: {
  service: Service;
  salonStep: number;
  saving: boolean;
  onSave: (patch: { duration_minutes?: number; price_millimes?: number; active?: boolean }) => void;
}) {
  const [duration, setDuration] = useState(String(service.duration_minutes));
  const [price, setPrice] = useState(formatTND(service.price_millimes, { withSuffix: false }));
  const [error, setError] = useState<string | null>(null);

  const parsedDuration = Number(duration);
  const parsedPrice = parseTND(price);
  const dirty =
    parsedDuration !== service.duration_minutes || parsedPrice !== service.price_millimes;

  // Aperçu immédiat de l'effet d'un changement de durée sur une journée type
  // 09:00–19:00 avec pause déjeuner. Purement indicatif : la grille réelle est
  // calculée par la base.
  const delta = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? slotCountDelta(
        {
          window: { opensAtMinutes: labelToMinutes('09:00'), closesAtMinutes: labelToMinutes('19:00') },
          unavailable: [{ startMinutes: labelToMinutes('12:00'), endMinutes: labelToMinutes('14:00') }],
          durationMinutes: service.duration_minutes,
          occupancyMinutes: service.duration_minutes + service.cleanup_minutes,
          stepMinutes: salonStep,
        },
        parsedDuration,
      )
    : 0;

  function submit() {
    setError(null);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 5 || parsedDuration > 480) {
      setError('La durée doit être un nombre de minutes entre 5 et 480.');
      return;
    }
    if (parsedPrice === null) {
      setError('Tarif invalide. Exemples : 20 · 12,500');
      return;
    }
    onSave({ duration_minutes: parsedDuration, price_millimes: parsedPrice });
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Body style={{ fontSize: 18 }}>{SERVICE_EMOJI[service.kind]}</Body>
          <Body style={{ fontWeight: '700', color: colors.ink }}>{service.name}</Body>
        </Row>
        <Switch
          value={service.active}
          trackColor={{ true: colors.ok, false: '#ddd5cd' }}
          onValueChange={(next) => onSave({ active: next })}
        />
      </Row>

      <Row gap={8} style={{ marginTop: 8 }} align="flex-start">
        <View style={{ flex: 1 }}>
          <Field
            label="Durée (min)"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Tarif (DT)" value={price} onChangeText={setPrice} keyboardType="default" />
        </View>
      </Row>

      {dirty && delta !== 0 ? (
        <Small style={{ marginTop: 6 }}>
          Cette durée {delta > 0 ? 'ferait apparaître' : 'retirerait'}{' '}
          <Body style={{ fontWeight: '700', color: colors.ink }}>{Math.abs(delta)}</Body>{' '}
          créneau{Math.abs(delta) > 1 ? 'x' : ''} sur une journée type.
        </Small>
      ) : null}

      {error ? <Small style={{ color: colors.danger, marginTop: 6 }}>{error}</Small> : null}

      {dirty ? (
        <Button label="Enregistrer" small style={{ marginTop: 10 }} loading={saving} onPress={submit} />
      ) : null}
    </Card>
  );
}
