import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey, formatDayLong, formatDayShort, formatDuration, formatSlotRange,
  formatTime, occupancyMinutes, splitHalfDay, weekday,
} from '../src/time.ts';

const TZ = 'Africa/Tunis'; // UTC+1 toute l'année, pas de changement d'heure

test('l\'heure affichée est celle du salon, pas celle du téléphone', () => {
  const instant = new Date('2026-08-27T10:00:00Z'); // 11:00 à Tunis
  assert.equal(formatTime(instant, TZ), '11:00');
  // Le même instant vu de Paris (UTC+2 en août) : 12:00. On ne veut PAS ça
  // dans l'application, mais c'est la preuve que le fuseau est bien pris en compte.
  assert.equal(formatTime(instant, 'Europe/Paris'), '12:00');
});

test('la journée est découpée selon le fuseau du salon', () => {
  // 23:30 UTC le 26 = 00:30 le 27 à Tunis : c'est déjà le lendemain pour le coiffeur.
  const tardif = new Date('2026-08-26T23:30:00Z');
  assert.equal(dayKey(tardif, TZ), '2026-08-27');
  assert.equal(dayKey(tardif, 'UTC'), '2026-08-26');
});

test('libellés de date en français', () => {
  const jeudi = new Date('2026-08-27T09:00:00Z');
  assert.equal(formatDayLong(jeudi, TZ), 'jeudi 27 août 2026');
  assert.match(formatDayShort(jeudi, TZ), /jeu/);
  assert.match(formatDayShort(jeudi, TZ), /27/);
});

test('la plage affichée au client exclut la marge de nettoyage', () => {
  const debut = new Date('2026-08-27T10:00:00Z'); // 11:00 Tunis
  assert.equal(formatSlotRange(debut, 45, TZ), '11:00 → 11:45');
  assert.equal(formatSlotRange(debut, 15, TZ), '11:00 → 11:15');
});

test('l\'occupation de l\'agenda inclut la marge, elle', () => {
  assert.equal(occupancyMinutes({ durationMinutes: 45, cleanupMinutes: 5 }), 50);
  assert.equal(occupancyMinutes({ durationMinutes: 15 }), 15);
});

test('durées lisibles', () => {
  assert.equal(formatDuration(15), '15 min');
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(90), '1 h 30');
});

test('le numéro de jour suit la convention SQL (0 = dimanche)', () => {
  assert.equal(weekday(new Date('2026-08-23T12:00:00Z'), TZ), 0); // dimanche
  assert.equal(weekday(new Date('2026-08-27T12:00:00Z'), TZ), 4); // jeudi
  assert.equal(weekday(new Date('2026-08-29T12:00:00Z'), TZ), 6); // samedi
});

test('matin et après-midi basculent à midi, heure du salon', () => {
  const slots = [
    { start: new Date('2026-08-27T08:00:00Z') }, // 09:00
    { start: new Date('2026-08-27T10:45:00Z') }, // 11:45
    { start: new Date('2026-08-27T11:00:00Z') }, // 12:00 → après-midi
    { start: new Date('2026-08-27T15:00:00Z') }, // 16:00
  ];
  const { morning, afternoon } = splitHalfDay(slots, TZ);
  assert.equal(morning.length, 2);
  assert.equal(afternoon.length, 2);
  assert.equal(formatTime(afternoon[0]!.start, TZ), '12:00');
});
