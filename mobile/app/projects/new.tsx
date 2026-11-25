import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPostgresProject, testPostgresConnection } from '@/services/projects';
import { useSession } from '@/services/session';

export default function NewProjectScreen() {
  const { user, request } = useSession();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [connection, setConnection] = useState('');
  const [schedule, setSchedule] = useState('');
  const [noOwner, setNoOwner] = useState(true);
  const [noPrivileges, setNoPrivileges] = useState(true);
  const [showConnection, setShowConnection] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testFailed, setTestFailed] = useState(false);

  if (user?.rol !== 'admin') return <Redirect href="/(tabs)" />;

  async function testConnection() {
    if (!connection.trim()) {
      Alert.alert('Falta la conexión', 'Ingresa la URI de PostgreSQL para probarla.');
      return;
    }
    setTesting(true);
    setTestResult('');
    try {
      const result = await testPostgresConnection(request, connection.trim());
      setTestFailed(!result.ok);
      const version = result.server_version ? ' · PostgreSQL ' + result.server_version : '';
      const latency = result.latency_ms != null ? ' · ' + result.latency_ms + ' ms' : '';
      setTestResult((result.detalle || (result.ok ? 'Conexión correcta' : 'No se pudo conectar')) + version + latency);
    } catch (error) {
      setTestFailed(true);
      setTestResult(error instanceof Error ? error.message : 'No se pudo probar la conexión.');
    } finally {
      setTesting(false);
    }
  }

  async function createProject() {
    if (!name.trim() || !connection.trim()) {
      Alert.alert('Completa los datos', 'El nombre y la conexión PostgreSQL son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      await createPostgresProject(request, {
        slug: slug.trim(),
        nombre: name.trim(),
        connection: connection.trim(),
        schedule: schedule.trim(),
        backup_options: { no_owner: noOwner, no_privileges: noPrivileges },
      });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('No se pudo crear el proyecto', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>CONEXIÓN DIRECTA</Text>
          <Text style={styles.title}>Añadir PostgreSQL</Text>
          <Text style={styles.intro}>La app guarda la URI cifrada en el servidor. Las credenciales no se quedan en el teléfono.</Text>

          <Text style={styles.label}>Nombre visible</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Producción" placeholderTextColor="#94a3b8" style={styles.input} autoCapitalize="sentences" accessibilityLabel="Nombre visible" />
          <Text style={styles.label}>Identificador corto <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput value={slug} onChangeText={setSlug} placeholder="mi-base-produccion" placeholderTextColor="#94a3b8" style={styles.input} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Identificador corto" />
          <Text style={styles.hint}>Minúsculas, números, guiones o guiones bajos. Si lo dejas vacío, se genera desde el nombre.</Text>

          <Text style={styles.label}>URI de conexión</Text>
          <View style={styles.secretRow}>
            <TextInput value={connection} onChangeText={(value) => { setConnection(value); setTestResult(''); }} placeholder="postgresql://usuario:contraseña@host:5432/base" placeholderTextColor="#94a3b8" style={[styles.input, styles.secretInput]} autoCapitalize="none" autoCorrect={false} secureTextEntry={!showConnection} accessibilityLabel="URI de conexión" />
            <Pressable onPress={() => setShowConnection((value) => !value)} style={styles.reveal}><Text style={styles.revealText}>{showConnection ? 'Ocultar' : 'Ver'}</Text></Pressable>
          </View>
          <Pressable disabled={testing || !connection.trim()} onPress={() => void testConnection()} style={[styles.testButton, (testing || !connection.trim()) && styles.disabled]}>
            {testing ? <ActivityIndicator color="#1d4ed8" size="small" /> : <Text style={styles.testButtonText}>Probar conexión</Text>}
          </Pressable>
          {!!testResult && <Text accessibilityRole="alert" style={[styles.testResult, testFailed && styles.testError]}>{testResult}</Text>}

          <Text style={styles.label}>Programación <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput value={schedule} onChangeText={setSchedule} placeholder="30 3 * * *" placeholderTextColor="#94a3b8" style={styles.input} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Programación cron" />
          <Text style={styles.hint}>Cron de cinco campos. Déjalo vacío para ejecutar copias solo manualmente.</Text>

          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Compatibilidad de restauración</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Omitir propietario (--no-owner)</Text>
              <Switch value={noOwner} onValueChange={setNoOwner} trackColor={{ true: '#2563eb' }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Omitir privilegios (--no-privileges)</Text>
              <Switch value={noPrivileges} onValueChange={setNoPrivileges} trackColor={{ true: '#2563eb' }} />
            </View>
            <Text style={styles.hint}>Recomendado al restaurar en otro servidor con usuarios distintos.</Text>
          </View>

          <Pressable disabled={saving || !name.trim() || !connection.trim()} onPress={() => void createProject()} style={[styles.saveButton, (saving || !name.trim() || !connection.trim()) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar proyecto</Text>}
          </Pressable>
          <Pressable disabled={saving} onPress={() => router.back()} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
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
  intro: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 23 },
  label: { color: '#334155', fontSize: 13, fontWeight: '800', marginTop: 17, marginBottom: 8 },
  optional: { color: '#94a3b8', fontWeight: '500' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#dbe2ea', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, color: '#0f172a', fontSize: 14 },
  hint: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 7 },
  secretRow: { flexDirection: 'row', alignItems: 'center' },
  secretInput: { flex: 1 },
  reveal: { padding: 10, marginLeft: 4 },
  revealText: { color: '#2563eb', fontSize: 12, fontWeight: '800' },
  testButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, marginTop: 10, borderRadius: 11, backgroundColor: '#dbeafe' },
  disabled: { opacity: 0.5 },
  testButtonText: { color: '#1d4ed8', fontWeight: '800', fontSize: 12 },
  testResult: { color: '#15803d', fontSize: 12, lineHeight: 18, marginTop: 10 },
  testError: { color: '#b91c1c' },
  optionsCard: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 16, padding: 15, marginTop: 22 },
  optionsTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 8 },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { flex: 1, paddingRight: 12, color: '#334155', fontSize: 12, fontWeight: '600' },
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancelButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  cancelText: { color: '#64748b', fontWeight: '700' },
});
