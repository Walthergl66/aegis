import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/services/session';

export default function AdminHomeScreen() {
  const { user } = useSession();
  if (user?.rol !== 'admin') return <Redirect href="/(tabs)" />;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>CONTROL DE ACCESO</Text>
        <Text style={styles.title}>Administración</Text>
        <Text style={styles.subtitle}>Gestiona quién puede usar la app y sus permisos de acceso.</Text>
        <Pressable onPress={() => router.push('/admin/users')} style={styles.card}>
          <View style={styles.icon}><Text style={styles.iconText}>U</Text></View>
          <View style={styles.copy}><Text style={styles.cardTitle}>Usuarios de la app</Text><Text style={styles.cardText}>Crear cuentas, cambiar roles y desactivar accesos.</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 22 },
  kicker: { color: '#2563eb', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 8 },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '800', marginTop: 7 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#1d4ed8', fontSize: 16, fontWeight: '900' },
  copy: { flex: 1, marginLeft: 12 },
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  cardText: { color: '#64748b', fontSize: 12, lineHeight: 17, marginTop: 4 },
  chevron: { color: '#94a3b8', fontSize: 25, marginLeft: 8 },
});
