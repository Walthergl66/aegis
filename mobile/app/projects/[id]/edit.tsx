import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProject, Project, testPostgresConnection, updateProject } from '@/services/projects';
import { useSession } from '@/services/session';

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, request } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [connection, setConnection] = useState('');
  const [schedule, setSchedule] = useState('');
  const [active, setActive] = useState(true);
  const [noOwner, setNoOwner] = useState(false);
  const [noPrivileges, setNoPrivileges] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testFailed, setTestFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const value = await getProject(request, Number(id));
      setProject(value);
      setName(value.nombre);
      setSchedule(value.schedule || '');
      setActive(value.activo);
      setNoOwner(Boolean(value.backup_options?.no_owner));
      setNoPrivileges(Boolean(value.backup_options?.no_privileges));
    } catch (error) {
      Alert.alert('No se pudo cargar el proyecto', error instanceof Error ? error.message : 'Intenta de nuevo.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, request]);

  useEffect(() => { void load(); }, [load]);

  if (user?.rol !== 'admin') return <Redirect href="/(tabs)" />;

  async function testConnection() {
    if (!connection.trim() || !project) {
      Alert.alert('Escribe la nueva URI', 'Solo puedes probar una URI nueva antes de guardarla.');
      return;
    }
    setTesting(true);
    setTestResult('');
    try {
      const result = await testPostgresConnection(request, connection.trim(), project.provider);
      setTestFailed(!result.ok);
      setTestResult((result.detalle || 'Resultado de conexión') +
        (result.server_version ? ' · PostgreSQL ' + result.server_version : '') +
        (result.latency_ms != null ? ' · ' + result.latency_ms + ' ms' : ''));
    } catch (error) {
      setTestFailed(true);
      setTestResult(error instanceof Error ? error.message : 'No se pudo probar la conexión.');
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!project || !name.trim()) {
      Alert.alert('Falta el nombre', 'El nombre visible es obligatorio.');
      return;
    }
    setSaving(true);
    const payload = {
      nombre: name.trim(),
      provider: project.provider,
      account_id: project.account_id,
      project_ref: project.project_ref || '',
      connection: connection.trim(),
      schedule: schedule.trim(),
      activo: active,
      ...(project.provider === 'postgres' ? { backup_options: { no_owner: noOwner, no_privileges: noPrivileges } } : {}),
    };
    try {
      await updateProject(request, Number(id), payload);
      router.back();
    } catch (error) {
      Alert.alert('No se pudo actualizar el proyecto', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !project) return <SafeAreaView style={styles.safe}><ActivityIndicator style={styles.loader} color="#2563eb" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>{project.provider === 'supabase' ? 'SUPABASE' : 'POSTGRESQL'}</Text>
          <Text style={styles.title}>Editar proyecto</Text>
          <Text style={styles.slug}>{project.slug}</Text>
          <Text style={styles.label}>Nombre visible</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} accessibilityLabel="Nombre visible" />
          <Text style={styles.label}>Cambiar URI de conexión <Text style={styles.optional}>(opcional)</Text></Text>
          <View style={styles.secretRow}>
            <TextInput value={connection} onChangeText={(value) => { setConnection(value); setTestResult(''); }} placeholder={project.connection_masked || 'Deja vacío para conservar la URI actual'} placeholderTextColor="#94a3b8" style={[styles.input, styles.secretInput]} autoCapitalize="none" autoCorrect={false} secureTextEntry={!showConnection} accessibilityLabel="Nueva URI de conexión" />
            <Pressable onPress={() => setShowConnection((value) => !value)} style={styles.reveal}><Text style={styles.revealText}>{showConnection ? 'Ocultar' : 'Ver'}</Text></Pressable>
          </View>
          <Text style={styles.hint}>La URI actual se conserva cifrada en el servidor si no escribes una nueva.</Text>
          <Pressable disabled={testing || !connection.trim()} onPress={() => void testConnection()} style={[styles.testButton, (testing || !connection.trim()) && styles.disabled]}>
            {testing ? <ActivityIndicator color="#1d4ed8" size="small" /> : <Text style={styles.testText}>Probar nueva conexión</Text>}
          </Pressable>
          {!!testResult && <Text accessibilityRole="alert" style={[styles.result, testFailed && styles.error]}>{testResult}</Text>}
          <Text style={styles.label}>Programación cron</Text>
          <TextInput value={schedule} onChangeText={setSchedule} placeholder="30 3 * * *" placeholderTextColor="#94a3b8" style={styles.input} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Programación cron" />
          <Text style={styles.hint}>Cinco campos. Déjalo vacío para quitar la programación automática.</Text>
          {project.provider === 'postgres' && <View style={styles.options}>
            <Text style={styles.optionsTitle}>Compatibilidad de restauración</Text>
            <Option label="Omitir propietario (--no-owner)" value={noOwner} onChange={setNoOwner} />
            <Option label="Omitir privilegios (--no-privileges)" value={noPrivileges} onChange={setNoPrivileges} />
          </View>}
          <View style={styles.activeRow}><Text style={styles.activeText}>Proyecto activo</Text><Switch value={active} onValueChange={setActive} trackColor={{ true: '#2563eb' }} /></View>
          <Pressable disabled={saving || !name.trim()} onPress={() => void save()} style={[styles.saveButton, (saving || !name.trim()) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar cambios</Text>}
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Option({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.optionRow}><Text style={styles.optionLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: '#2563eb' }} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  loader: { flex: 1 },
  content: { padding: 22, paddingBottom: 34 },
  kicker: { color: '#2563eb', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '800', marginTop: 7 },
  slug: { color: '#64748b', fontSize: 13, marginTop: 5 },
  label: { color: '#334155', fontSize: 13, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  optional: { color: '#94a3b8', fontWeight: '500' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#dbe2ea', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, color: '#0f172a', fontSize: 14 },
  secretRow: { flexDirection: 'row', alignItems: 'center' },
  secretInput: { flex: 1 },
  reveal: { padding: 10, marginLeft: 4 },
  revealText: { color: '#2563eb', fontSize: 12, fontWeight: '800' },
  hint: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 7 },
  testButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, marginTop: 10, borderRadius: 11, backgroundColor: '#dbeafe' },
  testText: { color: '#1d4ed8', fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.5 },
  result: { color: '#15803d', fontSize: 12, lineHeight: 18, marginTop: 9 },
  error: { color: '#b91c1c' },
  options: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 16, padding: 15, marginTop: 20 },
  optionsTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 7 },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { flex: 1, paddingRight: 10, color: '#334155', fontSize: 12, fontWeight: '600' },
  activeRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  activeText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  cancelText: { color: '#64748b', fontWeight: '700' },
});
