import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '../../src/lib/session';
import { Loading } from '../../src/components/ui';
import { colors } from '../../src/theme';

const icon = (glyph: string) => ({ color }: { color: string }) =>
  <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

export default function ClientLayout() {
  const { session, profile, loading } = useSession();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  // Un coiffeur qui atterrit ici par une URL est renvoyé chez lui.
  if (profile?.role === 'barber') return <Redirect href="/(pro)" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accentDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 16, fontWeight: '700', color: colors.ink },
        sceneStyle: { backgroundColor: colors.surfaceAlt },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="book" options={{ title: 'Réserver', tabBarIcon: icon('➕') }} />
      <Tabs.Screen name="appointments" options={{ title: 'Mes RDV', tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
