import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { maskIdentity, type IdentityMode } from '@coiffrdv/core';
import { supabase } from '../../src/lib/supabase';
import { Body, Button, Card, Field, Screen, Small, Title } from '../../src/components/ui';
import { colors } from '../../src/theme';

const RESEND_DELAY_SECONDS = 45;

export default function Verify() {
  const params = useLocalSearchParams<{ identity?: string; mode?: string }>();
  const identity = params.identity ?? '';
  const mode: IdentityMode = params.mode === 'phone' ? 'phone' : 'email';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_DELAY_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function verify() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Le code comporte 6 chiffres.');
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.verifyOtp(
        mode === 'phone'
          ? { phone: identity, token: code, type: 'sms' }
          : { email: identity, token: code, type: 'email' },
      );
      if (authError) {
        setError('Code incorrect ou expiré. Demandez-en un nouveau.');
        return;
      }
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setCountdown(RESEND_DELAY_SECONDS);
    await supabase.auth.resend(
      mode === 'phone'
        ? { type: 'sms', phone: identity }
        : { type: 'signup', email: identity },
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 40 }}>{mode === 'phone' ? '📱' : '✉️'}</Text>
      </View>

      <Title style={{ textAlign: 'center' }}>Vérifiez votre compte</Title>
      <Body style={{ textAlign: 'center' }}>
        Nous avons envoyé un code à 6 chiffres à{'\n'}
        <Text style={{ fontWeight: '700', color: colors.ink }}>
          {identity ? maskIdentity(identity, mode) : '…'}
        </Text>
      </Body>

      <Field
        label="Code de vérification"
        value={code}
        onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
        placeholder="• • • • • •"
        keyboardType="number-pad"
        error={error}
      />

      <Button label="Valider" onPress={verify} loading={busy} disabled={code.length !== 6} />

      {countdown > 0 ? (
        <Small style={{ textAlign: 'center' }}>
          Renvoyer le code dans {String(Math.floor(countdown / 60)).padStart(2, '0')}:
          {String(countdown % 60).padStart(2, '0')}
        </Small>
      ) : (
        <Button label="Renvoyer le code" variant="ghost" onPress={resend} />
      )}

      <Card>
        <Small>
          Pas de code ? Vérifiez vos indésirables si vous vous êtes inscrit par email,
          ou revenez en arrière pour corriger votre {mode === 'phone' ? 'numéro' : 'adresse'}.
        </Small>
      </Card>
    </Screen>
  );
}
