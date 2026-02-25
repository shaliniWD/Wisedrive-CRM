/**
 * Debug Log Viewer Component
 * Allows viewing, copying, and clearing debug logs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { debugLogger, LogEntry } from '../lib/logger';

interface Props {
  visible: boolean;
  onClose: () => void;
  inspectionId?: string;
}

const colors = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
};

const levelColors = {
  INFO: '#3B82F6',
  WARN: '#F59E0B',
  ERROR: '#EF4444',
  SUCCESS: '#10B981',
  DEBUG: '#8B5CF6',
};

const categoryIcons = {
  STATE: 'layers-outline',
  API_REQUEST: 'cloud-upload-outline',
  API_RESPONSE: 'cloud-download-outline',
  STORAGE: 'save-outline',
  NAVIGATION: 'navigate-outline',
  LIFECYCLE: 'refresh-outline',
};

export default function LogViewer({ visible, onClose, inspectionId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'errors' | 'api'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      loadLogs();
      // Subscribe to updates
      const unsubscribe = debugLogger.subscribe(setLogs);
      return unsubscribe;
    }
  }, [visible, inspectionId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let fetchedLogs: LogEntry[];
      if (inspectionId) {
        fetchedLogs = await debugLogger.getLogsForInspection(inspectionId);
      } else {
        fetchedLogs = await debugLogger.getRecentLogs(200);
      }
      setLogs(fetchedLogs.reverse()); // Most recent first
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
    setLoading(false);
  };

  const getFilteredLogs = () => {
    switch (filter) {
      case 'errors':
        return logs.filter(l => l.level === 'ERROR' || l.level === 'WARN');
      case 'api':
        return logs.filter(l => l.category === 'API_REQUEST' || l.category === 'API_RESPONSE');
      default:
        return logs;
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const copyAllLogs = async () => {
    try {
      const exportData = await debugLogger.exportLogs();
      Clipboard.setString(exportData);
      Alert.alert('Copied!', 'All logs copied to clipboard. You can paste them to share.');
    } catch (e) {
      Alert.alert('Error', 'Failed to copy logs');
    }
  };

  const copyFilteredLogs = () => {
    const filteredData = {
      exportedAt: new Date().toISOString(),
      filter,
      totalLogs: getFilteredLogs().length,
      logs: getFilteredLogs(),
    };
    Clipboard.setString(JSON.stringify(filteredData, null, 2));
    Alert.alert('Copied!', 'Filtered logs copied to clipboard.');
  };

  const clearLogs = async () => {
    Alert.alert(
      'Clear All Logs?',
      'This will permanently delete all debug logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await debugLogger.clearLogs();
            setLogs([]);
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  const filteredLogs = getFilteredLogs();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Debug Logs</Text>
          <TouchableOpacity onPress={copyAllLogs} style={styles.copyButton}>
            <Ionicons name="copy-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {filteredLogs.length} logs
            {inspectionId && ` • Inspection: ${inspectionId.substring(0, 8)}...`}
          </Text>
          <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {[
            { key: 'all', label: 'All' },
            { key: 'errors', label: 'Errors' },
            { key: 'api', label: 'API Calls' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
              onPress={() => setFilter(tab.key as any)}
            >
              <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Copy Filtered Button */}
        <TouchableOpacity style={styles.copyFilteredButton} onPress={copyFilteredLogs}>
          <Ionicons name="clipboard-outline" size={18} color="#fff" />
          <Text style={styles.copyFilteredText}>Copy Filtered Logs ({filteredLogs.length})</Text>
        </TouchableOpacity>

        {/* Logs List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading logs...</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No logs found</Text>
          </View>
        ) : (
          <ScrollView style={styles.logsList} contentContainerStyle={styles.logsContent}>
            {filteredLogs.map((log) => (
              <TouchableOpacity
                key={log.id}
                style={[styles.logEntry, { borderLeftColor: levelColors[log.level] }]}
                onPress={() => toggleExpand(log.id)}
                activeOpacity={0.7}
              >
                <View style={styles.logHeader}>
                  <View style={styles.logMeta}>
                    <Ionicons
                      name={categoryIcons[log.category] as any}
                      size={14}
                      color={levelColors[log.level]}
                    />
                    <Text style={[styles.logLevel, { color: levelColors[log.level] }]}>
                      {log.level}
                    </Text>
                    <Text style={styles.logCategory}>{log.category}</Text>
                  </View>
                  <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                </View>

                <Text style={styles.logAction} numberOfLines={expanded.has(log.id) ? undefined : 2}>
                  {log.action}
                </Text>

                {log.questionId && (
                  <Text style={styles.logQuestionId}>Q: {log.questionId.substring(0, 20)}...</Text>
                )}

                {log.error && (
                  <Text style={styles.logError}>⚠ {log.error}</Text>
                )}

                {expanded.has(log.id) && log.data && (
                  <View style={styles.logDataContainer}>
                    <Text style={styles.logDataLabel}>Data:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <Text style={styles.logData} selectable>
                        {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                      </Text>
                    </ScrollView>
                  </View>
                )}

                {log.data && (
                  <Text style={styles.tapToExpand}>
                    {expanded.has(log.id) ? '▲ Tap to collapse' : '▼ Tap to expand data'}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  copyButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
  },
  statsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearText: {
    fontSize: 13,
    color: colors.danger,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  copyFilteredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  copyFilteredText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  logsList: {
    flex: 1,
  },
  logsContent: {
    padding: 12,
  },
  logEntry: {
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logLevel: {
    fontSize: 11,
    fontWeight: '700',
  },
  logCategory: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logTime: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'Courier',
  },
  logAction: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  logQuestionId: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
  },
  logError: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '500',
  },
  logDataContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 6,
  },
  logDataLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  logData: {
    fontSize: 11,
    color: '#E2E8F0',
    fontFamily: 'Courier',
    lineHeight: 16,
  },
  tapToExpand: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
