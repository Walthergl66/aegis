import { useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackupHistoryItem, getProjectHistory, ProjectHistory } from '@/services/projects';
import { apiUrl } from '@/services/api';
import { useSession } from '@/services/session';

function formatDate(value: string) {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function HistoryRow({ item, projectSlug, canDownload, renewAccessToken }: {
  item: BackupHistoryItem;
  projectSlug: string;
  canDownload: boolean;
  renewAccessToken: () => Promise<string>;
}) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const success = item.resultado === 'ok';
  async function download() {
    setDownloading(true);
    setProgress(0);
    let file: File | undefined;
    try {
      const accessToken = await renewAccessToken();
      const name = projectSlug + '-backup-' + item.id + '.dump';
      file = await File.downloadFileAsync(
        apiUrl('/backups/' + item.id + '/download?format=dump'),
        new File(Paths.cache, name),
        {
          headers: { Authorization: 'Bearer ' + accessToken },
          idempotent: true,
          onProgress: ({ bytesWritten, totalBytes }) => setProgress(totalBytes > 0 ? Math.floor(bytesWritten / totalBytes * 100) : null),
        },
      );
      if (!await Sharing.isAvailableAsync()) throw new Error('No hay una opción para compartir archivos en este dispositivo.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Guardar copia de seguridad' });
    } catch (error) {
      Alert.alert('No se pudo entregar la copia', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      file?.delete();
      setDownloading(false);
      setProgress(null);
    }
  }
  return (
    <View style={styles.historyRow}>
      <View style={[styles.result, success ? styles.success : styles.failure]}>
        <Text style={[styles.resultText, success ? styles.successText : styles.failureText]}>{success ? 'OK' : '!'}</Text>
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyDate}>{formatDate(item.fecha)}</Text>
        <Text style={styles.historyDetail}>{item.detalle || (success ? 'Copia disponible' : 'La ejecución no se completó')}</Text>
      </View>
      {canDownload && success && <Pressable disabled={downloading} onPress={() => void download()} style={styles.downloadButton}>
        {downloading ? <Text style={styles.downloadingText}>{progress === null ? '…' : progress + '%'}</Text> : <Text style={styles.downloadText}>Descargar</Text>}
      </Pressable>}
    </View>
  );
}

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request, renewAccessToken, user } = useSession();
  const [data, setData] = useState<ProjectHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      setData(await getProjectHistory(request, Number(id)));
    } catch (error) {
      Alert.alert('No se pudo cargar el historial', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, request]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      {loading ? <ActivityIndicator style={styles.loading} color="#2563eb" /> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}>
        {data && <>
          <View style={styles.projectCard}>
            <Text style={styles.kicker}>{data.project.provider === 'supabase' ? 'SUPABASE' : 'POSTGRESQL'}</Text>
            <Text style={styles.title}>{data.project.nombre}</Text>
            <Text style={styles.slug}>{data.project.slug}</Text>
            {!!data.project.connection_masked && <Text style={styles.connection}>Conexión: {data.project.connection_masked}</Text>}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial de copias</Text>
            {!data.rows.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Aún no hay copias</Text><Text style={styles.emptyText}>Las ejecuciones de este proyecto aparecerán aquí.</Text></View> :
              data.rows.map((item) => <HistoryRow item={item} projectSlug={data.project.slug} canDownload={user?.rol === 'admin'} renewAccessToken={renewAccessToken} key={item.id} />)}
          </View>
        </>}
        <Pressable style={styles.refreshButton} onPress={() => void load(true)}><Text style={styles.refreshText}>Actualizar historial</Text></Pressable>
      </ScrollView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 20, paddingBottom: 36 },
  loading: { flex: 1 },
  projectCard: { backgroundColor: '#0f172a', borderRadius: 22, padding: 22 },
  kicker: { color: '#93c5fd', fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  title: { color: '#fff', fontSize: 25, lineHeight: 31, fontWeight: '800', marginTop: 8 },
  slug: { color: '#cbd5e1', fontSize: 13, marginTop: 5 },
  connection: { color: '#94a3b8', fontSize: 12, marginTop: 16 },
  section: { marginTop: 28 },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  result: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  success: { backgroundColor: '#dcfce7' },
  failure: { backgroundColor: '#fee2e2' },
  resultText: { fontSize: 12, fontWeight: '900' },
  successText: { color: '#15803d' },
  failureText: { color: '#b91c1c' },
  historyInfo: { flex: 1, marginLeft: 11 },
  historyDate: { color: '#0f172a', fontSize: 13, fontWeight: '700' },
  historyDetail: { color: '#64748b', fontSize: 12, marginTop: 4 },
  downloadButton: { minHeight: 32, minWidth: 72, borderRadius: 9, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, marginLeft: 8 },
  downloadText: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },
  downloadingText: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { color: '#0f172a', fontWeight: '800' },
  emptyText: { color: '#64748b', lineHeight: 20, marginTop: 6, fontSize: 13 },
  refreshButton: { alignItems: 'center', padding: 15 },
  refreshText: { color: '#2563eb', fontWeight: '700' },
});
