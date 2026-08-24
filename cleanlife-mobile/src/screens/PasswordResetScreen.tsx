import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, authApi } from '../apiClient';

type Props = {
  onBack: () => void;
  onComplete: () => void;
};

export default function PasswordResetScreen({
  onBack,
  onComplete,
}: Props) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    if (!phone.trim()) {
      Alert.alert('Missing phone number', 'Enter your phone number.');
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.requestPasswordReset(phone.trim());

      Alert.alert(
        'Code sent',
        result.reset_code
          ? `Your development reset code is ${result.reset_code}`
          : 'A password reset code has been sent to your phone.'
      );

      setStep('code');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to request password reset.';

      Alert.alert('Reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (code.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit reset code.');
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Invalid password',
        'Password must be at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please enter the same password.');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(phone.trim(), code, password);

      Alert.alert(
        'Password reset',
        'Your password has been reset successfully.',
        [{ text: 'Login', onPress: onComplete }]
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to reset password.';

      Alert.alert('Reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Reset Password</Text>

        {step === 'phone' ? (
          <>
            <Text style={styles.subtitle}>
              Enter your phone number and we will send you a reset code.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Pressable
              style={[styles.button, loading && styles.disabled]}
              onPress={requestCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Code</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Enter the reset code and choose a new password.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="6-digit reset code"
              value={code}
              onChangeText={(value) =>
                setCode(value.replace(/\D/g, '').slice(0, 6))
              }
              keyboardType="number-pad"
              maxLength={6}
            />

            <TextInput
              style={styles.input}
              placeholder="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <Pressable
              style={[styles.button, loading && styles.disabled]}
              onPress={resetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },

  back: {
    fontSize: 16,
    marginBottom: 30,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 25,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 14,
  },

  button: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#1677ff',
  },

  disabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});