import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

type Props = {
  onSelectRole: (role: 'client' | 'collector') => void;
  onAddBin: () => void;
  onReportFullBin: () => void;
};

export default function RoleSelectionScreen({ onSelectRole, onAddBin, onReportFullBin }: Props) {
  const { t } = useLanguage();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('role_select_title')}</Text>
      <Text style={styles.subtitle}>{t('role_select_subtitle')}</Text>

      <Pressable style={styles.card} onPress={() => onSelectRole('client')}>
        <Text style={styles.cardEmoji}>🏠</Text>
        <Text style={styles.cardTitle}>{t('role_select_client_title')}</Text>
        <Text style={styles.cardText}>{t('role_select_client_text')}</Text>
      </Pressable>

      <Pressable style={[styles.card, styles.cardCollector]} onPress={() => onSelectRole('collector')}>
        <Text style={styles.cardEmoji}>🚲</Text>
        <Text style={styles.cardTitle}>{t('role_select_collector_title')}</Text>
        <Text style={styles.cardText}>{t('role_select_collector_text')}</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('role_select_no_account_needed')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable style={[styles.card, styles.cardBin]} onPress={onReportFullBin}>
        <Text style={styles.cardEmoji}>🗑️</Text>
        <Text style={styles.cardTitle}>{t('role_select_report_full_bin_title')}</Text>
        <Text style={styles.cardText}>{t('role_select_report_full_bin_text')}</Text>
      </Pressable>

      <Pressable style={[styles.card, styles.cardBin]} onPress={onAddBin}>
        <Text style={styles.cardEmoji}>📍</Text>
        <Text style={styles.cardTitle}>{t('role_select_add_bin_title')}</Text>
        <Text style={styles.cardText}>{t('role_select_add_bin_text')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f0fdf4', padding: 24, justifyContent: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#a7f3d0' },
  dividerText: { marginHorizontal: 12, fontSize: 12, fontWeight: '700', color: '#65a892' },
  cardBin: { borderColor: '#65a892', borderStyle: 'dashed' },
  title: { fontSize: 26, fontWeight: '900', color: '#065f46', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 6, marginBottom: 28 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#059669',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardCollector: { borderColor: '#0891b2' },
  cardEmoji: { fontSize: 34, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#64748b' },
});