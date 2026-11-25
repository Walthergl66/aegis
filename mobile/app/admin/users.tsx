import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteManagedUser, listManagedUsers, ManagedUser } from '@/services/admin';
import { useSession } from '@/services/session';

function roleName(role: string) {
  return role === 'admin' ? 'Administrador' : 'Solo lectura';
}

export default function AdminUsersScreen() {
  const { user, request } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      setUsers(await listManagedUsers(request));
    } catch (error) {
      Alert.alert('No se pudieron cargar los usuarios', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function confirmDelete(target: ManagedUser) {
    if (target.id === user?.id) {
      Alert.alert('No puedes eliminar tu propia cuenta', 'Pide a otro administrador que gestione tu acceso.');
      return;
    }
    Alert.alert('Eliminar usuario', 'Se eliminará el acceso de ' + target.username + ' y se revocarán sus sesiones.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        void deleteManagedUser(request, target.id).then(() => load(true)).catch((error) => {
          Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Intenta de nuevo.');
        });
      } },
    ]);
  }

  if (user?.rol !== 'admin') return null;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}><Text style={styles.kicker}>ACCESO A LA APP</Text><Text style={styles.title}>Usuarios</Text></View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/admin/users/new')} style={styles.add}><Text style={styles.addText}>+</Text></Pressable>
        </View>
        <Text style={styles.subtitle}>Las cuentas existentes siguen funcionando; cada cambio de contraseña o desactivación revoca las sesiones correspondientes.</Text>
        {loading ? <ActivityIndicator style={styles.loader} color="#2563eb" /> : <>
          {users.map((managed) => <View key={managed.id} style={styles.card}>
            <View style={styles.userTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{managed.username.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.identity}>
                <Text style={styles.username}>{managed.username}{managed.id === user.id ? ' · tú' : ''}</Text>
                <Text style={styles.meta}>{roleName(managed.rol)} · {managed.activo ? 'Activo' : 'Inactivo'}</Text>
              </View>
              <View style={[styles.state, managed.activo ? styles.activeState : styles.inactiveState]} />
            </View>
            <View style={styles.badges}>
              <Text style={[styles.badge, managed.rol === 'admin' ? styles.adminBadge : styles.viewerBadge]}>{roleName(managed.rol)}</Text>
              <Text style={[styles.badge, managed.totp_enabled ? styles.twoFaOn : styles.twoFaOff]}>{managed.totp_enabled ? '2FA activo' : 'Sin 2FA'}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => router.push({ pathname: '/admin/users/[id]', params: { id: String(managed.id) } })} style={styles.editButton}><Text style={styles.editText}>Editar</Text></Pressable>
              {managed.id !== user.id && <Pressable onPress={() => confirmDelete(managed)} style={styles.deleteButton}><Text style={styles.deleteText}>Eliminar</Text></Pressable>}
            </View>
          </View>)}
          {!users.length && <View style={styles.empty}><Text style={styles.emptyTitle}>Sin usuarios registrados</Text><Text style={styles.meta}>Crea una cuenta para dar acceso a otra persona.</Text></View>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 20, paddingBottom: 34 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  headingCopy: { flex: 1 },
  kicker: { color: '#2563eb', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '800', marginTop: 6 },
  add: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 25, lineHeight: 28 },
  subtitle: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 9, marginBottom: 18 },
  loader: { marginTop: 32 },
  card: { padding: 16, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  userTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1d4ed8', fontSize: 16, fontWeight: '900' },
  identity: { flex: 1, marginLeft: 11 },
  username: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 11, marginTop: 4 },
  state: { width: 8, height: 8, borderRadius: 4 },
  activeState: { backgroundColor: '#16a34a' },
  inactiveState: { backgroundColor: '#94a3b8' },
  badges: { flexDirection: 'row', marginTop: 14 },
  badge: { overflow: 'hidden', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '800', marginRight: 7 },
  adminBadge: { color: '#1d4ed8', backgroundColor: '#dbeafe' },
  viewerBadge: { color: '#475569', backgroundColor: '#f1f5f9' },
  twoFaOn: { color: '#15803d', backgroundColor: '#dcfce7' },
  twoFaOff: { color: '#64748b', backgroundColor: '#f1f5f9' },
  actions: { flexDirection: 'row', marginTop: 14 },
  editButton: { minHeight: 35, minWidth: 78, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  editText: { color: '#1d4ed8', fontWeight: '800', fontSize: 12 },
  deleteButton: { minHeight: 35, minWidth: 78, borderRadius: 10, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginLeft: 8 },
  deleteText: { color: '#b91c1c', fontWeight: '800', fontSize: 12 },
  empty: { padding: 20, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800', marginBottom: 5 },
});
