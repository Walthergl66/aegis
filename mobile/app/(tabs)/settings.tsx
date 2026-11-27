import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/services/session';

export default function SettingsScreen() {
  const { user, signOut } = useSession();

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.kicker}>CONFIGURACIÓN</Text>
        <Text style={styles.title}>Tu cuenta</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Usuario</Text>
          <Text style={styles.value}>{user?.username ?? '—'}</Text>
          <Text style={[styles.label, styles.spaced]}>Rol</Text>
          <Text style={styles.value}>{user?.rol ?? '—'}</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        <Text style={styles.footer}>Backups PostgreSQL · App móvil</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { padding: 22, paddingTop: 18 },
  kicker: { color: '#64748b', fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 8 },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '800', letterSpacing: -0.4, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e8edf5' },
  label: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  value: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginTop: 4 },
  spaced: { marginTop: 14 },
  logoutButton: { marginTop: 24, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
  footer: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 28 },
});
