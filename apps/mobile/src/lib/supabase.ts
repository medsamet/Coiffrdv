import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Configuration manquante : copiez .env.example en .env et renseignez EXPO_PUBLIC_SUPABASE_URL " +
    "et EXPO_PUBLIC_SUPABASE_ANON_KEY (Supabase → Project Settings → API).",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Sur mobile, la session vit dans le stockage sécurisé de l'appareil.
    // Sur le web, on laisse le client utiliser localStorage par défaut.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Pas de redirection OAuth dans cette version : inutile de lire l'URL.
    detectSessionInUrl: false,
  },
});
