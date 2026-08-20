import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '../../src/lib/session';
import { Loading } from '../../src/components/ui';
import { colors } from '../../src/theme';

const icon = (glyph: string) => ({ color }: { color: string }) =>
  <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

export default function ProLayout() {
  const { session, profile, loading } = useSession();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (profile && profile.role !== 'barber') return <Redirect href="/(client)" />;

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
      <Tabs.Screen name="index" options={{ title: 'Tableau de bord', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="requests" options={{ title: 'Demandes', tabBarIcon: icon('📥') }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
