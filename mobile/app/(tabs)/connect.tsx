import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/services/session';

export default function ConnectScreen() {
  const { user } = useSession();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.kicker}>CONECTAR</Text>
        <Text style={styles.title}>Agrega una base de datos</Text>
        <Text style={styles.subtitle}>Elige cómo quieres conectar tu PostgreSQL o Supabase.</Text>

        {user?.rol === 'admin' ? (
          <>
            <Pressable style={styles.card} onPress={() => router.push('/projects/new')}>
              <Text style={styles.cardTitle}>Nueva conexión</Text>
              <Text style={styles.cardText}>Configura una base PostgreSQL manualmente.</Text>
            </Pressable>
            <Pressable style={styles.card} onPress={() => router.push('/import/supabase')}>
              <Text style={styles.cardTitle}>Importar desde Supabase</Text>
              <Text style={styles.cardText}>Trae tus proyectos de Supabase en pocos pasos.</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Tu cuenta no tiene permisos para agregar conexiones. Pide acceso a un administrador.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { padding: 22, paddingTop: 18 },
  kicker: { color: '#64748b', fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 8 },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#e8edf5' },
  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cardText: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  infoCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e8edf5' },
  infoText: { color: '#64748b', fontSize: 14, lineHeight: 21 },
});
