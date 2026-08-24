import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getToken, getStoredRole, clearSession } from './src/apiClient';
import BottomTabBar, { TabKey } from './src/components/BottomTabBar';

import SplashScreen from './src/screens/SplashScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import AuthScreen from './src/screens/AuthScreen';

import ClientHomeScreen from './src/screens/client/ClientHomeScreen';
import RequestPickupScreen from './src/screens/client/RequestPickupScreen';
import TrackPickupScreen from './src/screens/client/TrackPickupScreen';
import MyRequestsScreen from './src/screens/client/MyRequestsScreen';
import ReportDumpingScreen from './src/screens/client/ReportDumpingScreen';

import CollectorHomeScreen from './src/screens/collector/CollectorHomeScreen';
import AvailableJobsScreen from './src/screens/collector/AvailableJobsScreen';
import ActiveJobScreen from './src/screens/collector/ActiveJobScreen';

import WalletScreen from './src/screens/shared/WalletScreen';
import SettingsScreen from './src/screens/shared/SettingsScreen';

import { LanguageProvider } from './src/i18n/LanguageContext';

type Phase = 'checking' | 'splash' | 'role_select' | 'auth' | 'client_app' | 'collector_app';

// 'profile' now renders SettingsScreen (hub) instead of the profile
// screens directly — those live inside SettingsScreen to avoid duplication.
type ClientScreen = 'home' | 'request' | 'requests' | 'track' | 'wallet' | 'profile' | 'report';
type CollectorScreen = 'home' | 'jobs' | 'active_job' | 'wallet' | 'profile';

  const CLIENT_SCREENS_WITHOUT_TAB_BAR: ClientScreen[] = ['track', 'request', 'report'];
const COLLECTOR_SCREENS_WITHOUT_TAB_BAR: CollectorScreen[] = ['active_job'];

export default function App() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [role, setRole] = useState<'client' | 'collector'>('client');

  const [clientScreen, setClientScreen] = useState<ClientScreen>('home');
  const [lastRequestId, setLastRequestId] = useState<number | null>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null);

  const [collectorScreen, setCollectorScreen] = useState<CollectorScreen>('home');
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const storedRole = await getStoredRole();
      if (token && storedRole) {
        setRole(storedRole);
        setPhase(storedRole === 'client' ? 'client_app' : 'collector_app');
      } else {
        setPhase('splash');
      }
    })();
  }, []);

  const handleSessionExpired = useCallback(async () => {
    await clearSession();
    setPhase('role_select');
    setClientScreen('home');
    setCollectorScreen('home');
  }, []);

  const handleLogout = useCallback(async () => {
    setPhase('role_select');
    setRole('client');
    setClientScreen('home');
    setCollectorScreen('home');
    setLastRequestId(null);
    setTrackingId(null);
    setActiveJobId(null);
    try {
      await clearSession();
    } catch (error) {
      console.error('Could not clear the persisted session:', error);
    }
  }, []);

  const handleRecentRequest = useCallback((id: number) => setLastRequestId(id), []);

  const handleClientTabSelect = useCallback((tab: TabKey) => {
    if (tab === 'home') setClientScreen('home');
    else if (tab === 'jobs') setClientScreen('requests');
    else if (tab === 'wallet') setClientScreen('wallet');
    else if (tab === 'profile') setClientScreen('profile');
  }, []);

  const handleCollectorTabSelect = useCallback((tab: TabKey) => {
    if (tab === 'home') setCollectorScreen('home');
    else if (tab === 'jobs') setCollectorScreen('jobs');
    else if (tab === 'wallet') setCollectorScreen('wallet');
    else if (tab === 'profile') setCollectorScreen('profile');
  }, []);

  const clientActiveTab: TabKey =
    clientScreen === 'requests' ? 'jobs' : clientScreen === 'wallet' ? 'wallet' : clientScreen === 'profile' ? 'profile' : 'home';
  const collectorActiveTab: TabKey =
    collectorScreen === 'jobs' ? 'jobs' : collectorScreen === 'wallet' ? 'wallet' : collectorScreen === 'profile' ? 'profile' : 'home';

  if (phase === 'checking') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const showClientTabBar = phase === 'client_app' && !CLIENT_SCREENS_WITHOUT_TAB_BAR.includes(clientScreen);
  const showCollectorTabBar = phase === 'collector_app' && !COLLECTOR_SCREENS_WITHOUT_TAB_BAR.includes(collectorScreen);

  return (
    <LanguageProvider>
    <SafeAreaProvider>
      <StatusBar style={phase === 'splash' ? 'light' : 'dark'} />
      <SafeAreaView
        style={[
          styles.safeArea,
          phase === 'splash' && styles.safeAreaSplash,
          phase === 'role_select' && styles.safeAreaRoleSelection,
        ]}
        edges={['top', 'right', 'bottom', 'left']}
      >
        <View style={styles.content}>
          {phase === 'splash' && <SplashScreen onFinished={() => setPhase('role_select')} />}

          {phase === 'role_select' && (
            <RoleSelectionScreen
              onSelectRole={(r) => {
                setRole(r);
                setPhase('auth');
              }}
            />
          )}

          {phase === 'auth' && (
            <AuthScreen
              initialRole={role}
              onBack={() => setPhase('role_select')}
              onAuthenticated={(r) => {
                setRole(r);
                setPhase(r === 'client' ? 'client_app' : 'collector_app');
              }}
            />
          )}

          {/* ---------- CLIENT APP ---------- */}
          {phase === 'client_app' && clientScreen === 'home' && (
            <ClientHomeScreen
              lastRequestId={lastRequestId}
              onRequestPickup={() => setClientScreen('request')}
              onOpenWallet={() => setClientScreen('wallet')}
              onViewRequests={() => setClientScreen('requests')}
              onOpenTracking={(id) => {
                setTrackingId(id);
                setClientScreen('track');
              }}
              onOpenProfile={() => setClientScreen('profile')}
              onReportDumping={() => setClientScreen('report')}
              onLogout={handleLogout}
              onRecentRequest={handleRecentRequest}
            />
          )}
          {phase === 'client_app' && clientScreen === 'request' && (
            <RequestPickupScreen
              onBack={() => setClientScreen('home')}
              onCreated={(id) => {
                setLastRequestId(id);
                setTrackingId(id);
                setClientScreen('track');
              }}
            />
          )}
          {phase === 'client_app' && clientScreen === 'report' && (
            <ReportDumpingScreen onBack={() => setClientScreen('home')} />
          )}
          {phase === 'client_app' && clientScreen === 'track' && trackingId && (
            <TrackPickupScreen
              requestId={trackingId}
              onBack={() => setClientScreen('home')}
              onSessionExpired={handleSessionExpired}
            />
          )}
          {phase === 'client_app' && clientScreen === 'wallet' && (
            <WalletScreen role="client" onBack={() => setClientScreen('home')} onSessionExpired={handleSessionExpired} />
          )}
          {phase === 'client_app' && clientScreen === 'profile' && (
            <SettingsScreen role="client" onLogout={handleLogout} onSessionExpired={handleSessionExpired} />
          )}
          {phase === 'client_app' && clientScreen === 'requests' && (
            <MyRequestsScreen
              onBack={() => setClientScreen('home')}
              onSessionExpired={handleSessionExpired}
              onOpenRequest={(id) => {
                setTrackingId(id);
                setClientScreen('track');
              }}
            />
          )}

          {/* ---------- COLLECTOR APP ---------- */}
          {phase === 'collector_app' && collectorScreen === 'home' && (
            <CollectorHomeScreen
              onViewJobs={() => setCollectorScreen('jobs')}
              onOpenWallet={() => setCollectorScreen('wallet')}
              onLogout={handleLogout}
              onOpenProfile={() => setCollectorScreen('profile')}
              onResumeJob={(id) => {
                setActiveJobId(id);
                setCollectorScreen('active_job');
              }}
            />
          )}
          {phase === 'collector_app' && collectorScreen === 'jobs' && (
            <AvailableJobsScreen
              onBack={() => setCollectorScreen('home')}
              onSessionExpired={handleSessionExpired}
              onJobClaimed={(id) => {
                setActiveJobId(id);
                setCollectorScreen('active_job');
              }}
            />
          )}
          {phase === 'collector_app' && collectorScreen === 'active_job' && activeJobId && (
            <ActiveJobScreen
              requestId={activeJobId}
              onBack={() => setCollectorScreen('jobs')}
              onSessionExpired={handleSessionExpired}
              onCompleted={() => {
                setActiveJobId(null);
                setCollectorScreen('home');
              }}
            />
          )}
          {phase === 'collector_app' && collectorScreen === 'wallet' && (
            <WalletScreen role="collector" onBack={() => setCollectorScreen('home')} onSessionExpired={handleSessionExpired} />
          )}
          {phase === 'collector_app' && collectorScreen === 'profile' && (
            <SettingsScreen role="collector" onLogout={handleLogout} onSessionExpired={handleSessionExpired} />
          )}
        </View>

        {showClientTabBar && <BottomTabBar activeTab={clientActiveTab} jobsLabel="Requests" onSelect={handleClientTabSelect} />}
        {showCollectorTabBar && <BottomTabBar activeTab={collectorActiveTab} onSelect={handleCollectorTabSelect} />}
      </SafeAreaView>
    </SafeAreaProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  safeAreaSplash: { backgroundColor: '#059669' },
  safeAreaRoleSelection: { backgroundColor: '#f0fdf4' },
  content: { flex: 1 },
});