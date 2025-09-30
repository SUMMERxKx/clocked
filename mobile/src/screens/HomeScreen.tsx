import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../store/auth';
import { useSessionStore } from '../store/sessions';
import { apiClient } from '../lib/api';
import { formatDuration, formatRelativeTime } from '@clocked/shared';

export function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { activeSession, endSession } = useSessionStore();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch user's groups
  const { data: groups, refetch: refetchGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiClient.getGroups(),
  });

  // Fetch active sessions for user's groups
  const { data: activeSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: async () => {
      if (!groups) return [];
      
      const allActiveSessions = [];
      for (const group of groups) {
        try {
          const response = await apiClient.getGroupSessions(group.id, { active: true });
          allActiveSessions.push(...response.sessions);
        } catch (error) {
          console.error(`Failed to fetch sessions for group ${group.id}:`, error);
        }
      }
      return allActiveSessions;
    },
    enabled: !!groups,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchGroups(), refetchSessions()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEndSession = () => {
    if (!activeSession) return;

    Alert.alert(
      'End Session',
      'Are you sure you want to end your current session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => endSession(activeSession.id),
        },
      ]
    );
  };

  const handleStartSession = () => {
    navigation.navigate('ClockInModal' as never);
  };

  const getSessionDuration = (session: any) => {
    const startTime = new Date(session.startTs);
    const now = new Date();
    const durationMs = now.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    return durationMinutes;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {user?.handle || 'User'}! 👋
        </Text>
        <Text style={styles.subtitle}>
          {activeSession ? 'Keep up the great work!' : 'Ready to start a session?'}
        </Text>
      </View>

      {/* Active Session Card */}
      {activeSession && (
        <View style={styles.activeSessionCard}>
          <View style={styles.activeSessionHeader}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionCategory}>
                {activeSession.category.charAt(0) + activeSession.category.slice(1).toLowerCase()}
              </Text>
              <Text style={styles.sessionDuration}>
                {formatDuration(getSessionDuration(activeSession))}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.endButton}
              onPress={handleEndSession}
            >
              <Ionicons name="stop" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {activeSession.note && (
            <Text style={styles.sessionNote}>{activeSession.note}</Text>
          )}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, activeSession && styles.actionButtonDisabled]}
            onPress={handleStartSession}
            disabled={!!activeSession}
          >
            <Ionicons 
              name={activeSession ? "checkmark-circle" : "play-circle"} 
              size={32} 
              color={activeSession ? "#4CAF50" : "#007AFF"} 
            />
            <Text style={styles.actionButtonText}>
              {activeSession ? 'Session Active' : 'Start Session'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Groups' as never)}
          >
            <Ionicons name="people" size={32} color="#007AFF" />
            <Text style={styles.actionButtonText}>My Groups</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Sessions from Groups */}
      {activeSessions && activeSessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friends Currently Active</Text>
          {activeSessions
            .filter(session => session.userId !== user?.id)
            .map((session) => (
              <View key={session.id} style={styles.friendSessionCard}>
                <View style={styles.friendSessionInfo}>
                  <Text style={styles.friendName}>
                    {session.user?.handle || 'Unknown User'}
                  </Text>
                  <Text style={styles.friendSessionCategory}>
                    {session.category.charAt(0) + session.category.slice(1).toLowerCase()}
                  </Text>
                  <Text style={styles.friendSessionDuration}>
                    {formatDuration(getSessionDuration(session))}
                  </Text>
                </View>
                <TouchableOpacity style={styles.joinButton}>
                  <Ionicons name="add-circle" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
            ))}
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityCard}>
          <Text style={styles.activityText}>
            {activeSession 
              ? `You've been working on ${activeSession.category.toLowerCase()} for ${formatDuration(getSessionDuration(activeSession))}`
              : 'No recent activity. Start a session to begin tracking!'
            }
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  activeSessionCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionCategory: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  sessionDuration: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  endButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionNote: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  section: {
    margin: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginTop: 8,
    textAlign: 'center',
  },
  friendSessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  friendSessionInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  friendSessionCategory: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  friendSessionDuration: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  joinButton: {
    padding: 8,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});
