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
  email: string;
  phone: string;
  onVerified: () => void;
  onBack: () => void;
};

export default function VerificationScreen({
  email,
  phone,
  onVerified,
  onBack,
}: Props) {
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (emailCode.length !== 6 || phoneCode.length !== 6) {
      Alert.alert(
        'Invalid code',
        'Please enter the 6-digit email and phone verification codes.'
      );
      return;
    }

    setLoading(true);

    try {
      await authApi.verifyEmail(email, emailCode);
      await authApi.verifyPhone(phone, phoneCode);

      Alert.alert(
        'Verification successful',
        'Your email and phone number have been verified.',
        [{ text: 'Continue', onPress: onVerified }]
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Verification failed. Please try again.';

      Alert.alert('Verification failed', message);
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

        <Text style={styles.title}>Verify your account</Text>

        <Text style={styles.subtitle}>
          Enter the verification codes sent to your email and phone number.
        </Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.info}>{email}</Text>

        <TextInput
          style={styles.input}
          placeholder="Email verification code"
          value={emailCode}
          onChangeText={(value) =>
            setEmailCode(value.replace(/\D/g, '').slice(0, 6))
          }
          keyboardType="number-pad"
          maxLength={6}
        />

        <Text style={styles.label}>Phone number</Text>
        <Text style={styles.info}>{phone}</Text>

        <TextInput
          style={styles.input}
          placeholder="Phone verification code"
          value={phoneCode}
          onChangeText={(value) =>
            setPhoneCode(value.replace(/\D/g, '').slice(0, 6))
          }
          keyboardType="number-pad"
          maxLength={6}
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={verify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify Account</Text>
          )}
        </Pressable>
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
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 5,
  },

  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 17,
    marginBottom: 12,
  },

  button: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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