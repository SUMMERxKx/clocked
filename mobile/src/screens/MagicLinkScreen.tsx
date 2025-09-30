import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '../lib/api';
import { useAuthStore } from '../store/auth';

export function MagicLinkScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { login } = useAuthStore();
  const [token, setToken] = useState('');
  const [email] = useState(route.params?.email || '');

  const verifyMagicLinkMutation = useMutation({
    mutationFn: (token: string) => apiClient.verifyMagicLink(token),
    onSuccess: async (response) => {
      await login(response.accessToken, response.refreshToken, response.user);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to verify magic link');
    },
  });

  const handleVerifyToken = () => {
    if (!token.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    verifyMagicLinkMutation.mutate(token.trim());
  };

  const handleResendLink = () => {
    // Navigate back to login screen
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={80} color="#007AFF" />
        </View>

        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.description}>
          We've sent a magic link to {email}. Please check your email and enter the verification code below.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Verification Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter verification code"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            verifyMagicLinkMutation.isPending && styles.buttonDisabled,
          ]}
          onPress={handleVerifyToken}
          disabled={verifyMagicLinkMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {verifyMagicLinkMutation.isPending ? 'Verifying...' : 'Verify & Login'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendButton} onPress={handleResendLink}>
          <Text style={styles.resendButtonText}>
            Didn't receive the email? Resend
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#000000',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    color: '#666666',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
});
