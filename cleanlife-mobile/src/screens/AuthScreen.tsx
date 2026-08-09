
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

import { authApi, setSession, ApiError } from '../apiClient';
import VerificationScreen from './VerificationScreen';
import PasswordResetScreen from './PasswordResetScreen';

type Props = {
  initialRole: 'client' | 'collector';
  onAuthenticated: (role: 'client' | 'collector') => void;
  onBack: () => void;
};

export default function AuthScreen({
  initialRole,
  onAuthenticated,
  onBack,
}: Props) {
  const [role, setRole] = useState<'client' | 'collector'>(initialRole);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('');

  const [loading, setLoading] = useState(false);

  const [showVerification, setShowVerification] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredPhone, setRegisteredPhone] = useState('');

  const handleSubmit = async () => {
    if (password.length < 8) {
      Alert.alert(
        'Invalid password',
        'Password must be at least 8 characters.'
      );
      return;
    }

    // -----------------------------
    // VALIDATION
    // -----------------------------
    if (mode === 'register') {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        Alert.alert(
          'Missing details',
          'Name, email, and phone number are required for registration.'
        );
        return;
      }

      if (!email.includes('@')) {
        Alert.alert(
          'Invalid email',
          'Please enter a valid email address.'
        );
        return;
      }

      if (role === 'collector' && !username.trim()) {
        Alert.alert(
          'Missing username',
          'Username is required.'
        );
        return;
      }
    } else {
      if (role === 'client' && !phone.trim()) {
        Alert.alert(
          'Missing phone number',
          'Phone number is required.'
        );
        return;
      }

      if (role === 'collector' && !username.trim()) {
        Alert.alert(
          'Missing username',
          'Username is required.'
        );
        return;
      }
    }

    setLoading(true);

    try {
      // -----------------------------
      // CLIENT
      // -----------------------------
      if (role === 'client') {
        // CLIENT REGISTRATION
        if (mode === 'register') {
          await authApi.registerClient({
            name: name.trim(),
            email: email.trim(),
            phone_number: phone.trim(),
            password,
            company_code: companyCode.trim() || undefined,
          });

          // Save details for verification screen
          setRegisteredEmail(email.trim());
          setRegisteredPhone(phone.trim());

          // Open verification screen
          setShowVerification(true);

          return;
        }

        // CLIENT LOGIN
        const result = await authApi.loginClient(
          phone.trim(),
          password
        );

        await setSession(
          result.token,
          'client',
          result.client.id
        );

        onAuthenticated('client');
        return;
      }

      // -----------------------------
      // COLLECTOR
      // -----------------------------

      // COLLECTOR REGISTRATION
      if (mode === 'register') {
        await authApi.registerCollector({
          username: username.trim(),
          password,
          name: name.trim(),
          email: email.trim(),
          phone_number: phone.trim(),
        });
      }

      // COLLECTOR LOGIN
      const result = await authApi.loginCollector(
        username.trim(),
        password
      );

      await setSession(
        result.token,
        'collector',
        result.collector.id
      );

      onAuthenticated('collector');
    } catch (err) {
      const message =
  err instanceof ApiError
    ? 'Error ' + err.status + ': ' + err.message
    : String(err);

      Alert.alert(
        mode === 'register'
          ? 'Registration failed'
          : 'Login failed',
        message
      );
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // EMAIL + PHONE VERIFICATION
  // -----------------------------
  if (showVerification) {
    return (
      <VerificationScreen
        email={registeredEmail}
        phone={registeredPhone}
        onBack={() => setShowVerification(false)}
        onVerified={() => {
          setShowVerification(false);
          setMode('login');
        }}
      />
    );
  }

  // -----------------------------
  // PASSWORD RESET
  // -----------------------------
  if (showPasswordReset) {
    return (
      <PasswordResetScreen
        onBack={() => setShowPasswordReset(false)}
        onComplete={() => {
          setShowPasswordReset(false);
          setMode('login');
        }}
      />
    );
  }

  // -----------------------------
  // MAIN AUTH SCREEN
  // -----------------------------
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.backButton}
          onPress={onBack}
        >
          <Text style={styles.backText}>
            ← Back to role selection
          </Text>
        </Pressable>

        <Text style={styles.title}>CleanLife</Text>

        <Text style={styles.subtitle}>
          {role === 'client'
            ? 'Client account'
            : 'Collector account'}
        </Text>

        {/* LOGIN / REGISTER */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleButton,
              mode === 'login' &&
                styles.toggleButtonActive,
            ]}
            onPress={() => setMode('login')}
          >
            <Text
              style={
                mode === 'login'
                  ? styles.toggleTextActive
                  : styles.toggleText
              }
            >
              Log in
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toggleButton,
              mode === 'register' &&
                styles.toggleButtonActive,
            ]}
            onPress={() => setMode('register')}
          >
            <Text
              style={
                mode === 'register'
                  ? styles.toggleTextActive
                  : styles.toggleText
              }
            >
              Register
            </Text>
          </Pressable>
        </View>

        {/* CLIENT */}
        {role === 'client' && (
          <>
            {mode === 'register' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

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
                  autoCapitalize="none"
                />
              </>
            )}

            {mode === 'login' && (
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            )}
          </>
        )}

        {/* COLLECTOR */}
        {role === 'collector' && (
          <>
            {mode === 'register' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </>
            )}

            {mode === 'login' && (
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            )}
          </>
        )}

        {/* PASSWORD */}
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* FORGOT PASSWORD */}
        {mode === 'login' && (
          <Pressable
            style={styles.forgotButton}
            onPress={() => setShowPasswordReset(true)}
          >
            <Text style={styles.forgotText}>
              Forgot password?
            </Text>
          </Pressable>
        )}

        {/* SUBMIT */}
        <Pressable
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {mode === 'register'
                ? 'Register & log in'
                : 'Log in'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// -----------------------------
// STYLES
// -----------------------------
const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },

  backButton: {
    marginBottom: 12,
  },

  backText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 14,
  },

  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#065f46',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },

  toggleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
  },

  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },

  toggleButtonActive: {
    backgroundColor: '#10b981',
  },

  toggleText: {
    color: '#475569',
    fontWeight: '600',
  },

  toggleTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

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

  forgotButton: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },

  forgotText: {
    color: '#059669',
    fontWeight: '700',
  },

  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },

  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
