import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSlots, labelToMinutes, minutesToLabel, slotCountDelta,
  type SlotInput,
} from '../src/slots.ts';

/**
 * Le décor est exactement celui du test SQL (supabase/tests/01_business_rules_test.sql) :
 * jeudi 09:00–19:00, déjeuner 12:00–14:00, grille au quart d'heure,
 * « Barbe + Cheveux » = 45 min + 5 min de remise en état.
 *
 * Les nombres attendus ci-dessous sont ceux que la base a produits. Si les deux
 * implémentations divergent un jour, un de ces tests tombe.
 */
const jeudi: SlotInput = {
  window: { opensAtMinutes: labelToMinutes('09:00'), closesAtMinutes: labelToMinutes('19:00') },
  unavailable: [{ startMinutes: labelToMinutes('12:00'), endMinutes: labelToMinutes('14:00') }],
  occupancyMinutes: 50,
  durationMinutes: 45,
  stepMinutes: 15,
};

test('parité avec la fonction SQL : 26 créneaux le jeudi', () => {
  assert.equal(buildSlots(jeudi).length, 26);
});

test('aucun créneau ne mord sur la pause déjeuner', () => {
  const pause = { startMinutes: labelToMinutes('12:00'), endMinutes: labelToMinutes('14:00') };
  for (const slot of buildSlots(jeudi)) {
    const fin = slot.startMinutes + jeudi.occupancyMinutes;
    assert.ok(
      fin <= pause.startMinutes || slot.startMinutes >= pause.endMinutes,
      `le créneau de ${minutesToLabel(slot.startMinutes)} déborde sur le déjeuner`,
    );
  }
});

test('le dernier créneau se termine avant la fermeture, marge comprise', () => {
  const slots = buildSlots(jeudi);
  const dernier = slots[slots.length - 1]!;
  assert.equal(minutesToLabel(dernier.startMinutes), '18:00');
  assert.ok(dernier.startMinutes + jeudi.occupancyMinutes <= labelToMinutes('19:00'));
});

test('l\'heure de fin affichée exclut la marge de nettoyage', () => {
  const premier = buildSlots(jeudi)[0]!;
  assert.equal(minutesToLabel(premier.startMinutes), '09:00');
  assert.equal(minutesToLabel(premier.endMinutes), '09:45'); // 45 min, pas 50
});

test('parité avec la fonction SQL : un blocage d\'une heure retire 7 créneaux', () => {
  const avec = buildSlots({
    ...jeudi,
    unavailable: [
      ...jeudi.unavailable,
      { startMinutes: labelToMinutes('10:00'), endMinutes: labelToMinutes('11:00') },
    ],
  });
  assert.equal(buildSlots(jeudi).length - avec.length, 7);
});

test('salon fermé : aucun créneau', () => {
  assert.deepEqual(buildSlots({ ...jeudi, window: null }), []);
});

test('le délai minimum avant réservation coupe le début de journée', () => {
  const slots = buildSlots({ ...jeudi, earliestStartMinutes: labelToMinutes('14:30') });
  assert.equal(minutesToLabel(slots[0]!.startMinutes), '14:30');
  assert.ok(slots.every((s) => s.startMinutes >= labelToMinutes('14:30')));
});

test('une prestation plus longue que la journée ne produit rien', () => {
  assert.deepEqual(buildSlots({ ...jeudi, occupancyMinutes: 900, durationMinutes: 900 }), []);
});

test('deux indisponibilités qui se chevauchent ne comptent pas double', () => {
  const slots = buildSlots({
    ...jeudi,
    unavailable: [
      { startMinutes: labelToMinutes('10:00'), endMinutes: labelToMinutes('11:00') },
      { startMinutes: labelToMinutes('10:30'), endMinutes: labelToMinutes('11:00') },
    ],
  });
  const seul = buildSlots({
    ...jeudi,
    unavailable: [{ startMinutes: labelToMinutes('10:00'), endMinutes: labelToMinutes('11:00') }],
  });
  assert.equal(slots.length, seul.length);
});

test('raccourcir « Barbe + Cheveux » à 30 min ouvre des créneaux supplémentaires', () => {
  // C'est le chiffre affiché dans l'encart « aperçu côté client » du back-office.
  const delta = slotCountDelta(jeudi, 30);
  assert.ok(delta > 0, `raccourcir la prestation devrait ajouter des créneaux (delta ${delta})`);
  assert.equal(delta, 2);
});

test('conversion minutes ⇄ libellé', () => {
  assert.equal(minutesToLabel(0), '00:00');
  assert.equal(minutesToLabel(690), '11:30');
  assert.equal(labelToMinutes('08:30'), 510);
  assert.equal(labelToMinutes(minutesToLabel(1139)), 1139);
});
