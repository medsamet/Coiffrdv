import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canBarberCancel, canClientCancel, cancelDeadline, findConflicts,
  overlaps, sortPendingFirst, STATUS_META,
  type SalonRules,
} from '../src/appointments.ts';

const rules: SalonRules = {
  cancelDeadlineMinutes: 120,
  minLeadMinutes: 120,
  bookingHorizonDays: 60,
};

const now = new Date('2026-08-19T09:00:00Z');
const dans = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

test('le client annule librement une demande encore en attente', () => {
  // Rien n'est réservé : même 5 minutes avant, il peut retirer sa demande.
  const decision = canClientCancel({ status: 'pending', startsAt: dans(5) }, rules, now);
  assert.equal(decision.allowed, true);
});

test('le client annule un rendez-vous confirmé tant que le délai n\'est pas passé', () => {
  const decision = canClientCancel({ status: 'confirmed', startsAt: dans(180) }, rules, now);
  assert.equal(decision.allowed, true);
});

test('passé le délai, l\'annulation est refusée avec un message utile', () => {
  const decision = canClientCancel({ status: 'confirmed', startsAt: dans(30) }, rules, now);
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, 'deadline_passed');
  assert.match(decision.message, /120 minutes/);
  assert.match(decision.message, /salon/);
});

test('la limite exacte est du bon côté', () => {
  const rdv = { status: 'confirmed' as const, startsAt: dans(120) };
  assert.equal(cancelDeadline(rdv.startsAt, rules).getTime(), now.getTime());
  // Pile à l'échéance : encore autorisé. Une seconde plus tard : refusé.
  assert.equal(canClientCancel(rdv, rules, now).allowed, true);
  assert.equal(canClientCancel(rdv, rules, new Date(now.getTime() + 1000)).allowed, false);
});

test('un rendez-vous déjà refusé ou annulé ne se réannule pas', () => {
  for (const status of ['rejected', 'cancelled_by_client', 'completed', 'no_show'] as const) {
    const decision = canClientCancel({ status, startsAt: dans(500) }, rules, now);
    assert.equal(decision.allowed, false, `statut ${status}`);
    if (!decision.allowed) assert.equal(decision.reason, 'not_cancellable');
  }
});

test('le coiffeur n\'est jamais soumis au délai', () => {
  assert.equal(canBarberCancel({ status: 'confirmed', startsAt: dans(5) }), true);
  assert.equal(canBarberCancel({ status: 'pending', startsAt: dans(5) }), true);
  assert.equal(canBarberCancel({ status: 'completed', startsAt: dans(-500) }), false);
});

test('chevauchement : bornes ouvertes à droite', () => {
  const a = { start: dans(0), end: dans(30) };
  const colle = { start: dans(30), end: dans(60) };  // commence pile à la fin de a
  const mord = { start: dans(29), end: dans(60) };
  assert.equal(overlaps(a, colle), false, 'deux rendez-vous bout à bout ne se chevauchent pas');
  assert.equal(overlaps(a, mord), true);
  assert.equal(overlaps(mord, a), true, 'la relation est symétrique');
});

test('détecte les demandes concurrentes du back-office', () => {
  const demandes = [
    { id: 'karim', start: dans(0),  end: dans(50), status: 'pending' as const },
    { id: 'tarek', start: dans(15), end: dans(45), status: 'pending' as const },
    { id: 'nadia', start: dans(60), end: dans(80), status: 'pending' as const },
    { id: 'vieux', start: dans(15), end: dans(45), status: 'rejected' as const },
  ];
  const conflits = findConflicts(demandes);

  assert.deepEqual([...conflits.keys()].sort(), ['karim', 'tarek']);
  assert.equal(conflits.get('karim')![0]!.id, 'tarek');
  assert.ok(!conflits.has('nadia'), 'une demande isolée n\'est pas en conflit');
  assert.ok(!conflits.has('vieux'), 'une demande refusée ne bloque plus rien');
});

test('les demandes en attente remontent en tête, la plus ancienne d\'abord', () => {
  const liste = [
    { status: 'confirmed' as const, requestedAt: dans(-10), startsAt: dans(100), id: 'c1' },
    { status: 'pending' as const,   requestedAt: dans(-300), startsAt: dans(900), id: 'p_vieille' },
    { status: 'pending' as const,   requestedAt: dans(-20),  startsAt: dans(200), id: 'p_recente' },
    { status: 'confirmed' as const, requestedAt: dans(-5),   startsAt: dans(50),  id: 'c2' },
  ];
  assert.deepEqual(
    sortPendingFirst(liste).map((a) => a.id),
    ['p_vieille', 'p_recente', 'c2', 'c1'],
  );
});

test('chaque statut a un libellé français et un ton d\'affichage', () => {
  for (const [status, meta] of Object.entries(STATUS_META)) {
    assert.ok(meta.label.length > 0, `libellé manquant pour ${status}`);
    assert.ok(['wait', 'ok', 'danger', 'neutral'].includes(meta.tone));
  }
  assert.equal(STATUS_META.pending.active, true);
  assert.equal(STATUS_META.confirmed.active, true);
  assert.equal(STATUS_META.completed.active, false);
});
