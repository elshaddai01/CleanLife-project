import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { binsApi, uploadApi, ApiError, NearbyBin } from '../../apiClient';

type Props = {
  onBack: () => void;
  onDone: () => void;
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

// [BIN-23] Works identically whether the caller is logged in or fully
// anonymous — same posture as AddBinScreen. Nearby bins are a simple
// picker list (closest pre-selected) rather than a map — the spec only
// asked for drag-to-place on AddBinScreen, not here.
export default function ReportFullBinScreen({ onBack, onDone }: Props) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [bins, setBins] = useState<NearbyBin[]>([]);
  const [selectedBinId, setSelectedBinId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<{ uri: string; base64: string; mimeType: 'image/jpeg' | 'image/png' } | null>(null);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location permission needed', 'Enable location access to find nearby bins.');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(coords);

        const nearby = await binsApi.nearby(coords.lat, coords.lng);
        setBins(nearby);
        if (nearby.length > 0) setSelectedBinId(nearby[0].id);
      } catch (err) {
        const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
        Alert.alert('Could not load nearby bins', message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleTakeSnapshot = async () => {
    setOpeningCamera(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission required', 'Allow camera access to photograph the full bin.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('The camera did not return image data. Please retake the photo.');
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      setSnapshot({ uri: asset.uri, base64: asset.base64, mimeType });
    } catch (err) {
      Alert.alert('Camera error', err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningCamera(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBinId) {
      Alert.alert('Select a bin', 'Choose which bin is full before submitting.');
      return;
    }
    if (!snapshot) {
      Alert.alert('Photo required', 'Take a photo of the full bin before submitting.');
      return;
    }
    if (!location) {
      Alert.alert('Location required', 'Wait for your location before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const uploaded = await uploadApi.uploadPublicPhoto(snapshot.base64, snapshot.mimeType);
      await binsApi.reportFull(selectedBinId, {
        latitude: location.lat,
        longitude: location.lng,
        photo_url: uploaded.url,
      });
      Alert.alert('Reported', 'Thanks for letting us know this bin is full!', [{ text: 'OK', onPress: onDone }]);
    } catch (err) {
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert('Submission failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Report a full bin</Text>
      <Text style={styles.subtitle}>Pick the bin that's full — the closest one is selected by default.</Text>

      {loading ? (
        <ActivityIndicator color="#059669" size="large" style={styles.loadingIndicator} />
      ) : bins.length === 0 ? (
        <Text style={styles.emptyText}>No known bins nearby. Try adding one instead.</Text>
      ) : (
        <View style={styles.binList}>
          {bins.map((bin) => (
            <Pressable
              key={bin.id}
              style={[styles.binRow, selectedBinId === bin.id && styles.binRowSelected]}
              onPress={() => setSelectedBinId(bin.id)}
            >
              <View style={styles.binRowLeft}>
                <View style={[styles.radio, selectedBinId === bin.id && styles.radioSelected]} />
                <View>
                  <Text style={styles.binLabel}>{bin.bin_code || `Bin #${bin.id}`}</Text>
                  <Text style={styles.binDistance}>{formatDistance(bin.distance_meters)}</Text>
                </View>
              </View>
              <Text style={[styles.binStatus, bin.status === 'full' && styles.binStatusFull]}>{bin.status}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {snapshot ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: snapshot.uri }} style={styles.previewImage} />
          <View style={styles.previewFooter}>
            <Text style={styles.previewTitle}>Photo ready</Text>
            <Pressable onPress={handleTakeSnapshot} hitSlop={10}>
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.cameraButton} onPress={handleTakeSnapshot} disabled={openingCamera}>
          {openingCamera ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraText}>Take a photo of the full bin</Text>
            </>
          )}
        </Pressable>
      )}

      <Pressable
        style={[styles.submitButton, (!snapshot || !selectedBinId || submitting) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!snapshot || !selectedBinId || submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Report full</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 },
  backButton: { marginBottom: 12 },
  backText: { color: '#059669', fontWeight: '700', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '900', color: '#065f46' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 },
  loadingIndicator: { marginVertical: 30 },
  emptyText: { fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  binList: { marginBottom: 20 },
  binRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  binRowSelected: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  binRowLeft: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 12 },
  radioSelected: { borderColor: '#059669', backgroundColor: '#059669' },
  binLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  binDistance: { fontSize: 12, color: '#64748b', marginTop: 2 },
  binStatus: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'capitalize' },
  binStatusFull: { color: '#dc2626' },
  cameraButton: { minHeight: 120, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cameraIcon: { fontSize: 32, marginBottom: 6 },
  cameraText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  previewCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 16, backgroundColor: '#ecfdf5' },
  previewImage: { width: '100%', height: 180, backgroundColor: '#cbd5e1' },
  previewFooter: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { color: '#065f46', fontWeight: '800' },
  retakeText: { color: '#059669', fontWeight: '800' },
  submitButton: { backgroundColor: '#065f46', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
});
