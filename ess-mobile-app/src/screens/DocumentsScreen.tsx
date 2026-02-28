// Professional Documents Screen - Light Theme
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { getDocuments, getAccessToken } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';
import { formatDateMedium } from '../utils/dateFormat';

const DOC_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'policy', label: 'Policies' },
  { id: 'certificate', label: 'Certificates' },
  { id: 'letter', label: 'Letters' },
];

export default function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ['documents', filter === 'all' ? undefined : filter],
    queryFn: () => getDocuments(filter === 'all' ? undefined : filter),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['documents'] });
    setRefreshing(false);
  };

  const handleDocumentPress = async (doc: any) => {
    if (doc?.file_url) {
      try {
        // Get the access token and append it to URL for authentication
        const token = await getAccessToken();
        const separator = doc.file_url.includes('?') ? '&' : '?';
        const urlWithToken = token ? `${doc.file_url}${separator}token=${token}` : doc.file_url;
        
        const canOpen = await Linking.canOpenURL(urlWithToken);
        if (canOpen) {
          await Linking.openURL(urlWithToken);
        } else {
          Alert.alert('Error', 'Unable to open this document');
        }
      } catch (error) {
        Alert.alert('Error', 'Unable to open document');
      }
    } else {
      Alert.alert('Info', 'Document preview not available');
    }
  };

  const getDocIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'policy':
        return 'shield-checkmark-outline';
      case 'certificate':
        return 'ribbon-outline';
      case 'letter':
        return 'mail-outline';
      default:
        return 'document-text-outline';
    }
  };

  const getDocColor = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'policy':
        return colors.primary;
      case 'certificate':
        return colors.success;
      case 'letter':
        return colors.warning;
      default:
        return colors.accent;
    }
  };

  // Safe array access - handle both array and object with documents property
  const documentList = Array.isArray(documents) 
    ? documents 
    : (documents?.documents || []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="back-btn"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={iconSize.lg} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {DOC_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              testID={`filter-${type.id}`}
              style={[styles.filterTab, filter === type.id && styles.filterTabActive]}
              onPress={() => setFilter(type.id)}
            >
              <Text style={[styles.filterText, filter === type.id && styles.filterTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : isError ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={styles.emptyText}>Failed to load documents</Text>
            <Text style={styles.emptySubtext}>Pull down to try again</Text>
          </View>
        ) : documentList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No documents found</Text>
            <Text style={styles.emptySubtext}>Documents will appear here when available</Text>
          </View>
        ) : (
          documentList.map((doc: any, index: number) => {
            if (!doc) return null;
            const docColor = getDocColor(doc.document_type);
            const docKey = doc.id || `doc-${index}`;
            
            return (
              <TouchableOpacity
                key={docKey}
                testID={`document-${docKey}`}
                style={styles.docCard}
                onPress={() => handleDocumentPress(doc)}
                activeOpacity={0.7}
              >
                <View style={[styles.docIcon, { backgroundColor: `${docColor}15` }]}>
                  <Ionicons name={getDocIcon(doc.document_type) as any} size={iconSize.lg} color={docColor} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.document_name || doc.name || 'Untitled Document'}</Text>
                  <View style={styles.docMeta}>
                    <Text style={styles.docType}>{doc.document_type || 'Document'}</Text>
                    {doc.created_at && (
                      <>
                        <View style={styles.dot} />
                        <Text style={styles.docDate}>
                          {format(new Date(doc.created_at), 'MMM d, yyyy')}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <Ionicons name="open-outline" size={iconSize.md} color={colors.text.tertiary} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  // Filter
  filterContainer: {
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  filterScroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  filterTextActive: {
    color: '#FFF',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxxl,
  },
  loadingContainer: {
    paddingVertical: spacing.xxxxl,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxxl,
  },
  emptyText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  // Document Card
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  docTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    marginBottom: 4,
  },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docType: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'capitalize',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.tertiary,
    marginHorizontal: spacing.sm,
  },
  docDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
});
