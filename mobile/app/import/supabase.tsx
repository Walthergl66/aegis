import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvailableSupabaseProject, fetchSupabaseProjects, importSupabaseProjects } from '@/services/projects';
import { useSession } from '@/services/session';

export default function ImportSupabaseScreen() {
  const { user, request } = useSession();
  const [pat, setPat] = useState('');
  const [accountName, setAccountName] = useState('Importada desde app');
  const [available, setAvailable] = useState<AvailableSupabaseProject[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [existingCount, setExistingCount] = useState(0);
  const [dbPassword, setDbPassword] = useState('');
  const [poolerMode, setPoolerMode] = useState<'session' | 'transaction'>('session');
  const [testConnection, setTestConnection] = useState(true);
  const [showPat, setShowPat] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  if (user?.rol !== 'admin') return <Redirect href="/(tabs)" />;

  async function fetchProjects() {
    if (!pat.trim()) return;
    setLoading(true);
    setAvailable([]);
    setSelected({});
    setExistingCount(0);
    try {
      const result = await fetchSupabaseProjects(request, pat.trim());
      setAvailable(result.available);
      setExistingCount(result.existing_count);
      if (!result.available.length && result.existing_count) {
        Alert.alert('Proyectos ya importados', 'No hay proyectos nuevos disponibles en esta cuenta.');
      } else if (!result.available.length) {
        Alert.alert('Sin proyectos', 'No se encontraron proyectos accesibles con este PAT.');
      }
    } catch (error) {
      Alert.alert('No se pudo consultar Supabase', error instanceof Error ? error.message : 'Revisa el PAT e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function toggle(ref: string) {
    setSelected((current) => ({ ...current, [ref]: !current[ref] }));
  }

  async function submitImport() {
    const selectedProjects = Object.keys(selected).filter((ref) => selected[ref]);
    if (!selectedProjects.length) {
      Alert.alert('Selecciona proyectos', 'Elige al menos un proyecto para importar.');
      return;
    }
    setCreating(true);
    try {
      const result = await importSupabaseProjects(request, {
        pat: pat.trim(),
        account_name: accountName.trim() || 'Importada desde app',
        selected_projects: selectedProjects,
        db_password: dbPassword,
        pooler_mode: poolerMode,
        test_connection: testConnection,
      });
      const details = result.errors.length ? '\n\n' + result.errors.join('\n') : '';
      Alert.alert(
        result.created ? 'Importación completada' : 'Importación sin proyectos',
        result.created + ' proyecto(s) añadido(s) a ' + result.account_name + '.' + details,
        [{ text: 'Listo', onPress: () => { if (result.created) router.replace('/(tabs)'); } }],
      );
      if (result.created) {
        setPat('');
        setDbPassword('');
        setAvailable([]);
        setSelected({});
      }
    } catch (error) {
      Alert.alert('No se pudo completar la importación', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>PROVEEDOR OPCIONAL</Text>
          <Text style={styles.title}>Importar Supabase</Text>
          <Text style={styles.intro}>Descubre proyectos con tu PAT. La cuenta queda cifrada en el servidor; el token no se guarda en el teléfono.</Text>

          <Text style={styles.label}>Personal Access Token</Text>
          <View style={styles.secretRow}>
            <TextInput value={pat} onChangeText={setPat} placeholder="sbp_…" placeholderTextColor="#94a3b8" style={[styles.input, styles.secretInput]} secureTextEntry={!showPat} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Personal Access Token de Supabase" />
            <Pressable onPress={() => setShowPat((value) => !value)} style={styles.reveal}><Text style={styles.revealText}>{showPat ? 'Ocultar' : 'Ver'}</Text></Pressable>
          </View>
          <Text style={styles.label}>Nombre de la cuenta</Text>
          <TextInput value={accountName} onChangeText={setAccountName} placeholder="Cuenta de Supabase" placeholderTextColor="#94a3b8" style={styles.input} accessibilityLabel="Nombre de la cuenta" />
          <Pressable disabled={loading || !pat.trim()} onPress={() => void fetchProjects()} style={[styles.fetchButton, (loading || !pat.trim()) && styles.disabled]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Buscar proyectos</Text>}
          </Pressable>
          {existingCount > 0 && <Text style={styles.notice}>{existingCount} proyecto(s) ya estaban importados.</Text>}

          {!!available.length && <>
            <Text style={styles.sectionTitle}>Proyectos disponibles</Text>
            <View style={styles.projects}>
              {available.map((project) => <Pressable key={project.ref} onPress={() => toggle(project.ref)} style={styles.projectRow} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selected[project.ref]) }}>
                <View style={[styles.checkbox, selected[project.ref] && styles.checked]}>{selected[project.ref] && <Text style={styles.checkmark}>✓</Text>}</View>
                <Text style={styles.projectName} numberOfLines={2}>{project.name}</Text>
                <Text style={styles.projectRef}>{project.ref.slice(0, 8)}…</Text>
              </Pressable>)}
            </View>

            <Text style={styles.sectionTitle}>Conexión PostgreSQL</Text>
            <Text style={styles.label}>Contraseña de la base <Text style={styles.optional}>(si el pooler la requiere)</Text></Text>
            <View style={styles.secretRow}>
              <TextInput value={dbPassword} onChangeText={setDbPassword} placeholder="Contraseña de la base" placeholderTextColor="#94a3b8" style={[styles.input, styles.secretInput]} secureTextEntry={!showDbPassword} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Contraseña de la base de datos" />
              <Pressable onPress={() => setShowDbPassword((value) => !value)} style={styles.reveal}><Text style={styles.revealText}>{showDbPassword ? 'Ocultar' : 'Ver'}</Text></Pressable>
            </View>
            <Text style={styles.hint}>Se usa para completar la URI del pooler en el servidor; no se conserva como campo independiente.</Text>
            <Text style={styles.label}>Modo del pooler</Text>
            <View style={styles.segment}>
              <Pressable onPress={() => setPoolerMode('session')} style={[styles.segmentButton, poolerMode === 'session' && styles.segmentActive]}><Text style={[styles.segmentText, poolerMode === 'session' && styles.segmentTextActive]}>Session · 5432</Text></Pressable>
              <Pressable onPress={() => setPoolerMode('transaction')} style={[styles.segmentButton, poolerMode === 'transaction' && styles.segmentActive]}><Text style={[styles.segmentText, poolerMode === 'transaction' && styles.segmentTextActive]}>Transaction · 6543</Text></Pressable>
            </View>
            <View style={styles.testRow}>
              <View style={styles.testCopy}><Text style={styles.testTitle}>Probar conexión antes de importar</Text><Text style={styles.hint}>Recomendado para validar acceso a pg_dump.</Text></View>
              <Switch value={testConnection} onValueChange={setTestConnection} trackColor={{ true: '#2563eb' }} />
            </View>
            <Pressable disabled={creating || !Object.values(selected).some(Boolean)} onPress={() => void submitImport()} style={[styles.fetchButton, styles.importButton, (creating || !Object.values(selected).some(Boolean)) && styles.disabled]}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Importar seleccionados</Text>}
            </Pressable>
          </>}
          <Text style={styles.footer}>Las conexiones PostgreSQL directas siguen funcionando sin PAT ni cuenta Supabase.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 22, paddingBottom: 36 },
  kicker: { color: '#2563eb', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '800', marginTop: 7 },
  intro: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 },
  label: { color: '#334155', fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  optional: { color: '#94a3b8', fontWeight: '500' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#dbe2ea', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, color: '#0f172a', fontSize: 14 },
  secretRow: { flexDirection: 'row', alignItems: 'center' },
  secretInput: { flex: 1 },
  reveal: { padding: 10, marginLeft: 4 },
  revealText: { color: '#2563eb', fontSize: 12, fontWeight: '800' },
  fetchButton: { minHeight: 50, borderRadius: 13, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.5 },
  notice: { color: '#64748b', fontSize: 12, marginTop: 12 },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', marginTop: 27, marginBottom: 5 },
  projects: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  projectRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  checkbox: { width: 21, height: 21, borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 6, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checked: { borderColor: '#1d4ed8', backgroundColor: '#1d4ed8' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  projectName: { flex: 1, color: '#0f172a', fontSize: 13, fontWeight: '700', paddingRight: 5 },
  projectRef: { color: '#94a3b8', fontSize: 10, fontFamily: 'monospace' },
  hint: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 6 },
  segment: { flexDirection: 'row', backgroundColor: '#e2e8f0', padding: 4, borderRadius: 12 },
  segmentButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  segmentTextActive: { color: '#1d4ed8' },
  testRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  testCopy: { flex: 1, paddingRight: 10 },
  testTitle: { color: '#334155', fontWeight: '700', fontSize: 12 },
  importButton: { marginTop: 24 },
  footer: { textAlign: 'center', color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 26 },
});
