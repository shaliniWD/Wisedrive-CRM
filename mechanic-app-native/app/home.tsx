import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { useInspection } from '../src/context/InspectionContext';
import { inspectionsApi } from '../src/lib/api';

const { width } = Dimensions.get('window');

// Theme colors
const Colors = {
  primary: '#6B21A8',
  primaryLight: '#F3E8FF',
  primaryDark: '#581C87',
  gradientStart: '#7E22CE',
  gradientEnd: '#6B21A8',
  background: '#F8FAFC',
  paper: '#FFFFFF',
  subtle: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  error: '#B91C1C',
  errorBg: '#FEE2E2',
  info: '#4338CA',
  infoBg: '#E0E7FF',
};

interface Inspection {
  id: string;
  vehicle_number: string;
  vehicle_model?: string;
  customer_name?: string;
  customer_phone?: string;
  location?: string;
  city?: string;
  scheduledAt: string;
  status: 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
}

// Rejection reasons
const REJECTION_REASONS = [
  { id: 'distance', label: 'Location too far', icon: 'location-outline' },
  { id: 'busy', label: 'Already busy', icon: 'time-outline' },
  { id: 'vehicle', label: 'Vehicle type issue', icon: 'car-outline' },
  { id: 'timing', label: 'Timing conflict', icon: 'calendar-outline' },
  { id: 'other', label: 'Other reason', icon: 'ellipsis-horizontal' },
];

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    NEW: { label: 'New', bg: Colors.infoBg, text: Colors.info },
    ACCEPTED: { label: 'Accepted', bg: Colors.successBg, text: Colors.success },
    IN_PROGRESS: { label: 'In Progress', bg: Colors.warningBg, text: Colors.warning },
    COMPLETED: { label: 'Completed', bg: Colors.successBg, text: Colors.success },
    REJECTED: { label: 'Rejected', bg: Colors.errorBg, text: Colors.error },
  }[status] || { label: status, bg: Colors.subtle, text: Colors.textSecondary };
  
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: config.text }]} />
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

// Inspection Card Component
const InspectionCard = ({ 
  inspection, 
  onAccept, 
  onReject, 
  onStart 
}: { 
  inspection: Inspection;
  onAccept: () => void;
  onReject: () => void;
  onStart: () => void;
}) => {
  const scheduledDate = new Date(inspection.scheduledAt);
  const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = scheduledDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  
  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.vehicleNumber}>{inspection.vehicle_number || 'KA01AB1234'}</Text>
        <StatusBadge status={inspection.status} />
      </View>
      
      {/* Card Body */}
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <View style={styles.cardDetail}>
            <Ionicons name="car-sport-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardDetailText} numberOfLines={1}>
              {inspection.vehicle_model || 'Vehicle'}
            </Text>
          </View>
          <View style={styles.cardDetail}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardDetailText}>{dateStr}, {timeStr}</Text>
          </View>
        </View>
        
        {inspection.location && (
          <TouchableOpacity style={styles.locationRow} activeOpacity={0.7}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {inspection.location}{inspection.city ? `, ${inspection.city}` : ''}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
        
        {inspection.customer_name && (
          <View style={styles.customerRow}>
            <Ionicons name="person-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.customerText}>{inspection.customer_name}</Text>
            {inspection.customer_phone && (
              <TouchableOpacity style={styles.phoneBtn} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={14} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      
      {/* Card Actions */}
      <View style={styles.cardActions}>
        {inspection.status === 'NEW' && (
          <>
            <TouchableOpacity 
              style={styles.rejectBtn} 
              onPress={onReject}
              activeOpacity={0.8}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onAccept} activeOpacity={0.8} style={{ flex: 1 }}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptBtn}
              >
                <Text style={styles.acceptBtnText}>Accept</Text>
                <Ionicons name="checkmark" size={18} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
        
        {inspection.status === 'ACCEPTED' && (
          <TouchableOpacity onPress={onStart} activeOpacity={0.8} style={{ flex: 1 }}>
            <LinearGradient
              colors={[Colors.gradientStart, Colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtn}
            >
              <Text style={styles.startBtnText}>Start Inspection</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {(inspection.status === 'COMPLETED' || inspection.status === 'REJECTED') && (
          <View style={styles.completedRow}>
            <Ionicons 
              name={inspection.status === 'COMPLETED' ? 'checkmark-circle' : 'close-circle'} 
              size={20} 
              color={inspection.status === 'COMPLETED' ? Colors.success : Colors.error} 
            />
            <Text style={[
              styles.completedText,
              { color: inspection.status === 'COMPLETED' ? Colors.success : Colors.error }
            ]}>
              {inspection.status === 'COMPLETED' ? 'Inspection Completed' : 'Rejected'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Main Component
export default function HomeScreen() {
  const { mechanic, logout } = useAuth();
  const { setCurrentInspection } = useInspection();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'accepted' | 'history'>('all');
  
  // Reject Modal State
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Date Filter State
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

  const fetchInspections = useCallback(async () => {
    try {
      const data = await inspectionsApi.getInspections();
      setInspections(data || []);
    } catch (error) {
      console.error('Failed to fetch inspections:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const handleAccept = async (inspection: Inspection) => {
    try {
      await inspectionsApi.acceptInspection(inspection.id);
      fetchInspections();
      Alert.alert('Success', 'Inspection accepted');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept inspection');
    }
  };

  const handleReject = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setSelectedReason(null);
    setRejectModalVisible(true);
  };

  const submitRejection = async () => {
    if (!selectedInspection || !selectedReason) return;
    
    setIsSubmitting(true);
    try {
      await inspectionsApi.rejectInspection(selectedInspection.id, selectedReason);
      setRejectModalVisible(false);
      fetchInspections();
      Alert.alert('Success', 'Inspection rejected');
    } catch (error) {
      Alert.alert('Error', 'Failed to reject inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = (inspection: Inspection) => {
    setCurrentInspection(inspection.id, inspection);
    router.push(`/verify-vehicle/${inspection.id}`);
  };

  // Filter inspections
  const filteredInspections = inspections.filter(i => {
    // Tab filter
    let passesTabFilter = true;
    if (activeTab === 'new') passesTabFilter = i.status === 'NEW';
    else if (activeTab === 'accepted') passesTabFilter = i.status === 'ACCEPTED' || i.status === 'IN_PROGRESS';
    else if (activeTab === 'history') passesTabFilter = i.status === 'COMPLETED' || i.status === 'REJECTED';
    
    if (!passesTabFilter) return false;
    
    // Date filter
    const inspectionDate = new Date(i.scheduledAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dateFilter === 'today') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return inspectionDate >= today && inspectionDate < tomorrow;
    } else if (dateFilter === 'week') {
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return inspectionDate >= today && inspectionDate < weekFromNow;
    }
    
    return true;
  });

  // Get counts for tabs
  const counts = {
    all: inspections.length,
    new: inspections.filter(i => i.status === 'NEW').length,
    accepted: inspections.filter(i => i.status === 'ACCEPTED' || i.status === 'IN_PROGRESS').length,
    history: inspections.filter(i => i.status === 'COMPLETED' || i.status === 'REJECTED').length,
  };

  const tabs = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'new', label: 'New', count: counts.new },
    { key: 'accepted', label: 'Accepted', count: counts.accepted },
    { key: 'history', label: 'History', count: counts.history },
  ];

  // Get today's date formatted
  const todayStr = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Dashboard Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              Hello, {mechanic?.name?.split(' ')[0] || 'Mechanic'} 👋
            </Text>
            <Text style={styles.dateText}>{todayStr}</Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconBtn, dateFilter !== 'all' && styles.iconBtnActive]} 
              onPress={() => setDateFilterModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={22} color={dateFilter !== 'all' ? Colors.primary : Colors.textSecondary} />
              {dateFilter !== 'all' && <View style={styles.filterDot} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.profileBtn} 
              onPress={() => router.push('/profile')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.profileAvatar}
              >
                <Text style={styles.profileInitial}>
                  {mechanic?.name?.charAt(0)?.toUpperCase() || 'M'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{counts.new}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{counts.accepted}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{counts.history}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Inspection List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredInspections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InspectionCard
              inspection={item}
              onAccept={() => handleAccept(item)}
              onReject={() => handleReject(item)}
              onStart={() => handleStart(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchInspections(); }}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Inspections</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'new' ? 'No new inspections available' :
                 activeTab === 'accepted' ? 'No accepted inspections yet' :
                 activeTab === 'history' ? 'No completed inspections yet' :
                 'Pull down to refresh'}
              </Text>
            </View>
          }
        />
      )}

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="close-circle" size={32} color={Colors.error} />
              </View>
              <Text style={styles.modalTitle}>Reject Inspection</Text>
              <Text style={styles.modalSubtitle}>
                Please select a reason for rejecting this inspection
              </Text>
            </View>

            <View style={styles.reasonsList}>
              {REJECTION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonItem,
                    selectedReason === reason.id && styles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={reason.icon as any} 
                    size={20} 
                    color={selectedReason === reason.id ? Colors.primary : Colors.textSecondary} 
                  />
                  <Text style={[
                    styles.reasonText,
                    selectedReason === reason.id && styles.reasonTextSelected
                  ]}>
                    {reason.label}
                  </Text>
                  {selectedReason === reason.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => setRejectModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitRejectBtn, !selectedReason && styles.submitRejectBtnDisabled]}
                onPress={submitRejection}
                disabled={!selectedReason || isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitRejectBtnText}>Confirm Rejection</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        visible={dateFilterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDateFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="calendar" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Filter by Date</Text>
              <Text style={styles.modalSubtitle}>Select a date range</Text>
            </View>

            <View style={styles.reasonsList}>
              {[
                { key: 'all', label: 'All Inspections', icon: 'list' },
                { key: 'today', label: 'Today', icon: 'today' },
                { key: 'week', label: 'This Week', icon: 'calendar-outline' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.reasonItem,
                    dateFilter === option.key && styles.reasonItemSelected,
                  ]}
                  onPress={() => setDateFilter(option.key as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={option.icon as any} 
                    size={20} 
                    color={dateFilter === option.key ? Colors.primary : Colors.textSecondary} 
                  />
                  <Text style={[
                    styles.reasonText,
                    dateFilter === option.key && styles.reasonTextSelected
                  ]}>
                    {option.label}
                  </Text>
                  {dateFilter === option.key && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => setDateFilterModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setDateFilterModalVisible(false)}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={[Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.applyFilterBtn}
                >
                  <Text style={styles.applyFilterBtnText}>Apply Filter</Text>
                </LinearGradient>
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
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    backgroundColor: Colors.paper,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  profileBtn: {},
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.subtle,
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // Tabs
  tabContainer: {
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.subtle,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: '#FFF',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.paper,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: '#FFF',
  },

  // List
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Card
  card: {
    backgroundColor: Colors.paper,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.textSecondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  cardDetail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardDetailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    marginTop: 4,
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  customerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textTertiary,
  },
  phoneBtn: {
    padding: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.subtle,
    paddingTop: 12,
  },
  rejectBtn: {
    flex: 0.4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.errorBg,
    backgroundColor: Colors.errorBg,
    alignItems: 'center',
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  startBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  completedRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.errorBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
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
    borderColor: Colors.border,
    gap: 12,
  },
  reasonItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  reasonTextSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 0.4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  submitRejectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  submitRejectBtnDisabled: {
    backgroundColor: '#FDA4AF',
  },
  submitRejectBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  applyFilterBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFilterBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
