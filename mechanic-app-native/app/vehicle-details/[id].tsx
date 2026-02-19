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

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inspection, setInspection] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInspection();
  }, [id]);

  const fetchInspection = async () => {
    try {
      const data = await inspectionsApi.getInspection(id!);
      setInspection(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load vehicle details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = () => {
    router.push(`/checklist/${id}`);
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

  // Parse make/model/variant
  const [make, model, ...variantParts] = (inspection?.makeModelVariant || '').split(' ');
  const variant = variantParts.join(' ');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vehicle Card */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car-sport" size={48} color="#3B82F6" />
          </View>
          <Text style={styles.vehicleNumber}>{inspection?.vehicleNumber || 'N/A'}</Text>
          <Text style={styles.vehicleMake}>{inspection?.makeModelVariant || 'Vehicle Details'}</Text>
        </View>

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          <DetailItem icon="business" label="Make" value={make || 'N/A'} />
          <DetailItem icon="car" label="Model" value={model || 'N/A'} />
          <DetailItem icon="options" label="Variant" value={variant || 'N/A'} />
          <DetailItem icon="location" label="City" value={inspection?.city || 'N/A'} />
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="person" label="Name" value={inspection?.customerName || 'N/A'} />
            <InfoRow icon="call" label="Phone" value={inspection?.customerPhone || 'N/A'} />
            <InfoRow icon="location" label="Address" value={inspection?.customerAddress || inspection?.city || 'N/A'} />
          </View>
        </View>

        {/* Package Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspection Package</Text>
          <View style={styles.packageCard}>
            <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
            <Text style={styles.packageName}>{inspection?.packageName || 'Standard Inspection'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.proceedButton} onPress={handleProceed}>
          <Text style={styles.proceedButtonText}>Proceed to Inspection</Text>
          <Ionicons name="arrow-forward" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const DetailItem = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.detailItem}>
    <Ionicons name={icon as any} size={20} color="#64748B" />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon as any} size={18} color="#64748B" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

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
  vehicleCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  vehicleIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    letterSpacing: 1,
  },
  vehicleMake: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  detailItem: {
    width: '50%',
    padding: 4,
  },
  detailItemInner: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
  },
  proceedButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
