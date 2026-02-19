import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inspectionsApi } from '../../src/lib/api';
import { useInspection } from '../../src/context/InspectionContext';

interface Inspection {
  id: string;
  scheduledAt: string;
  status: string;
  vehicleNumber: string;
  makeModelVariant: string;
  city: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  packageName: string;
  assignedMechanicId?: string;
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setCurrentInspection } = useInspection();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    fetchInspection();
  }, [id]);

  const fetchInspection = async () => {
    try {
      const data = await inspectionsApi.getInspection(id!);
      setInspection(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load inspection details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await inspectionsApi.acceptInspection(id!);
      Alert.alert('Success', 'Inspection accepted!', [
        { text: 'OK', onPress: () => router.push(`/start-inspection/${id}`) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept inspection');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleStartInspection = () => {
    // Set the current inspection in context and navigate to scanner tab
    setCurrentInspection(id!, inspection);
    router.push('/(tabs)/scanner');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!inspection) {
    return null;
  }

  const isNew = inspection.status === 'NEW';
  const isAccepted = inspection.status === 'ACCEPTED';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vehicle Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="car" size={32} color="#3B82F6" />
            </View>
            <View style={styles.vehicleInfoText}>
              <Text style={styles.vehicleNumber}>{inspection.vehicleNumber || 'N/A'}</Text>
              <Text style={styles.makeModel}>{inspection.makeModelVariant}</Text>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>{inspection.customerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>{inspection.customerPhone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>{inspection.customerAddress || inspection.city}</Text>
          </View>
        </View>

        {/* Schedule Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              {new Date(inspection.scheduledAt).toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              {new Date(inspection.scheduledAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>{inspection.packageName}</Text>
          </View>
        </View>

        {/* Status Card */}
        <View style={[styles.card, styles.statusCard]}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(inspection.status).bg }]}>
            <Text style={[styles.statusText, { color: getStatusColor(inspection.status).text }]}>
              {inspection.status}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {isNew && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.buttonText}>Accept Inspection</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isAccepted && (
          <TouchableOpacity style={styles.startButton} onPress={handleStartInspection}>
            <Ionicons name="play-circle" size={24} color="#FFF" />
            <Text style={styles.buttonText}>Start Inspection</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    NEW: { bg: '#DBEAFE', text: '#1D4ED8' },
    ACCEPTED: { bg: '#D1FAE5', text: '#059669' },
    COMPLETED: { bg: '#E0E7FF', text: '#4338CA' },
    REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
  };
  return colors[status] || colors.NEW;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfoText: {
    flex: 1,
  },
  vehicleNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  makeModel: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
