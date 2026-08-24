import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { authApi, setSession, ApiError, notificationsApi } from '../apiClient';
import { getExpoPushToken } from '../utils/notifications';

type Props = {
  initialRole: 'client' | 'collector';
  onAuthenticated: (role: 'client' | 'collector') => void;
  onBack: () => void;
};

// [NOTIF-07] Fire-and-forget — a failed push registration must never
// block or fail the login flow itself.
function registerPushTokenInBackground() {
  getExpoPushToken()
    .then((token) => {
      if (token) return notificationsApi.registerToken(token);
    })
    .catch(() => {
      // Non-fatal — push notifications just won't arrive on this device.
    });
}

export default function AuthScreen({ initialRole, onAuthenticated, onBack }: Props) {
  const [role, setRole] = useState<'client' | 'collector'>(initialRole);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [otp, setOtp] = useState('');
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (role === 'client' && mode === 'register' && awaitingOtp) {
      if (!/^\d{6}$/.test(otp.trim())) {
        Alert.alert('Invalid OTP', 'Enter the 6-digit code sent to your phone.');
        return;
      }
    } else if (role === 'client' && mode === 'register') {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        Alert.alert('Missing details', 'Name, email, and phone number are required.');
        return;
      }
    } else if (password.length < 8) {
      Alert.alert('Invalid password', 'Password must be at least 8 characters.');
      return;
    }
    if (role === 'client') {
      if (!phone.trim()) {
        Alert.alert('Missing details', 'Phone number is required.');
        return;
      }
      if (mode === 'register' && (!name.trim() || !email.trim())) {
        Alert.alert('Missing details', 'Name and email are required to register.');
        return;
      }
    }
    if (role === 'collector' && !username.trim()) {
      Alert.alert('Missing username', 'Username is required.');
      return;
    }

    setLoading(true);
    try {
      if (role === 'client') {
        if (mode === 'register') {
          if (!awaitingOtp) {
            const registration = await authApi.registerClient({ name, email, phone_number: phone });
            setAwaitingOtp(true);
            Alert.alert(
              registration.sms_sent ? 'OTP sent' : 'OTP created',
              registration.sms_sent
                ? 'Enter the 6-digit code sent to your phone.'
                : `The SMS could not be delivered. For local testing, use OTP: ${registration.development_otp || 'check the backend log'}`
            );
            return;
          }
          const result = await authApi.verifyPhone(phone, otp.trim());
          await setSession(result.token, 'client', result.client.id, result.client, result.refreshToken);
          registerPushTokenInBackground();
          onAuthenticated('client');
          return;
        }
        const result = await authApi.loginClient(phone, password);
        await setSession(result.token, 'client', result.client.id, result.client, result.refreshToken);
        registerPushTokenInBackground();
        onAuthenticated('client');
      } else {
        if (mode === 'register') {
          await authApi.registerCollector({ username, password });
        }
        const result = await authApi.loginCollector(username, password);
        await setSession(result.token, 'collector', result.collector.id, result.collector, result.refreshToken);
        registerPushTokenInBackground();
        onAuthenticated('collector');
      }
    } catch (err) {
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert(mode === 'register' ? 'Registration failed' : 'Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back to role selection</Text>
        </Pressable>
        <Text style={styles.title}>CleanLife</Text>
        <Text style={styles.subtitle}>
          {role === 'client' ? 'Client account' : 'Collector account'}
        </Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleButton, mode === 'login' && styles.toggleButtonActive]}
            onPress={() => { setMode('login'); setAwaitingOtp(false); setOtp(''); }}
          >
            <Text style={mode === 'login' ? styles.toggleTextActive : styles.toggleText}>Log in</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, mode === 'register' && styles.toggleButtonActive]}
            onPress={() => { setMode('register'); setAwaitingOtp(false); setOtp(''); }}
          >
            <Text style={mode === 'register' ? styles.toggleTextActive : styles.toggleText}>Register</Text>
          </Pressable>
        </View>

        {role === 'client' ? (
          <>
            {mode === 'register' && !awaitingOtp && (
              <>
                <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </>
            )}
            {mode === 'register' && awaitingOtp ? (
              <TextInput
                style={styles.input}
                placeholder="6-digit OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            )}
            {mode === 'register' && !awaitingOtp && (
              <TextInput
                style={styles.input}
                placeholder="Company code (optional)"
                value={companyCode}
                onChangeText={setCompanyCode}
              />
            )}
          </>
        ) : (
          <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} />
        )}

        {!(role === 'client' && mode === 'register') && <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />}

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{mode === 'register' ? (awaitingOtp ? 'Verify and log in' : 'Send OTP') : 'Log in'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  backButton: { marginBottom: 12 },
  backText: { color: '#059669', fontWeight: '700', fontSize: 14 },
  title: { fontSize: 32, fontWeight: '900', color: '#065f46', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  toggleRow: { flexDirection: 'row', marginBottom: 12, backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4 },
  toggleButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#10b981' },
  toggleText: { color: '#475569', fontWeight: '600' },
  toggleTextActive: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});