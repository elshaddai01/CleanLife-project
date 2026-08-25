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

export default function RateCollectorScreen({
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
      await ratingsApi.rateCollector({
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
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Rate Collector</Text>

      <Text style={styles.subtitle}>
        How was your waste pickup experience?
      </Text>

      <Text style={styles.request}>
        Request #{requestId}
      </Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Text style={star <= rating ? styles.starActive : styles.star}>
              ★
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.ratingText}>
        {rating === 0
          ? 'Select a rating'
          : `${rating} out of 5`}
      </Text>

      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Write a review (optional)"
        multiline
        numberOfLines={5}
        style={styles.input}
        textAlignVertical="top"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        style={[
          styles.submitButton,
          loading && styles.disabled,
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

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0e7490',
  },

  subtitle: {
    color: '#64748b',
    marginTop: 6,
    fontSize: 14,
  },

  request: {
    marginTop: 20,
    fontWeight: '800',
    color: '#1e293b',
    fontSize: 16,
  },

  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },

  starButton: {
    paddingHorizontal: 5,
  },

  star: {
    fontSize: 42,
    color: '#cbd5e1',
  },

  starActive: {
    fontSize: 42,
    color: '#f59e0b',
  },

  ratingText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#64748b',
    fontWeight: '700',
  },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    marginTop: 25,
    minHeight: 120,
    color: '#1e293b',
  },

  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },

  submitText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },

  disabled: {
    opacity: 0.6,
  },
});