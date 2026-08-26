import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Linking, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { pickupApi, locationApi, etaApi, ApiError } from '../../apiClient';
import { buildTrackingMapHtml } from '../../utils/mapHtml';

type Props = {
  requestId: number;
  onBack: () => void;
  onSessionExpired: () => void;
};

type Stage = {
  key: string;
  label: string;
  state: 'done' | 'current' | 'pending';
};

type CollectorLocation = {
  collector_id: number;
  last_latitude: string;
  last_longitude: string;
  last_location_at: string;
};

const POLL_INTERVAL_MS = 5000;
const LOCATION_POLL_INTERVAL_MS = 8000;
const ETA_POLL_INTERVAL_MS = 15000;

function formatEta(seconds: number): string {
  if (seconds < 60) return '<1 min';
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export default function TrackPickupScreen({ requestId, onBack, onSessionExpired }: Props) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof pickupApi.getStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectorLocation, setCollectorLocation] = useState<CollectorLocation | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const mapReadyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const result = await pickupApi.getStatus(requestId);
      setStatus(result);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setError(err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err));
    } finally {
      setLoading(false);
    }
  }, [requestId, onSessionExpired]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (status?.routing_status !== 'assigned') {
      setCollectorLocation(null);
      mapReadyRef.current = false;
      return;
    }

    let cancelled = false;

    const pollLocation = async () => {
      try {
        const result = await locationApi.getCollectorLocation(requestId);
        if (cancelled) return;
        setCollectorLocation(result);

        const lat = Number(result.last_latitude);
        const lng = Number(result.last_longitude);
        if (mapReadyRef.current && webViewRef.current) {
          webViewRef.current.injectJavaScript(`window.updateMover && window.updateMover(${lat}, ${lng}); true;`);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
      }
    };

    void pollLocation();
    const timer = setInterval(pollLocation, LOCATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status?.routing_status, requestId, onSessionExpired]);

  useEffect(() => {
    if (status?.routing_status !== 'assigned') {
      setEtaSeconds(null);
      return;
    }

    let cancelled = false;

    const pollEta = async () => {
      try {
        const result = await etaApi.getEta(requestId);
        if (!cancelled) setEtaSeconds(result.eta_seconds);
      } catch {
        // No ETA yet — badge stays hidden.
      }
    };

    void pollEta();
    const timer = setInterval(pollEta, ETA_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status?.routing_status, requestId]);

  const mapHtml = useMemo(() => {
    if (!status?.client_latitude || !status?.client_longitude) return null;
    const destination = { lat: Number(status.client_latitude), lng: Number(status.client_longitude) };
    const mover = collectorLocation
      ? { lat: Number(collectorLocation.last_latitude), lng: Number(collectorLocation.last_longitude) }
      : destination;
    return buildTrackingMapHtml(destination, mover, '#0891b2');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.client_latitude, status?.client_longitude]);

  // [MOMO-07] Handles all 3 real outcomes from the backend now that this
  // checks the actual pawaPay transaction status, not a demo instant
  // confirmation: completed (success), still pending (202 — ask the
  // client to wait), or failed/rejected (422 — payment genuinely didn't
  // go through, they may need to retry from their MoMo app).
  const handleValidatePayment = async () => {
    setConfirmingPayment(true);
    try {
      const result: any = await pickupApi.confirmPayment(requestId);
      await load();
      if (result?.status === 'completed') {
        Alert.alert('Payment confirmed', 'Your collector has been notified and can now proceed.');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSessionExpired();
      if (err instanceof ApiError && err.status === 202) {
        Alert.alert('Still processing', 'Your payment is still being processed by MoMo. Please wait a moment and try again.');
      } else if (err instanceof ApiError && err.status === 422) {
        Alert.alert('Payment failed', 'The payment did not go through. Please try sending it again from your MoMo app, then tap Validate Payment again.');
      } else {
        Alert.alert('Could not confirm payment', err instanceof ApiError ? err.message : String(err));
      }
    } finally {
      setConfirmingPayment(false);
    }
  };

  const buildStages = (): Stage[] => {
    if (!status) return [];
    const arrived = !!status.collector_arrived_at;
    const paymentDone = !!status.cash_collected_at || !!status.momo_confirmed_at;
    const disposed = status.has_proof_of_work;
    const completed = status.routing_status === 'completed';
    const assigned = status.routing_status === 'assigned' || arrived || paymentDone || disposed || completed;

    const stageOf = (done: boolean, isCurrent: boolean): Stage['state'] =>
      done ? 'done' : isCurrent ? 'current' : 'pending';

    return [
      { key: 'posted', label: 'Job Posted', state: 'done' },
      { key: 'accepted', label: 'Collector accepted', state: stageOf(assigned, !assigned) },
      { key: 'on_the_way', label: 'Collector on the way', state: stageOf(arrived, assigned && !arrived) },
      { key: 'payment', label: 'Payment confirmed', state: stageOf(paymentDone, arrived && !paymentDone) },
      { key: 'disposal_confirmed', label: 'Disposal confirmed', state: stageOf(completed, disposed && !completed) },
    ];
  };

  const statusLabel = (() => {
    if (!status) return '';
    if (status.routing_status === 'completed') return 'Completed';
    if (status.has_proof_of_work) return 'Disposal submitted';
    if (status.cash_collected_at || status.momo_confirmed_at) return 'Payment confirmed — collector proceeding';
    if (status.collector_arrived_at && status.payment_method === 'MOMO') return 'Awaiting your payment confirmation';
    if (status.collector_arrived_at) return 'Collector arrived';
    if (status.routing_status === 'assigned') return 'Collector on the way';
    return 'Finding a collector';
  })();

  const showMap = status?.routing_status === 'assigned' && mapHtml;
  const needsPaymentValidation =
    status?.routing_status === 'assigned' &&
    status?.payment_method === 'MOMO' &&
    !!status?.collector_arrived_at &&
    !status?.momo_confirmed_at;

  if (loading || !status) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#059669" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showMap ? (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml as string }}
          style={styles.map}
          onLoadEnd={() => {
            mapReadyRef.current = true;
          }}
        />
      ) : (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <Text style={styles.mapPlaceholderText}>Map appears once a collector is on the way</Text>
        </View>
      )}

      <Pressable onPress={onBack} style={styles.floatingBackButton}>
        <Text style={styles.floatingBackText}>← Back</Text>
      </Pressable>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.requestId}>#CL-{requestId}</Text>
          {etaSeconds !== null && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaBadgeText}>⏱ {formatEta(etaSeconds)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.statusTitle}>{statusLabel}</Text>

        {status.collector_id && (
          <View style={styles.collectorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.collectorName}>
                {status.collector_full_name || `Collector #${status.collector_id}`}
              </Text>
              {status.collector_phone_number ? (
                <Pressable onPress={() => Linking.openURL(`tel:${status.collector_phone_number}`)}>
                  <Text style={styles.collectorPhone}>{status.collector_phone_number}</Text>
                </Pressable>
              ) : (
                <Text style={styles.collectorPhoneMissing}>Phone number not on file</Text>
              )}
            </View>
          </View>
        )}

        {needsPaymentValidation && (
          <View style={styles.paymentPrompt}>
            <Text style={styles.paymentPromptText}>
              A payment request was sent to your phone. Enter your MoMo PIN there, then tap below to confirm.
            </Text>
            <Pressable
              style={styles.validateButton}
              onPress={handleValidatePayment}
              disabled={confirmingPayment}
            >
              {confirmingPayment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.validateButtonText}>Validate Payment</Text>
              )}
            </Pressable>
          </View>
        )}

        <Pressable style={styles.detailsButton} onPress={() => setDetailsExpanded((v) => !v)}>
          <Text style={styles.detailsButtonText}>{detailsExpanded ? 'Hide details' : 'View details'}</Text>
        </Pressable>
      </View>

      {detailsExpanded && (
        <View style={styles.stageSheet}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {buildStages().map((stage) => (
            <View key={stage.key} style={styles.stageRow}>
              <View
                style={[
                  styles.stageIcon,
                  stage.state === 'done' && styles.stageIconDone,
                  stage.state === 'current' && styles.stageIconCurrent,
                ]}
              >
                <Text style={styles.stageIconText}>
                  {stage.state === 'done' ? '✓' : stage.state === 'current' ? '→' : ''}
                </Text>
              </View>
              <Text style={[styles.stageText, stage.state !== 'pending' && styles.stageTextActive]}>
                {stage.label}
              </Text>
            </View>
          ))}
          <Text style={styles.paymentStatus}>
            Payment: {status.payment_status === 'COMPLETED' ? 'Released ✅' : 'Pending completion'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', paddingHorizontal: 40 },
  mapPlaceholderText: { color: '#64748b', fontSize: 13, textAlign: 'center' },
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
  card: {
    position: 'absolute',
    top: 96,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestId: { color: '#475569', fontWeight: '700', fontSize: 14 },
  etaBadge: { backgroundColor: '#dbeafe', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  etaBadgeText: { color: '#1d4ed8', fontWeight: '800', fontSize: 13 },
  statusTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginTop: 6, marginBottom: 14 },
  collectorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18 },
  collectorName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  collectorPhone: { fontSize: 13, color: '#0891b2', fontWeight: '700', marginTop: 2 },
  collectorPhoneMissing: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 },
  paymentPrompt: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  paymentPromptText: { fontSize: 13, color: '#92400e', fontWeight: '600', marginBottom: 10 },
  validateButton: { backgroundColor: '#d97706', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  validateButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  detailsButton: {
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsButtonText: { color: '#059669', fontWeight: '800', fontSize: 14 },
  stageSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  errorText: { color: '#dc2626', marginBottom: 10 },
  stageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stageIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stageIconDone: { backgroundColor: '#059669', borderColor: '#059669' },
  stageIconCurrent: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  stageIconText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  stageText: { fontSize: 15, color: '#94a3b8' },
  stageTextActive: { color: '#1e293b', fontWeight: '700' },
  paymentStatus: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#1e293b' },
});