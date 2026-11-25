import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useSession } from '@/services/session';

export default function IndexRoute() {
  const { ready, user } = useSession();
  if (!ready) return <View style={styles.container}><ActivityIndicator color="#2563eb" /></View>;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
