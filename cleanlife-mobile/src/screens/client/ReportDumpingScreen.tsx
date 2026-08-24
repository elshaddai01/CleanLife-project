import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { ApiError, reportsApi } from '../../apiClient';

type Props = { onBack: () => void };

export default function ReportDumpingScreen({ onBack }: Props) {
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const captureLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access to identify the dumping site.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
    } catch (error) {
      Alert.alert('Location unavailable', String(error));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!description.trim()) {
      Alert.alert('Description required', 'Describe what you saw and where it is.');
      return;
    }
    if (latitude === null || longitude === null) {
      Alert.alert('Location required', 'Capture the dumping site location before submitting.');
      return;
    }
    setLoading(true);
    try {
      await reportsApi.createIllegalDumping({ description: description.trim(), latitude, longitude });
      Alert.alert('Report submitted', 'Thank you. CleanLife will review this report.', [{ text: 'OK', onPress: onBack }]);
    } catch (error) {
      Alert.alert('Report failed', error instanceof ApiError ? `[${error.status}] ${error.message}` : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
      <Text style={styles.title}>Report illegal dumping</Text>
      <Text style={styles.subtitle}>Help us keep your neighborhood clean.</Text>
      <Text style={styles.label}>What did you see?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Describe the waste, location, and any useful details"
        value={description}
        onChangeText={setDescription}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.label}>Dumping site location</Text>
      <Pressable style={styles.locationButton} onPress={captureLocation} disabled={locating}>
        {locating ? <ActivityIndicator color="#059669" /> : <Text style={styles.locationText}>{latitude === null ? 'Capture current location' : `${latitude.toFixed(5)}, ${longitude?.toFixed(5)}`}</Text>}
      </Pressable>
      <View style={styles.notice}><Text style={styles.noticeText}>Your location is captured once only to help locate the report.</Text></View>
      <Pressable style={styles.submitButton} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit report</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f8fafc' },
  back: { marginBottom: 18 },
  backText: { color: '#059669', fontWeight: '700' },
  title: { color: '#065f46', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#64748b', marginTop: 6, marginBottom: 22 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 14 },
  textArea: { minHeight: 130, backgroundColor: '#fff', borderColor: '#cbd5e1', borderRadius: 10, borderWidth: 1, padding: 14, fontSize: 15 },
  locationButton: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#059669', borderRadius: 10, borderWidth: 1, padding: 14 },
  locationText: { color: '#059669', fontWeight: '700' },
  notice: { backgroundColor: '#ecfdf5', borderRadius: 8, marginTop: 10, padding: 10 },
  noticeText: { color: '#047857', fontSize: 12 },
  submitButton: { alignItems: 'center', backgroundColor: '#059669', borderRadius: 10, marginTop: 28, padding: 15 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
