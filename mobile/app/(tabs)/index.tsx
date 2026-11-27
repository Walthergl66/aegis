import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProjectCard from '@/components/ProjectCard';
import { listProjects, Project } from '@/services/projects';
import { useSession } from '@/services/session';

export default function HomeScreen() {
  const { user, request } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      setProjects(await listProjects(request, showArchived ? 'eliminados' : 'activos'));
    } catch (error) {
      Alert.alert('No se pudieron cargar los proyectos', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request, showArchived]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>RESPALDOS SEGUROS</Text>
            <Text style={styles.title}>Hola, {user?.username} 👋</Text>
          </View>
        </View>
        <View style={styles.hero}>
          <View style={styles.statusDot} />
          <Text style={styles.heroLabel}>SERVICIO</Text>
          <Text style={styles.heroTitle}>Todo en orden</Text>
          <Text style={styles.heroText}>{projects.length === 0 ? 'Aún no tienes proyectos. Cuando agregues uno, lo verás aquí.' : `${projects.length} ${projects.length === 1 ? 'proyecto listo para cuidar' : 'proyectos listos para cuidar'}.`}</Text>
        </View>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Proyectos</Text>
          <View style={styles.sectionActions}>
            {user?.rol === 'admin' && (
              <Pressable
                onPress={() => setShowArchived((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={showArchived ? 'Ver proyectos activos' : 'Ver proyectos archivados'}
                style={styles.iconBtn}
              >
                <Ionicons name={showArchived ? 'folder-open-outline' : 'archive-outline'} size={20} color="#2563eb" />
              </Pressable>
            )}
            <Pressable onPress={() => void load(true)} accessibilityRole="button" accessibilityLabel="Actualizar lista" style={styles.iconBtn}>
              <Ionicons name="refresh" size={20} color="#2563eb" />
            </Pressable>
          </View>
        </View>
        {loading ? <ActivityIndicator style={styles.loading} color="#2563eb" /> :
          <View>
            {projects.map((project) => <ProjectCard key={project.id} project={project} archived={showArchived} canStartBackup={user?.rol === 'admin' && !showArchived} request={request} onCompleted={() => void load(true)} />)}
            {!projects.length && <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>▤</Text>
              <Text style={styles.emptyTitle}>{showArchived ? 'Nada por aquí todavía' : 'Aún no hay proyectos'}</Text>
              <Text style={styles.emptyText}>{showArchived ? 'Cuando archives uno, lo encontrarás aquí.' : 'Agrega tu primera base de datos y empezamos a cuidar tus copias.'}</Text>
            </View>}
          </View>}
        <Text style={styles.role}>Sesión de {user?.rol}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { padding: 22, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 24 },
  kicker: { color: '#64748b', fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 7 },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  hero: { backgroundColor: '#0f172a', borderRadius: 24, padding: 22, minHeight: 180, justifyContent: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4ade80', marginBottom: 13 },
  heroLabel: { color: '#94a3b8', letterSpacing: 1.3, fontWeight: '800', fontSize: 10 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  heroText: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 300 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 14 },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  refresh: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#eef4ff', alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { color: '#2563eb', fontSize: 18, fontWeight: '700' },
  loading: { marginTop: 30 },
  emptyCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, backgroundColor: '#fff', padding: 24 },
  emptyIcon: { color: '#2563eb', fontSize: 25, marginBottom: 15 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8 },
  role: { color: '#94a3b8', fontSize: 12, marginTop: 23, textAlign: 'center' },
});
