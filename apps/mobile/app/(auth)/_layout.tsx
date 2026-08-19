import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceAlt },
        headerShadowVisible: false,
        headerTintColor: colors.accentDark,
        headerTitleStyle: { fontSize: 16, fontWeight: '700', color: colors.ink },
        contentStyle: { backgroundColor: colors.surfaceAlt },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: 'Connexion' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Créer un compte' }} />
      <Stack.Screen name="verify" options={{ title: 'Vérification' }} />
    </Stack>
  );
}
