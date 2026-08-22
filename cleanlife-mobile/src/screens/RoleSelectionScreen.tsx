import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

type Props = {
  onSelectRole: (role: 'client' | 'collector') => void;
};

export default function RoleSelectionScreen({ onSelectRole }: Props) {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4', padding: 24, justifyContent: 'center' },
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