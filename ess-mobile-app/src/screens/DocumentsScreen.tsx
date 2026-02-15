// Documents Screen
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getDocuments, getDocumentRequirements } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  verified: '#4CAF50',
  rejected: '#F44336',
};

const DOC_ICONS: Record<string, string> = {
  aadhar: 'card',
  pan: 'card-outline',
  passport: 'globe',
  driving_license: 'car',
  educational: 'school',
  offer_letter: 'document',
  experience_letter: 'briefcase',
  other: 'document-text',
};

export default function DocumentsScreen() {
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: () => getDocuments(),
  });

  const { data: requirements } = useQuery({
    queryKey: ['documentRequirements'],
    queryFn: getDocumentRequirements,
  });

  const handleViewDocument = (url: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const DocumentCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => item.file_url && handleViewDocument(item.file_url)}
      disabled={!item.file_url}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.iconContainer, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
          <Ionicons
            name={DOC_ICONS[item.document_type] || 'document-text'}
            size={24}
            color={STATUS_COLORS[item.status]}
          />
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docName}>{item.document_name}</Text>
          {item.document_number && (
            <Text style={styles.docNumber}>{item.document_number}</Text>
          )}
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      
      {item.file_url && (
        <Ionicons name="eye-outline" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      {requirements && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Document Completion</Text>
            <Text style={styles.progressPercent}>
              {requirements.completion_percentage}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${requirements.completion_percentage}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {requirements.completed_count} of {requirements.total_required} required documents uploaded
          </Text>
        </View>
      )}

      {/* Documents List */}
      <FlatList
        data={documents?.documents || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DocumentCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No documents uploaded</Text>
            <Text style={styles.emptySubtext}>Upload documents via the web portal</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  docNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
});
