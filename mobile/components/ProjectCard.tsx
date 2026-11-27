import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { getBackupJob, Project, restoreProject, startBackup, BackupJob } from '@/services/projects';
import type { SessionRequest } from '@/services/session';
import { deleteItem, getItem, setItem } from '@/services/storage';

type Props = { project: Project; canStartBackup: boolean; request: SessionRequest; onCompleted: () => void; archived?: boolean };
const ACTIVE_JOB_KEY = (id: number) => 'backup.job.' + id;
const REQUEST_KEY = (id: number) => 'backup.request.' + id;

function label(status?: string) {
  return ({ queued: 'En espera', running: 'Trabajando…', completed: 'Listo', failed: 'Algo salió mal', interrupted: 'Se detuvo' } as Record<string, string>)[status || ''] || '';
}

function dateLabel(value?: string | null) {
  if (!value) return 'Aún sin copias';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export default function ProjectCard({ project, canStartBackup, request, onCompleted, archived = false }: Props) {
  const [job, setJob] = useState<BackupJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let active = true;
    getItem(ACTIVE_JOB_KEY(project.id)).then((id) => {
      if (active && id) setJob({ id, status: 'queued' });
    }).catch(() => {});
    return () => { active = false; };
  }, [project.id]);

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    let active = true;
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const current = await getBackupJob(request, job.id);
        if (!active) return;
        setJob(current);
        if (!['queued', 'running'].includes(current.status)) {
          await deleteItem(ACTIVE_JOB_KEY(project.id));
          Alert.alert(current.status === 'completed' ? 'Copia lista' : 'No se pudo completar',
            current.status === 'completed' ? 'Ya guardamos una copia de ' + project.nombre + '.' : (current.detail || label(current.status)));          onCompleted();
        }
      } catch {
        // Keep the job ID locally and resume polling when connectivity returns.
      } finally {
        polling = false;
      }
    }, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [job, onCompleted, project.id, project.nombre, request]);

  async function runBackup() {
    setStarting(true);
    try {
      let key = await getItem(REQUEST_KEY(project.id));
      if (!key) {
        key = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        await setItem(REQUEST_KEY(project.id), key);
      }
      const created = await startBackup(request, project.id, key);
      await deleteItem(REQUEST_KEY(project.id));
      await setItem(ACTIVE_JOB_KEY(project.id), created.id);
      setJob(created);
    } catch (error) {
      Alert.alert('No pudimos iniciar la copia', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setStarting(false);
    }
  }

  async function runRestore() {
    setRestoring(true);
    try {
      await restoreProject(request, project.id);
      Alert.alert('Proyecto recuperado', project.nombre + ' volvió a estar activo.');
      onCompleted();
    } catch (error) {
      Alert.alert('No se pudo restaurar', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRestoring(false);
    }
  }

  const busy = starting || Boolean(job && ['queued', 'running'].includes(job.status));
  return (
    <View style={styles.card}>
      <Pressable onPress={() => router.push({ pathname: '/projects/[id]', params: { id: String(project.id) } })} style={styles.head}>
        <View style={styles.glyph}><Text style={styles.glyphText}>PG</Text></View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>{project.nombre}</Text>
          <Text style={styles.meta}>{project.provider === 'supabase' ? 'Supabase' : 'PostgreSQL'} · {project.slug}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <View style={styles.divider} />
      <View style={styles.footer}>
        <View style={styles.status}>
          <View style={[styles.dot, busy && styles.activeDot]} />
          <Text style={styles.meta}>{busy ? label(job?.status) || 'Iniciando' : dateLabel(project.ultimo_backup)}</Text>
        </View>
        {archived && <Pressable disabled={restoring} onPress={() => void runRestore()} style={[styles.button, restoring && styles.disabled]}>
          {restoring ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Restaurar</Text>}
        </Pressable>}
        {!archived && canStartBackup && <Pressable disabled={busy} onPress={() => void runBackup()} style={[styles.button, busy && styles.disabled]}>
          {starting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>{busy ? label(job?.status) || 'Empezando…' : 'Hacer copia'}</Text>}
        </Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e8edf5', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  head: { flexDirection: 'row', alignItems: 'center' },
  glyph: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  glyphText: { color: '#2563eb', fontSize: 12, fontWeight: '900' },
  identity: { flex: 1, marginLeft: 12 },
  name: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 12, marginTop: 3 },
  chevron: { fontSize: 25, color: '#94a3b8', marginLeft: 8 },
  divider: { height: 1, backgroundColor: '#eef2f7', marginVertical: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16a34a', marginRight: 8 },
  activeDot: { backgroundColor: '#f59e0b' },
  button: { minWidth: 94, minHeight: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
