// src/apiClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import type { PickupStatus, WasteType, VehicleType } from './types';

// ============ CONFIGURATION ============
function getApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const apiPort = process.env.EXPO_PUBLIC_API_PORT?.trim() || '3001';

  if (__DEV__) {
    const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
    if (scriptUrl) {
      try {
        const metroHost = new URL(scriptUrl).hostname;
        const isLoopback = metroHost === 'localhost' || metroHost === '127.0.0.1' || metroHost === '::1';
        if (metroHost && !isLoopback) return `http://${metroHost}:${apiPort}`;
      } catch {
        // Fall through
      }
    }
  }

  if (configuredUrl) return configuredUrl.replace(/\/$/, '');
  return Platform.OS === 'android' ? `http://10.0.2.2:${apiPort}` : `http://localhost:${apiPort}`;
}

export const API_BASE = getApiBaseUrl();

// ============ STORAGE KEYS ============
const TOKEN_KEY = 'cleanlife_auth_token';
const REFRESH_TOKEN_KEY = 'cleanlife_refresh_token';
const ROLE_KEY = 'cleanlife_auth_role';
const USER_ID_KEY = 'cleanlife_auth_user_id';
const USER_KEY = 'cleanlife_auth_user';

// ============ STORAGE HELPERS ============
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function getStoredRole(): Promise<'client' | 'collector' | null> {
  return AsyncStorage.getItem(ROLE_KEY) as Promise<'client' | 'collector' | null>;
}

export async function getStoredUserId(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(USER_ID_KEY);
  return raw ? Number(raw) : null;
}

export async function getStoredUser(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setSession(
  token: string,
  role: 'client' | 'collector',
  userId: number,
  user?: any,
  refreshToken?: string
) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(ROLE_KEY, role);
  await AsyncStorage.setItem(USER_ID_KEY, String(userId));
  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (user) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, ROLE_KEY, USER_ID_KEY, USER_KEY]);
}

// ============ ERROR HANDLING ============
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

// ============ REFRESH TOKEN ============
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await clearSession();
      return null;
    }

    const data = await response.json();
    if (data.access_token) {
      await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

// ============ API REQUEST ============
async function request<T>(path: string, options: RequestInit = {}, requireAuth: boolean = true): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (requireAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, `Cannot reach the CleanLife server at ${API_BASE}. Check the server address and Wi-Fi connection.`);
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    // Handle token expiration with a single silent retry via refresh token.
    if (res.status === 401 && body?.code === 'TOKEN_EXPIRED') {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
        const retryBody = retryRes.headers.get('content-type')?.includes('application/json')
          ? await retryRes.json()
          : null;
        if (retryRes.ok) {
          return retryBody as T;
        }
      }
      throw new ApiError(401, 'Session expired. Please login again.', 'TOKEN_EXPIRED');
    }

    const message = (body && (body.error || body.message)) || `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, body?.code);
  }
  return body as T;
}

// ============ AUTH TYPES ============
export interface User {
  id: number;
  username: string;
  role: 'client' | 'collector' | 'admin';
  company_id: number | null;
  name?: string;
  phone_number?: string;
  collector_type?: 'corporate' | 'independent';
  subscription_tier?: 'Premium' | 'Gold' | 'Silver' | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  tokens: AuthTokens;
  redirect_to: string;
}

// ---------- Auth ----------

export interface ClientAuthResult {
  token: string;
  client: { id: number; name: string; phone_number: string; company_id: number | null };
}

export interface CollectorAuthResult {
  token: string;
  collector: {
    id: number;
    username: string;
    collector_type: 'corporate' | 'independent';
    company_id: number | null;
    subscription_tier: 'Premium' | 'Gold' | 'Silver' | null;
  };
}

export const authApi = {
  registerClient(params: {
    name: string;
    email: string;
    phone_number: string;
    password: string;
    company_code?: string
  }) {
    return request<{ id: number; name: string; phone_number: string; company_id: number | null; company_name: string | null; created_at: string }>(
      '/clients/register',
      { method: 'POST', body: JSON.stringify(params) },
      false
    );
  },

  // Unified backend login (/auth/login), reshaped to the {token, client}
  // format the rest of the app (AuthScreen.tsx, App.tsx) expects.
  loginClient(phone_number: string, password: string) {
    return request<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ phone_number, password }) },
      false
    ).then((res): ClientAuthResult => ({
      token: res.tokens.access_token,
      client: {
        id: res.user.id,
        name: res.user.name || '',
        phone_number: res.user.phone_number || '',
        company_id: res.user.company_id,
      },
    }));
  },

  registerCollector(params: {
    username: string;
    password: string;
    name?: string;
    email?: string;
    phone_number?: string;
    subscription_tier?: 'Premium' | 'Gold' | 'Silver'
  }) {
    return request<{
      id: number;
      username: string;
      collector_type: string;
      company_id: number | null;
      subscription_tier: string;
      full_name: string | null;
      email: string | null;
      phone_number: string | null;
      created_at: string
    }>(
      '/collectors/register',
      { method: 'POST', body: JSON.stringify(params) },
      false
    );
  },

  loginCollector(username: string, password: string) {
    return request<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      false
    ).then((res): CollectorAuthResult => ({
      token: res.tokens.access_token,
      collector: {
        id: res.user.id,
        username: res.user.username,
        collector_type: res.user.collector_type as 'corporate' | 'independent',
        company_id: res.user.company_id,
        subscription_tier: res.user.subscription_tier as 'Premium' | 'Gold' | 'Silver' | null,
      },
    }));
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me', { method: 'GET' });
  },

  async logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/logout', { method: 'POST' });
  },
};

// ---------- Pickup Requests ----------

export interface BackendPickupRequest {
  id: number;
  client_id: number;
  collector_id?: number | null;
  bag_count: number;
  waste_type: WasteType;
  mobility_type_id: number | null;
  routing_status: 'searching_corporate' | 'admin_hold' | 'broadcast_public' | 'assigned' | 'completed';
  admin_hold_expires_at: string | null;
  current_stage_rank: number;
  payment_method: 'CASH' | 'MOMO';
  payment_status: 'PENDING_COMPLETION' | 'COMPLETED' | 'FAILED';
  estimated_price_fcfa: number | null;
  collector_arrived_at?: string | null;
  cash_collected_at?: string | null;
  momo_requested_at?: string | null;
  momo_confirmed_at?: string | null;
  mobility_type?: string;
  nearest_dumpster_id?: number | null;
  nearest_dumpster_distance_meters?: number | null;
  created_at: string;
}

export function deriveStatus(pr: BackendPickupRequest, hasProofOfWork: boolean): PickupStatus {
  if (pr.routing_status === 'completed') return 'disposal_confirmed';
  if (hasProofOfWork) return 'disposal_submitted';
  if (pr.cash_collected_at || pr.momo_confirmed_at) return 'pickup_complete';
  if (pr.collector_arrived_at) return 'arrived';
  if (pr.routing_status === 'assigned') return 'on_the_way';
  if (pr.routing_status === 'broadcast_public') return 'broadcast_public';
  if (pr.routing_status === 'searching_corporate') return 'admin_hold';
  return 'pending';
}

export const pickupApi = {
  create(params: {
    client_id: number;
    bag_count: number;
    waste_type: WasteType;
    latitude: number;
    longitude: number;
    payment_method: 'CASH' | 'MOMO';
  }) {
    return request<BackendPickupRequest & { mobility_type: string; nearest_dumpster_id: number | null; nearest_dumpster_distance_meters: number | null }>(
      '/pickup-requests',
      { method: 'POST', body: JSON.stringify(params) }
    );
  },

  listAvailable() {
    return request<BackendPickupRequest[]>('/pickup-requests/available');
  },

  listMine() {
    return request<BackendPickupRequest[]>('/pickup-requests/mine');
  },

  listActive() {
    return request<BackendPickupRequest[]>('/pickup-requests/active');
  },

  claim(requestId: number) {
    return request<{ id: number; routing_status: string; collector_id: number }>(
      `/pickup-requests/${requestId}/claim`,
      { method: 'POST' }
    );
  },

  arrive(requestId: number) {
    return request<{ id: number; payment_method: string; collector_arrived_at: string; momo_requested_at: string | null }>(
      `/pickup-requests/${requestId}/arrive`,
      { method: 'POST' }
    );
  },

  collectCash(requestId: number) {
    return request<{ id: number; cash_collected_at: string }>(
      `/pickup-requests/${requestId}/collect-cash`,
      { method: 'POST' }
    );
  },

  submitProofOfWork(requestId: number, params: { photo_storage_url: string; exif_latitude?: number; exif_longitude?: number; bin_code?: string }) {
    return request<{
      proof_of_work: { id: number; is_verified: boolean; verification_method: string; dumpster_id: number | null };
      pickup_request: { id: number; routing_status: string; payment_status: string; estimated_price_fcfa: number };
      wallet_credit: { id: number; new_balance: string } | null;
    }>(`/pickup-requests/${requestId}/proof-of-work`, { method: 'POST', body: JSON.stringify(params) });
  },

  // [TRACK-01] Read-only status check — see backend migration 019.
  getStatus(requestId: number) {
    return request<{
      id: number;
      routing_status: BackendPickupRequest['routing_status'];
      collector_id: number | null;
      payment_method: 'CASH' | 'MOMO';
      payment_status: BackendPickupRequest['payment_status'];
      collector_arrived_at: string | null;
      cash_collected_at: string | null;
      momo_confirmed_at: string | null;
      has_proof_of_work: boolean;
    }>(`/pickup-requests/${requestId}`);
  },
};

// ---------- Wallet ----------

export const walletApi = {
  getBalance() {
    return request<{ balance: string }>('/wallet/balance');
  },
  getTransactions() {
    return request<Array<{
      id: number;
      type: 'pickup_payment' | 'job_earnings' | 'withdraw' | 'top_up' | 'referral_bonus';
      amount: string;
      currency: string;
      status: string;
      description: string;
      reference_pickup_request_id: number | null;
      created_at: string;
    }>>('/wallet/transactions');
  },
  topup(amount: number, description?: string) {
    return request<{ id: number; new_balance: string }>('/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  },
  withdraw(amount: number, description?: string) {
    return request<{ id: number; new_balance: string }>('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  },
};

// ---------- KYC ----------

export const kycApi = {
  submit(collectorId: number, document_url: string, document_name?: string) {
    return request<{ id: number; kyc_status: string; kyc_submitted_at: string }>(
      `/collectors/${collectorId}/kyc`,
      { method: 'POST', body: JSON.stringify({ document_url, document_name }) }
    );
  },
  getCollectorProfile() {
    return request<{
      id: number;
      username: string;
      collector_type: 'corporate' | 'independent';
      subscription_tier: 'Premium' | 'Gold' | 'Silver' | null;
      kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
      kyc_document_name: string | null;
      kyc_submitted_at: string | null;
    }>('/collectors/me');
  },
};

export const telemetryApi = {
  heartbeat(area_id: string) {
    return request<{ id: number; current_area_id: string; last_heartbeat_at: string }>('/telemetry/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ area_id }),
    });
  },

  updateLocation(latitude: number, longitude: number) {
  return request<{
    id: number;
    current_latitude: number;
    current_longitude: number;
    location_updated_at: string;
  }>('/telemetry/location', {
    method: 'POST',
    body: JSON.stringify({
      latitude,
      longitude,
    }),
  });
},
};

export const uploadApi = {
  uploadProofSnapshot(base64: string, mime_type: 'image/jpeg' | 'image/png') {
    return request<{ url: string }>('/uploads/proof', {
      method: 'POST',
      body: JSON.stringify({ base64, mime_type }),
    });
  },
};

// ---------- Profile ----------

export const profileApi = {
  getMe() {
    return request<{ user: any }>('/auth/me');
  },
  updateClient(clientId: number, params: { name?: string; email?: string }) {
    return request<{ id: number; name: string; email: string; phone_number: string; company_id: number | null }>(
      `/clients/${clientId}/profile`,
      { method: 'PUT', body: JSON.stringify(params) }
    );
  },
  updateCollector(params: { name?: string; email?: string; phone_number?: string }) {
    return request<{
      id: number;
      username: string;
      full_name: string | null;
      email: string | null;
      phone_number: string | null;
      collector_type: string;
      subscription_tier: string | null;
    }>('/collectors/me/profile', { method: 'PUT', body: JSON.stringify(params) });
  },
};

// ---------- Live Location ----------

export const locationApi = {
  updateMyLocation(latitude: number, longitude: number) {
    return request<{ id: number; last_latitude: string; last_longitude: string; last_location_at: string }>(
      '/telemetry/location',
      { method: 'POST', body: JSON.stringify({ latitude, longitude }) }
    );
  },
  getCollectorLocation(requestId: number) {
    return request<{ collector_id: number; last_latitude: string; last_longitude: string; last_location_at: string }>(
      `/pickup-requests/${requestId}/collector-location`
    );
  },
};