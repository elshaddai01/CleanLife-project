import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, securityApi } from '../../apiClient';
import ClientProfileScreen from '../client/ClientProfileScreen';
import CollectorProfileScreen from '../collector/CollectorProfileScreen';
import { useLanguage } from '../../i18n/LanguageContext';

type Props = {
  role: 'client' | 'collector';
  onLogout: () => void;
  onSessionExpired: () => void;
};

type MenuKey = 'menu' | 'profile' | 'language' | 'notifications' | 'security' | 'help' | 'about';

const NOTIF_KEY = 'cleanlife_notification_prefs';

function MenuRow({ icon, title, subtitle, danger, onPress }: {
  icon: string; title: string; subtitle?: string; danger?: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.iconCircle, danger && styles.iconCircleDanger]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {!danger && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.subHeader}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.backArrow}>← Back</Text>
      </Pressable>
      <Text style={styles.subTitle}>{title}</Text>
    </View>
  );
}

export default function SettingsScreen({ role, onLogout, onSessionExpired }: Props) {
  const { t } = useLanguage();
  const [view, setView] = useState<MenuKey>('menu');

  if (view === 'profile') {
    return role === 'client' ? (
      <ClientProfileScreen onBack={() => setView('menu')} onSessionExpired={onSessionExpired} />
    ) : (
      <CollectorProfileScreen onBack={() => setView('menu')} onSessionExpired={onSessionExpired} />
    );
  }

  if (view === 'language') return <LanguageSubScreen onBack={() => setView('menu')} />;
  if (view === 'notifications') return <NotificationsSubScreen onBack={() => setView('menu')} />;
  if (view === 'security') return <SecuritySubScreen onBack={() => setView('menu')} onSessionExpired={onSessionExpired} />;
  if (view === 'help') return <HelpSubScreen onBack={() => setView('menu')} />;
  if (view === 'about') return <AboutSubScreen onBack={() => setView('menu')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('settings_title')}</Text>

      <MenuRow icon="🌐" title={t('settings_language')} subtitle="English" onPress={() => setView('language')} />
      <MenuRow icon="👤" title={t('settings_profile')} onPress={() => setView('profile')} />
      <MenuRow icon="🔔" title={t('settings_notifications')} onPress={() => setView('notifications')} />
      <MenuRow icon="🛡️" title={t('settings_security')} onPress={() => setView('security')} />
      <MenuRow icon="💬" title={t('settings_help')} onPress={() => setView('help')} />
      <MenuRow icon="📄" title={t('settings_about')} onPress={() => setView('about')} />

      <View style={{ height: 20 }} />
      <MenuRow icon="🚫" title={t('settings_logout')} danger onPress={onLogout} />
    </ScrollView>
  );
}

// ---------- Language ----------
// [SETTINGS-01] Real i18n now — uses the shared LanguageContext so the
// choice actually affects the app (tab bar, this menu, role selection).
// Still only covers those screens; most others remain English-only.
function LanguageSubScreen({ onBack }: { onBack: () => void }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.subContainer}>
      <SubScreenHeader title={t('settings_language')} onBack={onBack} />
      <Text style={styles.note}>Only the tab bar, this menu, and the role-selection screen are translated so far.</Text>
      {(['en', 'fr'] as const).map((lang) => (
        <Pressable key={lang} style={styles.optionRow} onPress={() => setLanguage(lang)}>
          <Text style={styles.optionText}>{lang === 'en' ? 'English' : 'Français'}</Text>
          {language === lang && <Text style={styles.checkmark}>✓</Text>}
        </Pressable>
      ))}
    </View>
  );
}

// ---------- Notifications ----------
// [SETTINGS-02] ASSUMPTION FLAGGED: real push delivery now works for 2
// events (job claimed, collector arrived — see pushService.js). These
// toggles are LOCAL PREFERENCES ONLY — they don't yet filter which pushes
// the backend sends, so turning one off won't stop that notification type.
function NotificationsSubScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState({ jobUpdates: true, payments: true, promotions: false });
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((val) => {
      if (val) setPrefs(JSON.parse(val));
      setLoading(false);
    });
  }, []);

  const toggle = async (key: keyof typeof prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#059669" /></View>;

  return (
    <View style={styles.subContainer}>
      <SubScreenHeader title={t('settings_notifications')} onBack={onBack} />
      <Text style={styles.note}>These are saved locally only — they don't yet control which pushes the server sends.</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Job updates</Text>
        <Switch value={prefs.jobUpdates} onValueChange={() => toggle('jobUpdates')} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Payments</Text>
        <Switch value={prefs.payments} onValueChange={() => toggle('payments')} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Promotions</Text>
        <Switch value={prefs.promotions} onValueChange={() => toggle('promotions')} />
      </View>
    </View>
  );
}

// ---------- Account & Security (Change Password) ----------
function SecuritySubScreen({ onBack, onSessionExpired }: { onBack: () => void; onSessionExpired: () => void }) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Re-enter the new password to confirm.');
      return;
    }
    setSubmitting(true);
    try {
      await securityApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Your password has been changed.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.message.includes('current password')) {
        Alert.alert('Incorrect password', 'Your current password is wrong.');
      } else if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
      } else {
        Alert.alert('Failed', err instanceof ApiError ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.subContainer}>
      <SubScreenHeader title={t('settings_security')} onBack={onBack} />
      <Text style={styles.fieldLabel}>Current password</Text>
      <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
      <Text style={styles.fieldLabel}>New password</Text>
      <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <Text style={styles.fieldLabel}>Confirm new password</Text>
      <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <Pressable style={styles.submitButton} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Change password</Text>}
      </Pressable>
    </View>
  );
}

// ---------- Help & Support ----------
function HelpSubScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.subContainer}>
      <SubScreenHeader title={t('settings_help')} onBack={onBack} />
      <Text style={styles.paragraph}>
        Having an issue with a pickup, payment, or your account? Reach the CleanLife team directly:
      </Text>
      <Text style={styles.contactLine}>📧 support@cleanlife.example</Text>
      <Text style={styles.contactLine}>📞 +237 6XX XXX XXX</Text>
      <Text style={styles.note}>Placeholder contact details — replace with your real support channel before launch.</Text>
    </View>
  );
}

// ---------- About / Terms & Privacy ----------
function AboutSubScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <ScrollView contentContainerStyle={styles.subContainer}>
      <SubScreenHeader title={t('settings_about')} onBack={onBack} />
      <Text style={styles.paragraph}>CleanLife — on-demand waste collection for Cameroon. Version 1.0.0.</Text>
      <Text style={styles.legalWarning}>
        ⚠️ PLACEHOLDER — NOT REVIEWED. The text below is illustrative only, not real legal terms. Replace with
        content drafted or reviewed by a qualified professional before this app is publicly released.
      </Text>
      <Text style={styles.paragraph}>
        By using CleanLife, you agree to our terms of service and acknowledge our privacy practices regarding the
        collection, use, and storage of location and account data as described in this app.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, backgroundColor: '#f8fafc', padding: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#1e293b', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconCircleDanger: { backgroundColor: '#fee2e2' },
  iconText: { fontSize: 18 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  rowTitleDanger: { color: '#dc2626' },
  rowSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  chevron: { fontSize: 20, color: '#cbd5e1' },
  subContainer: { flexGrow: 1, backgroundColor: '#f8fafc', padding: 20 },
  subHeader: { marginBottom: 20 },
  backArrow: { color: '#059669', fontWeight: '700', fontSize: 14, marginBottom: 12 },
  subTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  note: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 16 },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionText: { fontSize: 15, color: '#1e293b', fontWeight: '600' },
  checkmark: { fontSize: 18, color: '#059669', fontWeight: '900' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleLabel: { fontSize: 15, color: '#1e293b', fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12 },
  submitButton: { backgroundColor: '#059669', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontWeight: '800' },
  paragraph: { fontSize: 14, color: '#334155', lineHeight: 21, marginBottom: 14 },
  contactLine: { fontSize: 14, color: '#0891b2', fontWeight: '700', marginBottom: 8 },
  legalWarning: {
    fontSize: 12,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
    marginVertical: 14,
    fontWeight: '600',
  },
});