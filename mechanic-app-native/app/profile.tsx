import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import Constants from 'expo-constants';
import { diagLogger } from '../src/lib/diagLogger';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const { mechanic, logout } = useAuth();
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const logsText = await diagLogger.getLogsAsText();
      setLogs(logsText || 'No logs available');
    } catch (e) {
      setLogs('Failed to load logs: ' + String(e));
    } finally {
      setLogsLoading(false);
    }
  };

  const copyLogs = async () => {
    try {
      await Clipboard.setStringAsync(logs);
      Alert.alert('Copied', 'Logs copied to clipboard. You can now paste and share them.');
    } catch (e) {
      Alert.alert('Error', 'Failed to copy logs');
    }
  };

  const shareLogs = async () => {
    try {
      await Share.share({
        message: `WiseDrive Mechanic App Logs\nVersion: ${Constants.expoConfig?.version || '1.0.0'}\nTimestamp: ${new Date().toISOString()}\n\n${logs}`,
        title: 'WiseDrive App Logs',
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to share logs');
    }
  };

  const clearLogs = async () => {
    Alert.alert('Clear Logs', 'Are you sure you want to clear all logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await diagLogger.clear();
          setLogs('Logs cleared');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#3B82F6" />
          </View>
          <Text style={styles.name}>{mechanic?.name || 'Mechanic'}</Text>
          <Text style={styles.phone}>{mechanic?.phone || '+91 XXXXXXXXXX'}</Text>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="mail-outline" size={20} color="#64748B" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{mechanic?.email || 'Not provided'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="location-outline" size={20} color="#64748B" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>City</Text>
              <Text style={styles.infoValue}>{mechanic?.city || 'Not assigned'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="map-outline" size={20} color="#64748B" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Inspection Cities</Text>
              <Text style={styles.infoValue}>
                {mechanic?.inspection_cities?.join(', ') || 'Not assigned'}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={22} color="#1E293B" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={22} color="#1E293B" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="information-circle-outline" size={22} color="#1E293B" />
            <Text style={styles.menuText}>About</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Debug Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diagnostics</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setLogsModalVisible(true);
              loadLogs();
            }}
          >
            <Ionicons name="document-text-outline" size={22} color="#F59E0B" />
            <Text style={styles.menuText}>View Debug Logs</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
          
          <Text style={styles.helpText}>
            If you're experiencing issues with saving answers or photos, tap "View Debug Logs" and share the logs with support.
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
      </ScrollView>

      {/* Logs Modal */}
      <Modal
        visible={logsModalVisible}
        animationType="slide"
        onRequestClose={() => setLogsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setLogsModalVisible(false)}>
              <Ionicons name="close" size={28} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Debug Logs</Text>
            <TouchableOpacity onPress={shareLogs}>
              <Ionicons name="share-outline" size={24} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={copyLogs}>
              <Ionicons name="copy-outline" size={18} color="#3B82F6" />
              <Text style={styles.actionBtnText}>Copy All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={loadLogs}>
              <Ionicons name="refresh-outline" size={18} color="#3B82F6" />
              <Text style={styles.actionBtnText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={clearLogs}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          {logsLoading ? (
            <View style={styles.logsLoading}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.logsLoadingText}>Loading logs...</Text>
            </View>
          ) : (
            <ScrollView style={styles.logsContainer}>
              <Text style={styles.logsText}>{logs}</Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  phone: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 15,
    color: '#1E293B',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    marginLeft: 12,
  },
  helpText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 12,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  version: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    gap: 6,
  },
  actionBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  logsContainer: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1a1a2e',
  },
  logsText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#00ff00',
    lineHeight: 16,
  },
  logsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logsLoadingText: {
    marginTop: 12,
    color: '#64748B',
  },
});
