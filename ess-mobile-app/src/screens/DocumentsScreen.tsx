// Modern Documents Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getDocuments, getDocumentRequirements } from '../services/api';
import { colors, spacing, borderRadius, shadows } from '../theme';

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { bg: '#FEF3C7', text: '#D97706', icon: 'time' },
  verified: { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle' },
  rejected: { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle' },
};

const DOC_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  aadhar: { icon: 'card', color: '#3B82F6' },
  pan: { icon: 'document-text', color: '#8B5CF6' },
  passport: { icon: 'globe', color: '#10B981' },
  driving_license: { icon: 'car', color: '#F59E0B' },
  educational: { icon: 'school', color: '#EC4899' },
  offer_letter: { icon: 'document', color: '#6366F1' },
  experience_letter: { icon: 'briefcase', color: '#14B8A6' },
  bank_statement: { icon: 'wallet', color: '#EF4444' },
  other: { icon: 'document-attach', color: '#6B7280' },
};

export default function DocumentsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: documentsData, refetch: refetchDocs } = useQuery({
    queryKey: ['documents'],
    queryFn: () => getDocuments(),
  });

  const { data: requirementsData, refetch: refetchReqs } = useQuery({
    queryKey: ['documentRequirements'],
    queryFn: () => getDocumentRequirements(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDocs(), refetchReqs()]);
    setRefreshing(false);
  };

  const documents = documentsData?.documents || [];
  const requirements = requirementsData?.requirements || [];

  const uploadedCount = documents.length;
  const verifiedCount = documents.filter((d: any) => d.status === 'verified').length;
  const pendingCount = documents.filter((d: any) => d.status === 'pending').length;

  const formatDocType = (type: string) => {
    return type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Document';
  };

  const renderDocument = ({ item }: { item: any }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const docConfig = DOC_ICONS[item.document_type] || DOC_ICONS.other;

    return (
      <TouchableOpacity
        style={styles.documentCard}
        onPress={() => item.file_url && Linking.openURL(item.file_url)}
        activeOpacity={0.7}
      >
        <View style={[styles.docIcon, { backgroundColor: `${docConfig.color}15` }]}>
          <Ionicons name={docConfig.icon} size={24} color={docConfig.color} />
        </View>

        <View style={styles.docInfo}>
          <Text style={styles.docTitle}>{formatDocType(item.document_type)}</Text>
          {item.document_number && (
            <Text style={styles.docNumber}>{item.document_number}</Text>
          )}
          {item.uploaded_at && (
            <Text style={styles.docDate}>
              Uploaded: {new Date(item.uploaded_at).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View style={styles.docRight}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={14} color={status.text} />
            <Text style={[styles.statusText, { color: status.text }]}>{item.status}</Text>
          </View>
          {item.file_url && (
            <Ionicons name="download-outline" size={20} color={colors.text.muted} style={{ marginTop: spacing.sm }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary.default, colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>My Documents</Text>
        <Text style={styles.headerSubtitle}>Manage your uploaded documents</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{uploadedCount}</Text>
            <Text style={styles.statLabel}>Uploaded</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4ADE80' }]}>{verifiedCount}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FBBF24' }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Documents List */}
      <FlatList
        data={documents}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={renderDocument}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="folder-open-outline" size={48} color={colors.text.muted} />
            </View>
            <Text style={styles.emptyText}>No documents uploaded</Text>
            <Text style={styles.emptySubtext}>
              Contact HR to upload your documents
            </Text>
          </View>
        }
        ListHeaderComponent={
          documents.length > 0 ? (
            <Text style={styles.sectionTitle}>Uploaded Documents</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
  },
  listContent: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  docIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  docNumber: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  docDate: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  docRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
