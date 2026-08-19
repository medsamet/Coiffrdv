import { Text, View } from 'react-native';
import { formatTunisianPhone } from '@coiffrdv/core';
import { useSession } from '../../src/lib/session';
import {
  Body, Button, Card, Label, Loading, Row, Screen, Separator, Small, Title,
} from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function Profile() {
  const { profile, signOut, loading } = useSession();

  if (loading) return <Loading />;
  if (!profile) return <Screen><Body>Profil indisponible.</Body></Screen>;

  const initials = profile.full_name
    .split(' ').filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <View
          style={{
            width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accentLight,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.accentDark }}>{initials}</Text>
        </View>
        <Title style={{ marginTop: 10 }}>{profile.full_name || 'Sans nom'}</Title>

        {profile.email ? <Small>✉️  {profile.email}</Small> : null}
        {profile.phone ? <Small>📱  {formatTunisianPhone(profile.phone)}</Small> : null}
      </Card>

      <Card>
        <Label>Notifications</Label>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Body>Canal utilisé</Body>
          <Body style={{ fontWeight: '700', color: colors.ink }}>
            {profile.notify_channel === 'sms' ? 'SMS' : 'Email'}
          </Body>
        </Row>
        <Separator />
        <Small>
          Confirmations, refus, rappel la veille et annulations partent sur ce canal —
          celui de l'identifiant utilisé à l'inscription.
        </Small>
      </Card>

      <Card>
        <Label>Compte</Label>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Body>Rôle</Body>
          <Body style={{ fontWeight: '700', color: colors.ink }}>
            {profile.role === 'barber' ? 'Coiffeur' : 'Client'}
          </Body>
        </Row>
      </Card>

      <Button label="Se déconnecter" variant="ghost" onPress={signOut} />

      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Small>Coiff'RDV · version 0.1</Small>
      </View>
    </Screen>
  );
}
