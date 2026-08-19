import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../src/lib/session';
import { Loading } from '../src/components/ui';
import { colors } from '../src/theme';

/** Aiguillage : pas de session → connexion ; sinon, l'espace correspondant au rôle. */
export default function Index() {
  const { session, profile, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, justifyContent: 'center' }}>
        <Loading label="Ouverture de votre session…" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile?.role === 'barber') return <Redirect href="/(pro)" />;
  return <Redirect href="/(client)" />;
}
