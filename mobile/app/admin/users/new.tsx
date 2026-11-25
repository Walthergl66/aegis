import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createManagedUser, getManagedUser, updateManagedUser } from '@/services/admin';
import { useSession } from '@/services/session';

export default function ManagedUserFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const { user, request } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const self = editing && user?.id === Number(id);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    getManagedUser(request, Number(id)).then((record) => {
      if (!mounted) return;
      setUsername(record.username);
      setRole(record.rol);
      setActive(record.activo);
    }).catch((error) => {
      Alert.alert('No se pudo cargar el usuario', error instanceof Error ? error.message : 'Intenta de nuevo.');
      router.back();
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id, request]);

  if (user?.rol !== 'admin') return <Redirect href="/(tabs)" />;

  async function save() {
    if (!username.trim()) {
      Alert.alert('Falta el usuario', 'Escribe el nombre de acceso.');
      return;
    }
    if (!editing && password.length < 12) {
      Alert.alert('Contraseña insuficiente', 'Usa al menos 12 caracteres.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateManagedUser(request, Number(id), {
          username: username.trim(),
          password,
          rol: role,
          activo: active,
        });
      } else {
        await createManagedUser(request, { username: username.trim(), password, rol: role });
      }
      router.back();
    } catch (error) {
      Alert.alert('No se pudo guardar el usuario', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={styles.loader} color="#2563eb" /></SafeAreaView>;
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>{editing ? 'CUENTA DE ACCESO' : 'NUEVA CUENTA'}</Text>
          <Text style={styles.title}>{editing ? 'Editar usuario' : 'Invitar usuario'}</Text>
          <Text style={styles.subtitle}>La cuenta permitirá iniciar sesión en la app móvil. Los cambios de contraseña revocan las sesiones anteriores.</Text>

          <Text style={styles.label}>Nombre de usuario</Text>
          <TextInput value={username} onChangeText={setUsername} style={styles.input} placeholder="usuario" placeholderTextColor="#94a3b8" autoCapitalize="none" autoCorrect={false} textContentType="username" accessibilityLabel="Nombre de usuario" />
          <Text style={styles.label}>{editing ? 'Nueva contraseña' : 'Contraseña inicial'}</Text>
          <TextInput value={password} onChangeText={setPassword} style={styles.input} placeholder={editing ? 'Dejar vacío para conservarla' : 'Mínimo 12 caracteres'} placeholderTextColor="#94a3b8" secureTextEntry textContentType="newPassword" autoCapitalize="none" accessibilityLabel="Contraseña" />
          {editing && <Text style={styles.hint}>En blanco mantiene la contraseña actual. Al cambiarla se revocan las sesiones activas.</Text>}
          {!editing && <Text style={styles.hint}>Comparte la contraseña inicial por un canal seguro y pide que se cambie después del primer acceso.</Text>}

          <Text style={styles.label}>Rol en la app</Text>
          {self ? <View style={styles.lockedRole}><Text style={styles.lockedRoleText}>Administrador · no puedes cambiar tu propio rol</Text></View> :
            <View style={styles.roleChoices}>
              <RoleChoice title="Solo lectura" detail="Consulta proyectos, historial y auditoría." selected={role === 'viewer'} onPress={() => setRole('viewer')} />
              <RoleChoice title="Administrador" detail="Gestiona proyectos, cuentas y usuarios." selected={role === 'admin'} onPress={() => setRole('admin')} />
            </View>}
          {editing && <View style={styles.activeRow}>
            <View style={styles.activeCopy}><Text style={styles.activeTitle}>Cuenta activa</Text><Text style={styles.hint}>Desactivarla bloquea el acceso y revoca sus sesiones.</Text></View>
            <Switch value={active} onValueChange={setActive} disabled={self} trackColor={{ true: '#2563eb' }} />
          </View>}

          <Pressable disabled={saving || !username.trim()} onPress={() => void save()} style={[styles.saveButton, (saving || !username.trim()) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editing ? 'Guardar cambios' : 'Crear usuario'}</Text>}
          </Pressable>
          <Pressable disabled={saving} onPress={() => router.back()} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleChoice({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.roleChoice, selected && styles.roleSelected]}>
    <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioInner} />}</View>
    <View style={styles.roleCopy}><Text style={styles.roleTitle}>{title}</Text><Text style={styles.roleDetail}>{detail}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  loader: { flex: 1 },
  content: { padding: 22, paddingBottom: 36 },
  kicker: { color: '#2563eb', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '800', marginTop: 7 },
  subtitle: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#dbe2ea', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, color: '#0f172a', fontSize: 14 },
  hint: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 6 },
  roleChoices: { marginTop: 2 },
  roleChoice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 13, marginTop: 8 },
  roleSelected: { borderColor: '#60a5fa', backgroundColor: '#eff6ff' },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#2563eb' },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2563eb' },
  roleCopy: { flex: 1, marginLeft: 11 },
  roleTitle: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  roleDetail: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 4 },
  lockedRole: { padding: 14, borderRadius: 13, backgroundColor: '#eff6ff' },
  lockedRoleText: { color: '#1d4ed8', fontSize: 12, fontWeight: '700' },
  activeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  activeCopy: { flex: 1, paddingRight: 12 },
  activeTitle: { color: '#334155', fontSize: 13, fontWeight: '800' },
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.5 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  cancelText: { color: '#64748b', fontWeight: '700' },
});
