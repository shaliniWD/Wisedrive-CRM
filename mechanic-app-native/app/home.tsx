import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { inspectionsApi } from '../src/lib/api';

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
}

const REJECTION_REASONS = [
  'Not available at scheduled time',
  'Location is too far',
  'Vehicle type not supported',
  'Personal emergency',
  'Already assigned to another inspection',
  'Other reason',
];

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    NEW: { bg: '#FEF3C7', text: '#D97706', label: 'New' },
    ACCEPTED: { bg: '#D1FAE5', text: '#059669', label: 'Accepted' },
    IN_PROGRESS: { bg: '#DBEAFE', text: '#2563EB', label: 'In Progress' },
    COMPLETED: { bg: '#E0E7FF', text: '#4F46E5', label: 'Completed' },
    REJECTED: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
  };
  const { bg, text, label } = config[status] || config.NEW;

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={[styles.statusBadgeText, { color: text }]}>{label}</Text>
    </View>
  );
};

// Inspection Card Component
const InspectionCard = ({ 
  inspection, 
  onAccept, 
  onReject,
  onStartInspection,
  onNavigate,
}: { 
  inspection: Inspection; 
  onAccept: () => void; 
  onReject: () => void;
  onStartInspection: () => void;
  onNavigate: () => void;
}) => {
  const date = new Date(inspection.scheduledAt);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  const isNew = inspection.status === 'NEW';
  const isAccepted = inspection.status === 'ACCEPTED';
  const isCompleted = inspection.status === 'COMPLETED';
  const isRejected = inspection.status === 'REJECTED';

  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.carIconContainer}>
            <MaterialCommunityIcons name="car-side" size={24} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.vehicleNumber}>{inspection.vehicleNumber}</Text>
            <Text style={styles.vehicleModel}>{inspection.makeModelVariant}</Text>
          </View>
        </View>
        <StatusBadge status={inspection.status} />
      </View>

      {/* Card Details */}
      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>{formattedDate} • {formattedTime}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#64748B" />
          <Text style={styles.detailText} numberOfLines={1}>{inspection.city}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>{inspection.customerName}</Text>
        </View>
      </View>

      {/* Card Actions */}
      {isNew && (
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.rejectBtn} 
            onPress={onReject}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.acceptBtn} 
            onPress={onAccept}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptBtnGradient}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.acceptBtnText}>Accept Inspection</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {isAccepted && (
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.navigateBtn} 
            onPress={onNavigate}
            activeOpacity={0.7}
          >
            <MaterialIcons name="navigation" size={20} color="#3B82F6" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.startInspectionBtn} 
            onPress={onStartInspection}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startInspectionBtnGradient}
            >
              <MaterialIcons name="play-arrow" size={22} color="#FFF" />
              <Text style={styles.startInspectionBtnText}>Start Inspection</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {(isCompleted || isRejected) && (
        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.viewDetailsBtn}>
            <Text style={styles.viewDetailsBtnText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default function HomeScreen() {
  const { mechanic, logout } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'accepted' | 'completed'>('all');
  
  // Reject Modal State
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Date Filter State
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  const fetchInspections = useCallback(async () => {
    try {
      const data = await inspectionsApi.getInspections();
      setInspections(data);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInspections();
  };

  const handleAccept = async (inspection: Inspection) => {
    try {
      await inspectionsApi.acceptInspection(inspection.id);
      fetchInspections();
    } catch (error) {
      console.error('Error accepting inspection:', error);
    }
  };

  const handleRejectPress = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setSelectedReason(null);
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedInspection || !selectedReason) return;
    setIsSubmitting(true);
    try {
      await inspectionsApi.rejectInspection(selectedInspection.id, selectedReason);
      setRejectModalVisible(false);
      setSelectedInspection(null);
      setSelectedReason(null);
      fetchInspections();
    } catch (error) {
      console.error('Error rejecting inspection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartInspection = (inspection: Inspection) => {
    router.push(`/verify-vehicle/${inspection.id}`);
  };

  const handleNavigate = (inspection: Inspection) => {
    const address = encodeURIComponent(inspection.customerAddress || inspection.city);
    const url = Platform.select({
      ios: `maps:0,0?q=${address}`,
      android: `geo:0,0?q=${address}`,
    });
    if (url) Linking.openURL(url);
  };

  // Filter inspections based on active tab
  const filteredInspections = inspections.filter(i => {
    if (activeTab === 'all') return true;
    if (activeTab === 'new') return i.status === 'NEW';
    if (activeTab === 'accepted') return i.status === 'ACCEPTED';
    if (activeTab === 'completed') return i.status === 'COMPLETED' || i.status === 'REJECTED';
    return true;
  });

  const tabs = [
    { key: 'all', label: 'All', count: inspections.length },
    { key: 'new', label: 'New', count: inspections.filter(i => i.status === 'NEW').length },
    { key: 'accepted', label: 'Accepted', count: inspections.filter(i => i.status === 'ACCEPTED').length },
    { key: 'completed', label: 'History', count: inspections.filter(i => i.status === 'COMPLETED' || i.status === 'REJECTED').length },
  ];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading inspections...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {mechanic?.name?.split(' ')[0] || 'Mechanic'} 👋</Text>
          <Text style={styles.subtitle}>{mechanic?.city || 'Your inspections for today'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.calendarBtn} 
            onPress={() => setDateFilterModalVisible(true)}
          >
            <Ionicons name="calendar-outline" size={24} color="#3B82F6" />
            {dateFilter !== 'all' && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {mechanic?.name?.charAt(0)?.toUpperCase() || 'M'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as any)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Inspections List */}
      <FlatList
        data={filteredInspections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InspectionCard
            inspection={item}
            onAccept={() => handleAccept(item)}
            onReject={() => handleRejectPress(item)}
            onStartInspection={() => handleStartInspection(item)}
            onNavigate={() => handleNavigate(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#3B82F6']} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No inspections found</Text>
            <Text style={styles.emptySubtitle}>Pull down to refresh</Text>
          </View>
        }
      />

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="close-circle" size={32} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>Reject Inspection</Text>
              <Text style={styles.modalSubtitle}>Please select a reason for rejection</Text>
            </View>

            <View style={styles.reasonsList}>
              {REJECTION_REASONS.map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.reasonItem,
                    selectedReason === reason && styles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.radioOuter,
                    selectedReason === reason && styles.radioOuterSelected,
                  ]}>
                    {selectedReason === reason && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitRejectBtn, !selectedReason && styles.submitRejectBtnDisabled]}
                onPress={handleRejectConfirm}
                disabled={!selectedReason || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitRejectBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  profileBtn: {
    marginLeft: 12,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBadgeTextActive: {
    color: '#FFF',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  carIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  vehicleModel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Card Details
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  acceptBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  navigateBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startInspectionBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  startInspectionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  startInspectionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Card Footer
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  viewDetailsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },

  // Reasons List
  reasonsList: {
    gap: 10,
    marginBottom: 24,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  reasonItemSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#EF4444',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: '#475569',
  },
  reasonTextSelected: {
    color: '#1E293B',
    fontWeight: '600',
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  submitRejectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  submitRejectBtnDisabled: {
    backgroundColor: '#FDA4AF',
  },
  submitRejectBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
