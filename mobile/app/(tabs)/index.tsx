import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/services/session';

export default function HomeScreen() {
  const { user, signOut } = useSession();
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>BACKUPS POSTGRESQL</Text>
            <Text style={styles.title}>Hola, {user?.username}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={() => void signOut()} style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.username.slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>
        <View style={styles.hero}>
          <View style={styles.statusDot} />
          <Text style={styles.heroLabel}>SERVICIO</Text>
          <Text style={styles.heroTitle}>Conectado y listo</Text>
          <Text style={styles.heroText}>Tu sesión está protegida y puedes administrar tus copias desde aquí.</Text>
        </View>
        <Text style={styles.sectionTitle}>Tu espacio de trabajo</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>▤</Text>
          <Text style={styles.emptyTitle}>Tus proyectos estarán aquí</Text>
          <Text style={styles.emptyText}>En la siguiente etapa conectaremos esta app con tus proyectos PostgreSQL y el historial de copias.</Text>
        </View>
        <Text style={styles.role}>Sesión de {user?.rol}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 22, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 24 },
  kicker: { color: '#64748b', fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 7 },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1d4ed8', fontSize: 17, fontWeight: '800' },
  hero: { backgroundColor: '#0f172a', borderRadius: 22, padding: 22, minHeight: 180, justifyContent: 'center' },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4ade80', marginBottom: 13 },
  heroLabel: { color: '#94a3b8', letterSpacing: 1.3, fontWeight: '800', fontSize: 10 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  heroText: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 300 },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginTop: 30, marginBottom: 13 },
  emptyCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, backgroundColor: '#fff', padding: 22 },
  emptyIcon: { color: '#2563eb', fontSize: 25, marginBottom: 15 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8 },
  role: { color: '#94a3b8', fontSize: 12, marginTop: 23, textAlign: 'center' },
});
