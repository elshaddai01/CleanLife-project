
import { request } from '../apiClient';

export const etaApi = {
    updateLocation(requestId: number, latitude: number, longitude: number) {
        return request<{
            success: boolean;
            collector_location: {
                latitude: number;
                longitude: number;
                updated_at: string;
            };
            eta: {
                seconds: number;
                formatted: string;
                distance_km: string;
            };
        }>(`/eta/${requestId}/update-location`, {
            method: 'POST',
            body: JSON.stringify({ latitude, longitude }),
        });
    },

    /**
     * Get current ETA for a pickup request
     */
    getETA(requestId: number) {
        return request<{
            pickup_request_id: number;
            eta_seconds: number;
            formatted_eta: string;
            last_updated: string;
        }>(`/eta/${requestId}`, {
            method: 'GET',
        });
    },
    getETAHistory(requestId: number, limit?: number) {
        return request<{
            history: Array<{
                id: number;
                eta_seconds: number;
                distance_meters: number;
                speed_kmh: number;
                calculated_at: string;
            }>;
        }>(`/eta/${requestId}/history?limit=${limit || 50}`, {
            method: 'GET',
        });
    },
};
