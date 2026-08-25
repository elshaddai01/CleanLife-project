import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, ratingsApi } from '../../apiClient';

type Props = {
  requestId: number;
  onBack: () => void;
  onSubmitted: () => void;
  onSessionExpired: () => void;
};

export default function RateClientScreen({
  requestId,
  onBack,
  onSubmitted,
  onSessionExpired,
}: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert(
        'Rating required',
        'Please select between 1 and 5 stars.'
      );
      return;
    }

    setLoading(true);

    try {
      await ratingsApi.rateClient({
        pickup_request_id: requestId,
        rating,
        comment: comment.trim() || undefined,
      });

      Alert.alert(
        'Thank you!',
        'Your rating has been submitted successfully.',
        [
          {
            text: 'OK',
            onPress: onSubmitted,
          },
        ]
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }

      const message =
        err instanceof ApiError
          ? `[${err.status}] ${err.message}`
          : String(err);

      Alert.alert('Rating failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>? Back</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>Rate Client</Text>

        <Text style={styles.subtitle}>
          How was your experience with this client?
        </Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setRating(star)}
              style={styles.starButton}
              disabled={loading}
            >
              <Text
                style={[
                  styles.star,
                  star <= rating && styles.starSelected,
                ]}
              >
                ?
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.ratingText}>
          {rating === 0
            ? 'Select a rating'
            : `${rating} out of 5 stars`}
        </Text>

        <Text style={styles.label}>Comment (optional)</Text>

        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Tell us about your experience..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          maxLength={500}
          style={styles.input}
          editable={!loading}
          textAlignVertical="top"
        />

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[
            styles.submitButton,
            loading && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              Submit Rating
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },

  backButton: {
    marginBottom: 20,
  },

  backText: {
    color: '#0891b2',
    fontWeight: '700',
    fontSize: 15,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0e7490',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },

  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },

  starButton: {
    paddingHorizontal: 5,
  },

  star: {
    fontSize: 42,
    color: '#cbd5e1',
  },

  starSelected: {
    color: '#f59e0b',
  },

  ratingText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#475569',
    fontWeight: '700',
  },

  label: {
    marginTop: 24,
    marginBottom: 8,
    color: '#334155',
    fontWeight: '700',
  },

  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },

  submitButton: {
    backgroundColor: '#0891b2',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  submitText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
