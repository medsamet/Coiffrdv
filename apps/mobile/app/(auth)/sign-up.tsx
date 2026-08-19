import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { checkIdentity, type IdentityMode } from '@coiffrdv/core';
import { supabase } from '../../src/lib/supabase';
import {
  Body, Button, Card, Field, Label, Screen, Segmented, Small, Title,
} from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function SignUp() {
  const [mode, setMode] = useState<IdentityMode>('email');
  const [fullName, setFullName] = useState('');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFormError(null);

    if (fullName.trim().length < 2) {
      setFormError('Indiquez votre nom, le coiffeur doit savoir qui vient.');
      return;
    }
    const check = checkIdentity(identity, mode);
    setIdentityError(check.error);
    if (!check.ok) return;
    if (password.length < 8) {
      setFormError('Choisissez un mot de passe d\'au moins 8 caractères.');
      return;
    }

    setBusy(true);
    try {
      const options = { data: { full_name: fullName.trim(), role: 'client' } };
      const { error } = mode === 'email'
        ? await supabase.auth.signUp({ email: check.value, password, options })
        : await supabase.auth.signUp({ phone: check.value, password, options });

      if (error) {
        setFormError(
          error.message.toLowerCase().includes('already')
            ? 'Un compte existe déjà avec cet identifiant. Connectez-vous.'
            : "La création du compte a échoué. Réessayez dans un instant.",
        );
        return;
      }

      router.push({ pathname: '/(auth)/verify', params: { identity: check.value, mode } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Créer un compte</Title>
      <Body>Réservez chez Coupe & Style en quelques secondes.</Body>

      <Field
        label="Nom complet"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Karim Belhadj"
        autoCapitalize="words"
      />

      <View style={{ marginTop: 4 }}>
        <Label>S'inscrire avec</Label>
      </View>
      <Segmented
        value={mode}
        onChange={(next) => { setMode(next); setIdentity(''); setIdentityError(null); }}
        options={[
          { value: 'email', label: '✉️  Email' },
          { value: 'phone', label: '📱  Téléphone' },
        ]}
      />
      <Small>
        Un seul des deux suffit. C'est aussi par ce canal que vous recevrez la
        confirmation de vos rendez-vous.
      </Small>

      <Field
        label={mode === 'email' ? 'Adresse email' : 'Numéro de téléphone'}
        value={identity}
        onChangeText={(v) => { setIdentity(v); setIdentityError(null); }}
        placeholder={mode === 'email' ? 'vous@exemple.com' : '98 76 54 32'}
        keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
        error={identityError}
      />

      <Field
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        placeholder="8 caractères minimum"
        secureTextEntry
      />

      {formError ? (
        <Card tone="danger">
          <Body style={{ color: colors.danger }}>{formError}</Body>
        </Card>
      ) : null}

      <Small>En continuant, vous acceptez les CGU et la politique de confidentialité.</Small>
      <Button label="Créer mon compte" onPress={submit} loading={busy} />
      <Button label="J'ai déjà un compte" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
