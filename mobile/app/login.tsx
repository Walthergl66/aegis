import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api } from '@/services/api';
import { useSession } from '@/services/session';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await signIn(await api.login(username.trim(), password, code.trim()));
      router.replace('/(tabs)');
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.totpRequired) setTotpRequired(true);
        setError(cause.message);
      } else setError('Ocurrió un error inesperado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brandMark}><Text style={styles.brandIcon}>↗</Text></View>
        <Text style={styles.eyebrow}>AEGIS</Text>
        <Text style={styles.title}>{'Hola de nuevo'}</Text>
        <Text style={styles.subtitle}>Entra para cuidar tus copias y estar tranquilo.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Usuario</Text>
          <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} textContentType="username" placeholder="Tu usuario" placeholderTextColor="#94a3b8" style={styles.input} accessibilityLabel="Usuario" />
          <Text style={[styles.label, styles.secondLabel]}>Contraseña</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry textContentType="password" placeholder="Tu contraseña" placeholderTextColor="#94a3b8" style={styles.input} accessibilityLabel="Contraseña" />
          {totpRequired && <>
            <Text style={[styles.label, styles.secondLabel]}>Código de verificación</Text>
            <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={8} placeholder="000000" placeholderTextColor="#94a3b8" style={styles.input} accessibilityLabel="Código de verificación" />
          </>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable disabled={loading || !username || !password} onPress={submit} style={({ pressed }) => [styles.button, (loading || !username || !password) && styles.disabled, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/register')} style={styles.registerLink}>
            <Text style={styles.registerText}>¿Primera vez? Crea tu cuenta</Text>
          </Pressable>
        </View>
        <Text style={styles.footer}>Tu conexión está protegida</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fc' },
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 28 },
  brandMark: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  brandIcon: { fontSize: 28, lineHeight: 32, color: '#1d4ed8', fontWeight: '700' },
  eyebrow: { color: '#2563eb', fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 10 },
  title: { color: '#0f172a', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 24, marginTop: 12, maxWidth: 340 },
  form: { marginTop: 28 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  secondLabel: { marginTop: 18 },
  input: { minHeight: 52, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 15, color: '#0f172a', fontSize: 16 },
  error: { color: '#b91c1c', marginTop: 14, lineHeight: 20 },
  button: { minHeight: 54, marginTop: 22, borderRadius: 16, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', shadowColor: '#1d4ed8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  registerLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  registerText: { color: '#2563eb', fontSize: 14, fontWeight: '700' },
  footer: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 28 },
});
