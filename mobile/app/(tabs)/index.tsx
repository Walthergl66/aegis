import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProjectCard from '@/components/ProjectCard';
import { listProjects, Project } from '@/services/projects';
import { useSession } from '@/services/session';

export default function HomeScreen() {
  const { user, signOut, request } = useSession();
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
            <Text style={styles.kicker}>BACKUPS POSTGRESQL</Text>
            <Text style={styles.title}>Hola, {user?.username}</Text>
          </View>
          <View style={styles.topActions}>
            {user?.rol === 'admin' && <Pressable accessibilityRole="button" onPress={() => router.push('/projects/new')} style={styles.addButton}><Text style={styles.addText}>+</Text></Pressable>}
            {user?.rol === 'admin' && <Pressable accessibilityRole="button" accessibilityLabel="Importar proyectos Supabase" onPress={() => router.push('/import/supabase')} style={styles.importButton}><Text style={styles.importText}>S</Text></Pressable>}
            {user?.rol === 'admin' && <Pressable accessibilityRole="button" accessibilityLabel="Administración" onPress={() => router.push('/admin')} style={styles.adminButton}><Text style={styles.adminText}>⚙</Text></Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={() => void signOut()} style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.username.slice(0, 1).toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.hero}>
          <View style={styles.statusDot} />
          <Text style={styles.heroLabel}>SERVICIO</Text>
          <Text style={styles.heroTitle}>Conectado y listo</Text>
          <Text style={styles.heroText}>{projects.length} {projects.length === 1 ? 'proyecto conectado' : 'proyectos conectados'} a tu espacio.</Text>
        </View>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Proyectos</Text>
          <View style={styles.sectionActions}>
            {user?.rol === 'admin' && <Pressable onPress={() => setShowArchived((value) => !value)} accessibilityRole="button"><Text style={styles.refresh}>{showArchived ? 'Ver activos' : 'Archivados'}</Text></Pressable>}
            <Pressable onPress={() => void load(true)} accessibilityRole="button"><Text style={styles.refresh}>Actualizar</Text></Pressable>
          </View>
        </View>
        {loading ? <ActivityIndicator style={styles.loading} color="#2563eb" /> :
          <View>
            {projects.map((project) => <ProjectCard key={project.id} project={project} archived={showArchived} canStartBackup={user?.rol === 'admin' && !showArchived} request={request} onCompleted={() => void load(true)} />)}
            {!projects.length && <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>▤</Text>
              <Text style={styles.emptyTitle}>{showArchived ? 'No hay proyectos archivados' : 'No hay proyectos activos'}</Text>
              <Text style={styles.emptyText}>{showArchived ? 'Los proyectos archivados aparecerán aquí.' : 'Cuando se conecten bases PostgreSQL, aparecerán aquí.'}</Text>
            </View>}
          </View>}
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
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  addButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 25, lineHeight: 28, fontWeight: '500' },
  importButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  importText: { color: '#1d4ed8', fontSize: 16, fontWeight: '900' },
  adminButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  adminText: { color: '#334155', fontSize: 18, fontWeight: '800' },
  avatarText: { color: '#1d4ed8', fontSize: 17, fontWeight: '800' },
  hero: { backgroundColor: '#0f172a', borderRadius: 22, padding: 22, minHeight: 180, justifyContent: 'center' },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4ade80', marginBottom: 13 },
  heroLabel: { color: '#94a3b8', letterSpacing: 1.3, fontWeight: '800', fontSize: 10 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  heroText: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 300 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 13 },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  refresh: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  loading: { marginTop: 30 },
  emptyCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, backgroundColor: '#fff', padding: 22 },
  emptyIcon: { color: '#2563eb', fontSize: 25, marginBottom: 15 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8 },
  role: { color: '#94a3b8', fontSize: 12, marginTop: 23, textAlign: 'center' },
});
