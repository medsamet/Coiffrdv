import { useState } from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import { checkIdentity, type IdentityMode } from '@coiffrdv/core';
import { supabase } from '../../src/lib/supabase';
import {
  Body, Button, Card, Field, Screen, Segmented, Small, Title,
} from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function SignIn() {
  const [mode, setMode] = useState<IdentityMode>('email');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFormError(null);

    const check = checkIdentity(identity, mode);
    setIdentityError(check.error);
    if (!check.ok) return;

    setBusy(true);
    try {
      if (mode === 'email') {
        if (password.length < 6) {
          setFormError('Mot de passe trop court.');
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: check.value, password,
        });
        if (error) {
          setFormError('Identifiants incorrects. Vérifiez votre email et votre mot de passe.');
          return;
        }
        router.replace('/');
      } else {
        // Par téléphone, pas de mot de passe : un code à 6 chiffres par SMS.
        const { error } = await supabase.auth.signInWithOtp({ phone: check.value });
        if (error) {
          setFormError("Impossible d'envoyer le SMS. Réessayez dans un instant.");
          return;
        }
        router.push({
          pathname: '/(auth)/verify',
          params: { identity: check.value, mode: 'phone' },
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
        <View
          style={{
            width: 52, height: 52, borderRadius: 15, backgroundColor: colors.ink,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Body style={{ fontSize: 24, color: colors.accent }}>✂</Body>
        </View>
      </View>

      <Title style={{ textAlign: 'center' }}>Bon retour</Title>
      <Body style={{ textAlign: 'center' }}>
        Connectez-vous avec l'identifiant choisi à l'inscription.
      </Body>

      <View style={{ height: 8 }} />

      <Segmented
        value={mode}
        onChange={(next) => { setMode(next); setIdentity(''); setIdentityError(null); setFormError(null); }}
        options={[
          { value: 'email', label: '✉️  Email' },
          { value: 'phone', label: '📱  Téléphone' },
        ]}
      />

      <Field
        label={mode === 'email' ? 'Adresse email' : 'Numéro de téléphone'}
        value={identity}
        onChangeText={(v) => { setIdentity(v); setIdentityError(null); }}
        placeholder={mode === 'email' ? 'vous@exemple.com' : '98 76 54 32'}
        keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
        error={identityError}
      />

      {mode === 'email' ? (
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      ) : (
        <Small>Nous vous enverrons un code à 6 chiffres par SMS.</Small>
      )}

      {formError ? (
        <Card tone="danger">
          <Body style={{ color: colors.danger }}>{formError}</Body>
        </Card>
      ) : null}

      <Button
        label={mode === 'email' ? 'Se connecter' : 'Recevoir un code par SMS'}
        onPress={submit}
        loading={busy}
      />

      <Link href="/(auth)/sign-up" asChild>
        <Button label="Créer un compte" variant="ghost" />
      </Link>
    </Screen>
  );
}
