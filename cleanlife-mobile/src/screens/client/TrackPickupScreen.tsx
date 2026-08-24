import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { pickupApi, locationApi, etaApi, ApiError } from '../../apiClient';

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

// [MAP-01] Fallback map center when no collector position exists yet —
// Yaoundé city center, since the platform operates in Cameroon.
const DEFAULT_CENTER = { lat: 3.848, lng: 11.5021 };

function buildMapHtml(initialLat: number, initialLng: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false })
      .setView([${initialLat}, ${initialLng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var collectorIcon = L.divIcon({
      className: '',
      html: '<div style="background:#0891b2;width:18px;height:18px;border-radius:9px;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
      iconSize: [18, 18],
    });

    var marker = L.marker([${initialLat}, ${initialLng}], { icon: collectorIcon }).addTo(map);

    window.updateCollector = function(lat, lng) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    };
  </script>
</body>
</html>
  `;
}

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

  // [LOC-06] Poll collector's live position only while assigned.
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
          webViewRef.current.injectJavaScript(`window.updateCollector && window.updateCollector(${lat}, ${lng}); true;`);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        // 404 / transient blip — non-fatal, retry next interval.
      }
    };

    void pollLocation();
    const timer = setInterval(pollLocation, LOCATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status?.routing_status, requestId, onSessionExpired]);

  // [ETA-04] Poll real ETA only while assigned. A 404 means location data
  // isn't available yet (collector hasn't sent a first ping) — badge just
  // stays hidden rather than showing a stale/fake number.
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
        // Non-fatal — no ETA yet, badge stays hidden until data exists.
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
    const lat = collectorLocation ? Number(collectorLocation.last_latitude) : DEFAULT_CENTER.lat;
    const lng = collectorLocation ? Number(collectorLocation.last_longitude) : DEFAULT_CENTER.lng;
    return buildMapHtml(lat, lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      { key: 'pickup_complete', label: 'Pickup complete', state: stageOf(paymentDone, arrived && !paymentDone) },
      { key: 'disposal_confirmed', label: 'Disposal confirmed', state: stageOf(completed, disposed && !completed) },
    ];
  };

  const statusLabel = (() => {
    if (!status) return '';
    if (status.routing_status === 'completed') return 'Completed';
    if (status.has_proof_of_work) return 'Disposal submitted';
    if (status.cash_collected_at || status.momo_confirmed_at) return 'Pickup complete';
    if (status.collector_arrived_at) return 'Collector arrived';
    if (status.routing_status === 'assigned') return 'Collector on the way';
    return 'Finding a collector';
  })();

  const showMap = status?.routing_status === 'assigned';

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
          source={{ html: mapHtml }}
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
  statusTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginTop: 6, marginBottom: 14 },
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
