import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';

export type TabKey = 'home' | 'jobs' | 'wallet' | 'profile';

type Tab = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

type Props = {
  activeTab: TabKey;
  jobsLabel?: string;
  onSelect: (tab: TabKey) => void;
};

export default function BottomTabBar({ activeTab, jobsLabel, onSelect }: Props) {
  const { t } = useLanguage();

  const TABS: Tab[] = [
    { key: 'home', label: t('tab_home'), icon: 'home', color: '#d97706' },
    { key: 'jobs', label: t('tab_jobs'), icon: 'clipboard', color: '#1e293b' },
    { key: 'wallet', label: t('tab_wallet'), icon: 'wallet-outline', color: '#1e293b' },
    { key: 'profile', label: t('tab_profile'), icon: 'person-circle', color: '#0891b2' },
  ];

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onSelect(tab.key)}>
            <Ionicons name={tab.icon} size={26} color={isActive ? tab.color : '#94a3b8'} />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.key === 'jobs' && jobsLabel ? jobsLabel : tab.label}
            </Text>
            {isActive && <View style={styles.underline} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    paddingBottom: 10,
  },
  tab: { flex: 1, alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
  labelActive: { color: '#1e293b' },
  underline: {
    marginTop: 4,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#059669',
  },
});