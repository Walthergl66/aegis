import { Stack } from 'expo-router';

import { SessionProvider } from '@/services/session';

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f5f7fb' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" options={{ headerShown: true, title: 'Crear cuenta' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="projects/new" options={{ headerShown: true, title: 'Nueva conexión' }} />
        <Stack.Screen name="import/supabase" options={{ headerShown: true, title: 'Importar Supabase' }} />
        <Stack.Screen name="projects/[id]/edit" options={{ headerShown: true, title: 'Editar proyecto' }} />
        <Stack.Screen name="projects/[id]" options={{ headerShown: true, title: 'Proyecto' }} />
      </Stack>
    </SessionProvider>
  );
}
