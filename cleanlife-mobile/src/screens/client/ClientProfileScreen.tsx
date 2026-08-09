import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, getStoredUserId, profileApi } from '../../apiClient';

type Props = { onBack: () => void; onSessionExpired: () => void };

export default function ClientProfileScreen({ onBack, onSessionExpired }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await profileApi.getMe();
      setName(result.user.name || '');
      setEmail(result.user.email || '');
      setPhoneNumber(result.user.phone_number || '');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSessionExpired();
      Alert.alert('Could not load profile', err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const clientId = await getStoredUserId();
    if (!clientId) return Alert.alert('Not logged in', 'Please log in again.');
    setSubmitting(true);
    try {
      await profileApi.updateClient(clientId, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSessionExpired();
      Alert.alert('Update failed', err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#059669" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.title}>My profile</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Phone number</Text>
          <Text style={styles.readonly}>{phoneNumber || '—'}</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Pressable style={styles.button} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save changes</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f8fafc' },
  back: { color: '#059669', fontWeight: '700', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '900', color: '#065f46', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 10, marginBottom: 6 },
  readonly: { fontSize: 15, color: '#1e293b', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12 },
  button: { backgroundColor: '#059669', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: '800' },
});