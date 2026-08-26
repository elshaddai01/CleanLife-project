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
  onForgotPassword: () => void;
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

export default function AuthScreen({ initialRole, onAuthenticated, onBack, onForgotPassword }: Props) {
  const [role, setRole] = useState<'client' | 'collector'>(initialRole);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'form' | 'verify_email'>('form');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailCode, setEmailCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const finishClientLogin = async () => {
    const result = await authApi.loginClient(email, password);
    await setSession(result.token, 'client', result.client.id, result.client, result.refreshToken);
    registerPushTokenInBackground();
    onAuthenticated('client');
  };

  const handleVerifyEmail = async () => {
    if (emailCode.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code sent to your email.');
      return;
    }
    setVerifying(true);
    try {
      await authApi.verifyEmail(email, emailCode);
      await finishClientLogin();
    } catch (err) {
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert('Verification failed', message);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your email address first.');
      return;
    }
    setResending(true);
    try {
      const result = await authApi.resendEmailCode(email.trim());
      Alert.alert(result.email_delivered ? 'Code sent' : 'Could not send email', result.message);
    } catch (err) {
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert('Could not resend code', message);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async () => {
    if (password.length < 8) {
      Alert.alert('Invalid password', 'Password must be at least 8 characters.');
      return;
    }
    if (role === 'client') {
      if (!email.trim()) {
        Alert.alert('Missing details', 'Email is required.');
        return;
      }
      if (mode === 'register' && (!name.trim() || !phone.trim())) {
        Alert.alert('Missing details', 'Name and phone number are required to register.');
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
          const result = await authApi.registerClient({
            name,
            email,
            phone_number: phone,
            password,
            company_code: companyCode || undefined,
          });
          setStep('verify_email');
          if (!result.email_delivered) {
            Alert.alert(
              'Registration successful',
              'We could not send the verification email right now. Use "Resend code" once your email is working, or contact support.'
            );
          } else {
            Alert.alert('Check your email', `We sent a 6-digit verification code to ${email}.`);
          }
          return;
        }
        await finishClientLogin();
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
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setStep('verify_email');
        Alert.alert('Email not verified', 'Enter your email below to get a new code, then verify to finish logging in.');
        return;
      }
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert(mode === 'register' ? 'Registration failed' : 'Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify_email') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setStep('form')} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to your email address.</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            value={emailCode}
            onChangeText={(v) => setEmailCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />

          <Pressable style={styles.submitButton} onPress={handleVerifyEmail} disabled={verifying}>
            {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Verify</Text>}
          </Pressable>

          <Pressable onPress={handleResendCode} disabled={resending} style={styles.linkButton}>
            <Text style={styles.linkText}>{resending ? 'Sending…' : 'Resend code'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
            onPress={() => setMode('login')}
          >
            <Text style={mode === 'login' ? styles.toggleTextActive : styles.toggleText}>Log in</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, mode === 'register' && styles.toggleButtonActive]}
            onPress={() => setMode('register')}
          >
            <Text style={mode === 'register' ? styles.toggleTextActive : styles.toggleText}>Register</Text>
          </Pressable>
        </View>

        {role === 'client' ? (
          <>
            {mode === 'register' && (
              <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
            )}
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {mode === 'register' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Company code (optional)"
                  value={companyCode}
                  onChangeText={setCompanyCode}
                />
              </>
            )}
          </>
        ) : (
          <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} />
        )}

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{mode === 'register' ? 'Register & log in' : 'Log in'}</Text>
          )}
        </Pressable>

        {role === 'client' && mode === 'login' && (
          <Pressable onPress={onForgotPassword} style={styles.linkButton}>
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>
        )}
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
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#059669', fontWeight: '700', fontSize: 13 },
});