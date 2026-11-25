import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api } from '@/services/api';
import { useSession } from '@/services/session';

export default function RegisterScreen() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!username.trim()) {
      setError('El usuario es obligatorio.');
      return;
    }
    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await signIn(await api.register(username.trim(), password));
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo crear la cuenta. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brandMark}><Text style={styles.brandIcon}>↗</Text></View>
        <Text style={styles.eyebrow}>TU ESPACIO PRIVADO</Text>
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Tus conexiones y copias se sincronizarán al iniciar sesión en tus dispositivos.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Usuario</Text>
          <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} textContentType="username" placeholder="Elige un usuario" placeholderTextColor="#94a3b8" style={styles.input} accessibilityLabel="Usuario" />
          <Text style={[styles.label, styles.secondLabel]}>Contraseña</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" placeholder="Mínimo 12 caracteres" placeholderTextColor="#94a3b8" style={styles.input} accessibilityLabel="Contraseña" />
          <Text style={[styles.label, styles.secondLabel]}>Confirma la contraseña</Text>
          <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry textContentType="newPassword" placeholder="Escríbela de nuevo" placeholderTextColor="#94a3b8" style={styles.input} accessibilityLabel="Confirmación de contraseña" />
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable disabled={loading || !username.trim() || password.length < 12 || !confirmation} onPress={() => void submit()} style={({ pressed }) => [styles.button, (loading || !username.trim() || password.length < 12 || !confirmation) && styles.disabled, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Crear cuenta</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.loginLink}>
            <Text style={styles.loginText}>Ya tengo cuenta · Iniciar sesión</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 28 },
  brandMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  brandIcon: { fontSize: 28, lineHeight: 32, color: '#1d4ed8', fontWeight: '700' },
  eyebrow: { color: '#2563eb', fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 10 },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 340 },
  form: { marginTop: 26 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  secondLabel: { marginTop: 16 },
  input: { minHeight: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe2ea', borderRadius: 13, paddingHorizontal: 15, color: '#0f172a', fontSize: 15 },
  error: { color: '#b91c1c', marginTop: 14, lineHeight: 20 },
  button: { minHeight: 52, marginTop: 20, borderRadius: 14, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loginLink: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  loginText: { color: '#1d4ed8', fontSize: 14, fontWeight: '700' },
});
