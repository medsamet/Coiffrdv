import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkIdentity, formatTunisianPhone, isValidEmail, maskIdentity, normalizeTunisianPhone,
} from '../src/identity.ts';

test('accepte les façons dont on écrit vraiment un numéro tunisien', () => {
  const attendu = '+21698765432';
  for (const saisie of [
    '98765432',
    '98 76 54 32',
    '98.76.54.32',
    '98-76-54-32',
    '+216 98 76 54 32',
    '+21698765432',
    '0021698765432',
    '216 98765432',
  ]) {
    assert.equal(normalizeTunisianPhone(saisie), attendu, `« ${saisie} »`);
  }
});

test('refuse ce qui n\'est pas un mobile tunisien', () => {
  assert.equal(normalizeTunisianPhone('1234567'), null);        // trop court
  assert.equal(normalizeTunisianPhone('987654321'), null);      // trop long
  assert.equal(normalizeTunisianPhone('18765432'), null);       // préfixe interdit
  assert.equal(normalizeTunisianPhone('+33612345678'), null);   // numéro français
  assert.equal(normalizeTunisianPhone(''), null);
  assert.equal(normalizeTunisianPhone('abcdefgh'), null);
});

test('accepte les préfixes tunisiens réellement attribués', () => {
  for (const prefixe of ['2', '4', '5', '7', '9']) {
    assert.notEqual(normalizeTunisianPhone(`${prefixe}0000000`), null, `préfixe ${prefixe}`);
  }
  for (const prefixe of ['0', '1', '3', '6', '8']) {
    assert.equal(normalizeTunisianPhone(`${prefixe}0000000`), null, `préfixe ${prefixe}`);
  }
});

test('affiche un numéro par groupes de deux', () => {
  assert.equal(formatTunisianPhone('+21698765432'), '+216 98 76 54 32');
});

test('validation d\'email', () => {
  assert.equal(isValidEmail('karim.b@exemple.com'), true);
  assert.equal(isValidEmail('a@b.tn'), true);
  assert.equal(isValidEmail('karim.b@exemple'), false);
  assert.equal(isValidEmail('karim.b'), false);
  assert.equal(isValidEmail('deux @espaces.com'), false);
  assert.equal(isValidEmail(''), false);
});

test('checkIdentity normalise ce qu\'elle accepte', () => {
  const email = checkIdentity('  Karim.B@Exemple.COM ', 'email');
  assert.equal(email.ok, true);
  assert.equal(email.value, 'karim.b@exemple.com', 'email mis en minuscules et détouré');

  const phone = checkIdentity(' 98 76 54 32 ', 'phone');
  assert.equal(phone.ok, true);
  assert.equal(phone.value, '+21698765432');
});

test('checkIdentity explique en français ce qui ne va pas', () => {
  assert.match(checkIdentity('', 'email').error!, /adresse email/);
  assert.match(checkIdentity('', 'phone').error!, /numéro/);
  assert.match(checkIdentity('pas-un-email', 'email').error!, /valide/);
  assert.match(checkIdentity('123', 'phone').error!, /8 chiffres/);
});

test('l\'écran de vérification masque l\'identifiant sans le rendre méconnaissable', () => {
  assert.equal(maskIdentity('+21698765432', 'phone'), '+216 98 •• •• 32');

  const masque = maskIdentity('karim.b@exemple.com', 'email');
  assert.ok(masque.startsWith('kar'), 'les premières lettres restent lisibles');
  assert.ok(masque.endsWith('@exemple.com'), 'le domaine reste lisible');
  assert.ok(!masque.includes('karim.b'), "l'identifiant complet ne doit pas apparaître");
});
