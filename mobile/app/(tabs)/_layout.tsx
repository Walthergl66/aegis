import { Tabs } from 'expo-router';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useSession } from '@/services/session';

export default function TabLayout() {
  const { ready, user } = useSession();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#2563eb" /></View>;
  if (!user) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563eb', tabBarStyle: { height: 64, paddingTop: 8, paddingBottom: 8 } }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⌂</Text> }}
      />
      <Tabs.Screen
        name="connect"
        options={{ title: 'Conectar', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>＋</Text> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Ajustes', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙</Text> }}
      />
    </Tabs>
  );
}
