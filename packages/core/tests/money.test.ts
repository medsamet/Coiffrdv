import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTND, parseTND, dinarsToMillimes, sumMillimes } from '../src/money.ts';

test('affiche les tarifs du salon tels qu\'on les écrit sur la carte', () => {
  assert.equal(formatTND(7000), '7 DT');
  assert.equal(formatTND(15000), '15 DT');
  assert.equal(formatTND(20000), '20 DT');
  assert.equal(formatTND(10000), '10 DT');
});

test('n\'affiche les millimes que lorsqu\'il y en a, et sur 3 chiffres', () => {
  assert.equal(formatTND(7500), '7,500 DT');
  assert.equal(formatTND(12345), '12,345 DT');
  assert.equal(formatTND(1005), '1,005 DT');
  assert.equal(formatTND(500), '0,500 DT');
});

test('gère zéro et les montants négatifs (remboursement)', () => {
  assert.equal(formatTND(0), '0 DT');
  assert.equal(formatTND(-7000), '-7 DT');
});

test('sait se passer du suffixe pour les champs de saisie', () => {
  assert.equal(formatTND(20000, { withSuffix: false }), '20');
});

test('relit ce que le coiffeur tape dans le champ tarif', () => {
  assert.equal(parseTND('20'), 20000);
  assert.equal(parseTND('12,5'), 12500);
  assert.equal(parseTND('12.500'), 12500);
  assert.equal(parseTND(' 7 DT '), 7000);
  assert.equal(parseTND('0'), 0);
});

test('refuse une saisie qui n\'est pas un montant', () => {
  assert.equal(parseTND(''), null);
  assert.equal(parseTND('abc'), null);
  assert.equal(parseTND('12,3456'), null); // plus de 3 décimales : ce n'est pas du dinar
  assert.equal(parseTND('-5'), null);
});

test('aller-retour saisie → affichage sans perte', () => {
  for (const input of ['20', '12,5', '7,250', '0,001', '999']) {
    const millimes = parseTND(input);
    assert.notEqual(millimes, null, `« ${input} » devrait être lisible`);
    assert.equal(parseTND(formatTND(millimes!, { withSuffix: false })), millimes);
  }
});

test('additionne un historique sans dérive de virgule flottante', () => {
  // 0,1 + 0,2 ≠ 0,3 en flottant. En millimes entiers, le problème n'existe pas.
  const historique = [20000, 7000, 10000, 15000, 20000];
  assert.equal(sumMillimes(historique), 72000);
  assert.equal(formatTND(sumMillimes(historique)), '72 DT');

  const centMillimes = Array.from({ length: 100 }, () => 100);
  assert.equal(sumMillimes(centMillimes), 10000);
  assert.equal(formatTND(sumMillimes(centMillimes)), '10 DT');
});

test('convertit des dinars saisis en millimes', () => {
  assert.equal(dinarsToMillimes(20), 20000);
  assert.equal(dinarsToMillimes(7.5), 7500);
});
