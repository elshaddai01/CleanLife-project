// cleanlife-mobile/src/components/client/ETADisplay.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { etaApi } from '../../api/etaApi';
import { ApiError } from '../../apiClient';

type Props = {
    requestId: number;
    onSessionExpired?: () => void;
};

export default function ETADisplay({ requestId, onSessionExpired }: Props) {
    const [eta, setEta] = useState<{
        seconds: number;
        formatted: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadETA = useCallback(async () => {
        try {
            const result = await etaApi.getETA(requestId);
            setEta({
                seconds: result.eta_seconds,
                formatted: result.formatted_eta,
            });
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                onSessionExpired?.();
                return;
            }
            setError(err instanceof ApiError ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [requestId, onSessionExpired]);

    useEffect(() => {
        loadETA();
        const interval = setInterval(loadETA, 30000);
        return () => clearInterval(interval);
    }, [loadETA]);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator color="#059669" />
                <Text style={styles.loadingText}>Calculating ETA...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Unable to calculate ETA</Text>
                <Text style={styles.errorSubtext}>{error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.etaCard}>
                <Text style={styles.etaLabel}>Estimated Arrival</Text>
                <Text style={styles.etaValue}>{eta?.formatted || '--'}</Text>
                <View style={styles.detailsRow}>
                    <View style={styles.statusDot}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>Live</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    etaCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    etaLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 4,
    },
    etaValue: {
        fontSize: 32,
        fontWeight: '900',
        color: '#059669',
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    statusDot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22c55e',
    },
    liveText: {
        fontSize: 12,
        color: '#22c55e',
        fontWeight: '700',
    },
    loadingText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#dc2626',
        fontWeight: '600',
        textAlign: 'center',
    },
    errorSubtext: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },
});