import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { pickupApi, uploadApi, locationApi, ApiError } from '../../apiClient';

type Props = {
  requestId: number;
  onBack: () => void;
  onCompleted: () => void;
  onSessionExpired: () => void;
};

// [LOC-04] Foreground-only, throttled while this screen is open AND a job
// is assigned. Stops the moment the screen unmounts or the job completes —
// never runs as a background service. 20s interval keeps data/battery use
// far under the SRS 5 budgets (50MB/month, 8%/hour) since it only runs for
// the duration of one active job, not continuously.
const LOCATION_UPDATE_INTERVAL_MS = 20000;

export default function ActiveJobScreen({ requestId, onBack, onCompleted, onSessionExpired }: Props) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof pickupApi.getStatus>> | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MOMO' | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ uri: string; base64: string; mimeType: 'image/jpeg' | 'image/png' } | null>(null);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await pickupApi.getStatus(requestId);
      setStatus(result);
      setPaymentMethod(result.payment_method);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      console.warn('status load failed', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, onSessionExpired]);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  // [LOC-05] Send this collector's foreground GPS position periodically
  // while the job is 'assigned', so the client can see them approaching.
  // Stops automatically on unmount (job completed / navigated away).
  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isActive = status?.routing_status === 'assigned';

    async function sendOnce() {
      try {
        const { status: permStatus } = await Location.getForegroundPermissionsAsync();
        if (permStatus !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({});
        await locationApi.updateMyLocation(position.coords.latitude, position.coords.longitude);
        setLocationSharing(true);
      } catch (err) {
        // Non-fatal — a missed location ping shouldn't interrupt the job flow.
        console.warn('location update failed', err);
      }
    }

    if (isActive) {
      void sendOnce();
      locationTimerRef.current = setInterval(sendOnce, LOCATION_UPDATE_INTERVAL_MS);
    }

    return () => {
      if (locationTimerRef.current) {
        clearInterval(locationTimerRef.current);
        locationTimerRef.current = null;
      }
      setLocationSharing(false);
    };
  }, [status?.routing_status]);

  const handleArrive = async () => {
    setBusy('arrive');
    try {
      const result = await pickupApi.arrive(requestId);
      setPaymentMethod(result.payment_method as 'CASH' | 'MOMO');
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert('Could not mark arrival', message);
    } finally {
      setBusy(null);
    }
  };

  const handleCollectCash = async () => {
    setBusy('cash');
    try {
      await pickupApi.collectCash(requestId);
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      Alert.alert('Could not confirm cash', message);
    } finally {
      setBusy(null);
    }
  };

  const handleUseLocation = async () => {
    setLocating(true);
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Location permission needed', 'Enable location access, or use the bin code instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
    } catch (err) {
      Alert.alert('Could not get location', String(err));
    } finally {
      setLocating(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!snapshot) {
      Alert.alert('Snapshot required', 'Take a disposal snapshot before submitting proof.');
      return;
    }
    if (lat == null || lng == null) {
      Alert.alert('GPS location required', 'Capture your current GPS location before completing the job.');
      return;
    }
    setBusy('proof');
    try {
      const uploaded = await uploadApi.uploadProofSnapshot(snapshot.base64, snapshot.mimeType);
      const result = await pickupApi.submitProofOfWork(requestId, {
        photo_storage_url: uploaded.url,
        exif_latitude: lat ?? undefined,
        exif_longitude: lng ?? undefined,
      });
      Alert.alert(
        'Job completed!',
        `Verified via ${result.proof_of_work.verification_method}.\n${
          result.wallet_credit ? `Earned ${result.wallet_credit.new_balance} FCFA total balance.` : ''
        }`
      );
      onCompleted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        Alert.alert('Verification failed', err.message);
      } else {
        const message = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
        Alert.alert('Submission failed', message);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleTakeSnapshot = async () => {
    setOpeningCamera(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission required', 'Allow camera access to photograph the completed disposal.');
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
      if (!asset.base64) throw new Error('The camera did not return image data. Please retake the snapshot.');
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      setSnapshot({ uri: asset.uri, base64: asset.base64, mimeType });
    } catch (err) {
      Alert.alert('Camera error', err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningCamera(false);
    }
  };

  if (loading || !status) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#0891b2" size="large" />
      </View>
    );
  }

  const arrived = !!status.collector_arrived_at;
  const paymentDone = !!status.cash_collected_at || !!status.momo_confirmed_at;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack} style={styles.backButton}>