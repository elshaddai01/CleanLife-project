import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { binsApi, uploadApi, ApiError } from '../../apiClient';
import { buildDraggablePinMapHtml } from '../../utils/mapHtml';

type Props = {
  onBack: () => void;
  onDone: () => void;
};

// [BIN-22] Works identically whether the caller is logged in or fully
// anonymous — no auth check anywhere in this screen. Camera-only capture,
// same as ActiveJobScreen's disposal snapshot flow: gallery uploads are
// deliberately disabled so the photo is provably taken right now, at this
// location, not picked from an old album.
export default function AddBinScreen({ onBack, onDone }: Props) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [snapshot, setSnapshot] = useState<{ uri: string; base64: string; mimeType: 'image/jpeg' | 'image/png' } | null>(null);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location permission needed', 'Enable location access to place a bin pin.');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(coords);
        setPinPosition(coords);
      } catch (err) {
        Alert.alert('Could not get location', String(err));
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const handleMapMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setPinPosition({ lat: data.lat, lng: data.lng });
      }
    } catch {
      // Ignore malformed messages — pin position just won't update this time.
    }
  };

  const handleTakeSnapshot = async () => {
    setOpeningCamera(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission required', 'Allow camera access to photograph the bin.');
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
    if (!pinPosition) {
      Alert.alert('Location required', 'Wait for the map to load before submitting.');
      return;
    }
    if (!snapshot) {
      Alert.alert('Photo required', 'Take a photo of the bin before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const uploaded = await uploadApi.uploadPublicPhoto(snapshot.base64, snapshot.mimeType);
      const result = await binsApi.addBin({
        latitude: pinPosition.lat,
        longitude: pinPosition.lng,
        photo_url: uploaded.url,
      });

      if (result.created) {
        Alert.alert('Bin added', 'Thanks for reporting this bin!', [{ text: 'OK', onPress: onDone }]);
        return;
      }

      // A bin already exists nearby — offer to confirm it instead rather
      // than silently doing nothing with the photo already uploaded.
      Alert.alert(
        'A bin already exists here',
        'Would you like to confirm it instead?',
        [
          { text: 'Cancel', style: 'cancel', onPress: onDone },
          {
            text: 'Confirm it',
            onPress: async () => {
              try {
                await binsApi.confirmBin(result.bin.id, {
                  latitude: pinPosition.lat,
                  longitude: pinPosition.lng,
                  photo_url: uploaded.url,
                });
                Alert.alert('Bin confirmed', 'Thanks for confirming this bin!', [{ text: 'OK', onPress: onDone }]);
              } catch (err) {
                const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
                Alert.alert('Could not confirm bin', message);
              }
            },
          },
        ]
      );
    } catch (err) {
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert('Submission failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        {locating || !location ? (
          <View style={[StyleSheet.absoluteFillObject, styles.mapPlaceholder]}>
            <ActivityIndicator color="#059669" size="large" />
            <Text style={styles.mapPlaceholderText}>Getting your location…</Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: buildDraggablePinMapHtml(location, '#059669') }}
            style={StyleSheet.absoluteFillObject}
            onMessage={handleMapMessage}
          />
        )}
        <Pressable onPress={onBack} style={styles.floatingBackButton}>
          <Text style={styles.floatingBackText}>← Back</Text>
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Add a bin</Text>
        <Text style={styles.subtitle}>Drag the pin to the exact spot, then take a photo.</Text>

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
                <Text style={styles.cameraText}>Take a photo of the bin</Text>
              </>
            )}
          </Pressable>
        )}

        <Pressable
          style={[styles.submitButton, (!snapshot || !pinPosition || submitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!snapshot || !pinPosition || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  mapArea: { height: '45%' },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  mapPlaceholderText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floatingBackText: { color: '#059669', fontWeight: '700', fontSize: 13 },
  sheet: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#065f46' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 },
  cameraButton: { minHeight: 140, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cameraIcon: { fontSize: 32, marginBottom: 6 },
  cameraText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  previewCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 16, backgroundColor: '#ecfdf5' },
  previewImage: { width: '100%', height: 180, backgroundColor: '#cbd5e1' },
  previewFooter: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { color: '#065f46', fontWeight: '800' },
  retakeText: { color: '#059669', fontWeight: '800' },
  submitButton: { backgroundColor: '#065f46', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 'auto' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
});
