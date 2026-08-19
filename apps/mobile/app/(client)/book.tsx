import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  dayKey, formatDayLong, formatDayShort, formatDuration, formatSlotRange, formatTime,
  formatTND, nextDays, splitHalfDay,
} from '@coiffrdv/core';
import {
  fetchAvailableSlots, fetchSalon, fetchServices, requestAppointment,
} from '../../src/lib/api';
import { useAsync } from '../../src/lib/useAsync';
import { ServiceCard } from '../../src/components/ServiceCard';
import {
  Body, Button, Card, Empty, ErrorNotice, Field, Label, Loading,
  Row, Screen, Separator, Small, Title,
} from '../../src/components/ui';
import { colors, radius } from '../../src/theme';
import type { Service } from '../../src/lib/types';

type Step = 'service' | 'slot' | 'review' | 'done';

export default function Book() {
  const [step, setStep] = useState<Step>('service');
  const [service, setService] = useState<Service | null>(null);
  const [day, setDay] = useState<Date>(new Date());
  const [slot, setSlot] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    const salon = await fetchSalon();
    return { salon, services: await fetchServices(salon.id) };
  }, []);
  const base = useAsync(loadBase, []);

  const salon = base.data?.salon ?? null;
  const dayString = salon ? dayKey(day, salon.timezone) : null;

  const loadSlots = useCallback(async () => {
    if (!service || !dayString) return [] as Date[];
    return fetchAvailableSlots(service.id, dayString);
  }, [service, dayString]);
  const slots = useAsync(loadSlots, [service?.id, dayString]);

  if (base.loading) return <Loading />;
  if (base.error || !base.data || !salon) {
    return (
      <Screen>
        <ErrorNotice message={base.error ?? 'Chargement impossible.'} onRetry={base.reload} />
      </Screen>
    );
  }

  /* ------------------------------------------------------------- étape 1 */
  if (step === 'service') {
    return (
      <Screen>
        <Progress step={1} />
        <Title>Quelle prestation ?</Title>
        <Body>La durée du créneau est définie par le coiffeur pour chaque prestation.</Body>

        {base.data.services.map((item) => (
          <ServiceCard
            key={item.id}
            service={item}
            selected={service?.id === item.id}
            onPress={() => { setService(item); setSlot(null); }}
          />
        ))}

        <Button
          label={service ? `Continuer · ${formatDuration(service.duration_minutes)} · ${formatTND(service.price_millimes)}` : 'Choisissez une prestation'}
          disabled={!service}
          onPress={() => setStep('slot')}
        />
      </Screen>
    );
  }

  /* ------------------------------------------------------------- étape 2 */
  if (step === 'slot') {
    const days = nextDays(14);
    const grouped = splitHalfDay((slots.data ?? []).map((start) => ({ start })), salon.timezone);

    return (
      <Screen>
        <Progress step={2} />
        <Title>Choisissez un créneau</Title>
        <Small>{formatDayLong(day, salon.timezone)}</Small>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
          {days.map((candidate) => {
            const active = dayKey(candidate, salon.timezone) === dayKey(day, salon.timezone);
            return (
              <Pressable
                key={candidate.toISOString()}
                onPress={() => { setDay(candidate); setSlot(null); }}
                style={{
                  paddingVertical: 8, paddingHorizontal: 12,
                  borderRadius: radius.md, borderWidth: 1,
                  backgroundColor: active ? colors.ink : colors.surface,
                  borderColor: active ? colors.ink : colors.line2,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#fff' : colors.ink }}>
                  {formatDayShort(candidate, salon.timezone)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {slots.loading ? <Loading label="Recherche des créneaux…" /> : null}
        {slots.error ? <ErrorNotice message={slots.error} onRetry={slots.reload} /> : null}

        {!slots.loading && !slots.error && (slots.data?.length ?? 0) === 0 ? (
          <Empty
            icon="🗓️"
            title="Aucun créneau ce jour-là"
            hint="Le salon est fermé, complet, ou la journée est bloquée. Essayez un autre jour."
          />
        ) : null}

        {grouped.morning.length > 0 ? (
          <>
            <Label>Matin</Label>
            <SlotGrid
              slots={grouped.morning.map((s) => s.start)}
              selected={slot}
              timezone={salon.timezone}
              onSelect={setSlot}
            />
          </>
        ) : null}

        {grouped.afternoon.length > 0 ? (
          <>
            <Label>Après-midi</Label>
            <SlotGrid
              slots={grouped.afternoon.map((s) => s.start)}
              selected={slot}
              timezone={salon.timezone}
              onSelect={setSlot}
            />
          </>
        ) : null}

        <Row gap={8}>
          <Button label="Retour" variant="ghost" style={{ flex: 1 }} onPress={() => setStep('service')} />
          <Button
            label={slot ? `Continuer · ${formatTime(slot, salon.timezone)}` : 'Choisissez une heure'}
            disabled={!slot}
            style={{ flex: 2 }}
            onPress={() => setStep('review')}
          />
        </Row>
      </Screen>
    );
  }

  /* ------------------------------------------------------------- étape 3 */
  if (step === 'review' && service && slot) {
    async function submit() {
      setSubmitError(null);
      setSubmitting(true);
      try {
        await requestAppointment(service!.id, slot!, note);
        setStep('done');
      } catch (cause) {
        setSubmitError(cause instanceof Error ? cause.message : 'Envoi impossible.');
        // Le créneau a pu être pris entre-temps : on rafraîchit la grille.
        slots.reload();
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <Screen>
        <Progress step={3} />
        <Title>Récapitulatif</Title>

        <Card>
          <Line label="Prestation" value={service.name} />
          <Separator />
          <Line label="Date" value={formatDayLong(slot, salon.timezone)} />
          <Separator />
          <Line label="Heure" value={formatSlotRange(slot, service.duration_minutes, salon.timezone)} />
          <Separator />
          <Line label="Durée" value={formatDuration(service.duration_minutes)} />
          <Separator />
          <Line label="Salon" value={salon.name} />
          <Separator />
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '700', color: colors.ink }}>À régler sur place</Body>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.accentDark }}>
              {formatTND(service.price_millimes)}
            </Text>
          </Row>
        </Card>

        <Field
          label="Message au coiffeur (facultatif)"
          value={note}
          onChangeText={setNote}
          placeholder="Ex. dégradé court sur les côtés…"
          autoCapitalize="words"
        />

        <Card tone="wait">
          <Body style={{ color: colors.warn }}>
            <Text style={{ fontWeight: '700' }}>Demande soumise à validation. </Text>
            Le coiffeur confirme ou refuse votre créneau ; vous serez prévenu par
            email ou par SMS dès sa réponse.
          </Body>
        </Card>

        {submitError ? <ErrorNotice message={submitError} /> : null}

        <Row gap={8}>
          <Button label="Retour" variant="ghost" style={{ flex: 1 }} onPress={() => setStep('slot')} />
          <Button label="Envoyer la demande" style={{ flex: 2 }} loading={submitting} onPress={submit} />
        </Row>
        <Small style={{ textAlign: 'center' }}>
          Annulation gratuite jusqu'à {salon.cancel_deadline_minutes / 60} h avant.
        </Small>
      </Screen>
    );
  }

  /* --------------------------------------------------------------- envoyé */
  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 30, gap: 12 }}>
        <Text style={{ fontSize: 44 }}>⏳</Text>
        <Title style={{ textAlign: 'center' }}>Demande envoyée</Title>
        <Body style={{ textAlign: 'center' }}>
          Votre demande est en attente de validation par le coiffeur.
          Vous serez prévenu dès sa réponse.
        </Body>
      </View>
      <Button
        label="Voir mes rendez-vous"
        variant="dark"
        onPress={() => { setStep('service'); setService(null); setSlot(null); setNote(''); router.push('/(client)/appointments'); }}
      />
      <Button
        label="Demander un autre créneau"
        variant="ghost"
        onPress={() => { setStep('service'); setService(null); setSlot(null); setNote(''); }}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------- fragments */

function Progress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <Row gap={5}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={{
            flex: 1, height: 3, borderRadius: 2,
            backgroundColor: n <= step ? colors.accent : colors.line2,
          }}
        />
      ))}
    </Row>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Small>{label}</Small>
      <Body style={{ fontWeight: '700', color: colors.ink, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Body>
    </Row>
  );
}

function SlotGrid({
  slots, selected, timezone, onSelect,
}: {
  slots: Date[];
  selected: Date | null;
  timezone: string;
  onSelect: (slot: Date) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {slots.map((candidate) => {
        const active = selected?.getTime() === candidate.getTime();
        return (
          <Pressable
            key={candidate.toISOString()}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(candidate)}
            style={{
              minWidth: 82, paddingVertical: 10, alignItems: 'center',
              borderRadius: radius.sm, borderWidth: 1,
              backgroundColor: active ? colors.accent : colors.surface,
              borderColor: active ? colors.accent : colors.line2,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : colors.ink }}>
              {formatTime(candidate, timezone)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
