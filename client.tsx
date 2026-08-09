import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function ClientLoginScreen(): React.JSX.Element {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');

  const handleLogin = (): void => {
    console.log('Logging into Client Portal:', { phoneNumber, pinCode });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <View style={styles.brandRow}>
            <View style={styles.logoContainer}>
              <Ionicons name="leaf" size={28} color="#FFFFFF" />
            </View>

            <View style={styles.titleContainer}>
              <Text style={styles.brandTitle}>CLEANLIFE</Text>
              <Text style={styles.brandSubtitle}>
                On-Demand Waste Disposal & Eco Recycling Logistics
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardContainer}>
          <Text style={styles.portalTitle}>Client Login</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.textInput}
              placeholder="+237"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>4-DIGIT PIN CODE</Text>
            <TextInput
              style={[styles.textInput, styles.pinInput]}
              placeholder="• • • •"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              secureTextEntry={true}
              maxLength={4}
              value={pinCode}
              onChangeText={setPinCode}
            />
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>LOGIN TO CLIENT PORTAL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerDescription}>
            CleanLife Waste Management, Inc. Styled with Emerald Green & Charcoal Slate palettes.
          </Text>

          <View style={styles.footerBadges}>
            <View style={styles.badgeItem}>
              <Ionicons name="server-outline" size={14} color="#00C853" />
              <Text style={styles.badgeText}>Firebase Firestore</Text>
            </View>

            <Text style={styles.bulletSeparator}>•</Text>

            <View style={styles.badgeItem}>
              <Ionicons name="swap-horizontal-outline" size={14} color="#3B82F6" />
              <Text style={styles.badgeText}>Real-time Websocket Listeners</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function CollectorLoginScreen(): React.JSX.Element {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');

  const handleLogin = (): void => {
    console.log('Logging into Collector Portal:', { phoneNumber, pinCode });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <View style={styles.brandRow}>
            <View style={styles.logoContainer}>
              <Ionicons name="leaf" size={28} color="#FFFFFF" />
            </View>

            <View style={styles.titleContainer}>
              <Text style={styles.brandTitle}>CLEANLIFE</Text>
              <Text style={styles.brandSubtitle}>
                On-Demand Waste Disposal & Eco Recycling Logistics
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardContainer}>
          <Text style={styles.portalTitle}>Collector Login</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.textInput}
              placeholder="+237"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>4-DIGIT PIN CODE</Text>
            <TextInput
              style={[styles.textInput, styles.pinInput]}
              placeholder="• • • •"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              secureTextEntry={true}
              maxLength={4}
              value={pinCode}
              onChangeText={setPinCode}
            />
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>LOGIN TO COLLECTOR PORTAL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerDescription}>
            CleanLife Waste Management, Inc. Styled with Emerald Green & Charcoal Slate palettes.
          </Text>

          <View style={styles.footerBadges}>
            <View style={styles.badgeItem}>
              <Ionicons name="server-outline" size={14} color="#00C853" />
              <Text style={styles.badgeText}>Firebase Firestore</Text>
            </View>

            <Text style={styles.bulletSeparator}>•</Text>

            <View style={styles.badgeItem}>
              <Ionicons name="swap-horizontal-outline" size={14} color="#3B82F6" />
              <Text style={styles.badgeText}>Real-time Websocket Listeners</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#00A859',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  portalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  textInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1F2937',
  },
  pinInput: {
    letterSpacing: 4,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#00A859',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerContainer: {
    backgroundColor: '#0B132B',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerDescription: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  footerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
  },
  bulletSeparator: {
    color: '#6B7280',
    fontSize: 12,
  },
});