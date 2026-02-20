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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { useInspection } from '../src/context/InspectionContext';
import { inspectionsApi } from '../src/lib/api';

const { width } = Dimensions.get('window');

// Professional Blue Theme
const Colors = {
  primary: '#0066FF',
  primaryDark: '#0052CC',
  primaryLight: '#E6F0FF',
  gradientStart: '#0066FF',
  gradientEnd: '#0052CC',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textSecondary: '#5C6370',
  textMuted: '#9CA3AF',
  border: '#E5E9F0',
  success: '#00C853',
  successBg: '#E8F5E9',
  warning: '#FF9500',
  warningBg: '#FFF8E6',
  error: '#FF3B30',
  errorBg: '#FFEBEE',
  info: '#0066FF',
  infoBg: '#E6F0FF',
};

interface Inspection {
  id: string;
  vehicleNumber: string;
  makeModelVariant?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  scheduledAt: string;
  status: 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
}

const REJECTION_REASONS = [
  { id: 'distance', label: 'Location too far', icon: 'location-outline' },
  { id: 'busy', label: 'Already occupied', icon: 'time-outline' },
  { id: 'vehicle', label: 'Vehicle type mismatch', icon: 'car-outline' },
  { id: 'timing', label: 'Schedule conflict', icon: 'calendar-outline' },
  { id: 'other', label: 'Other reason', icon: 'ellipsis-horizontal' },
];

// Status Badge
const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    NEW: { label: 'New', bg: Colors.infoBg, text: Colors.info, dot: Colors.info },
    ACCEPTED: { label: 'Accepted', bg: Colors.successBg, text: Colors.success, dot: Colors.success },
    IN_PROGRESS: { label: 'In Progress', bg: Colors.warningBg, text: Colors.warning, dot: Colors.warning },
    COMPLETED: { label: 'Completed', bg: Colors.successBg, text: Colors.success, dot: Colors.success },
    REJECTED: { label: 'Rejected', bg: Colors.errorBg, text: Colors.error, dot: Colors.error },
  }[status] || { label: status, bg: Colors.border, text: Colors.textSecondary, dot: Colors.textMuted };
  
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: config.dot }]} />
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

// Open Maps Navigation
const openMapsNavigation = (inspection: Inspection) => {
  const { latitude, longitude, customerAddress, city } = inspection;
  
  if (latitude && longitude) {
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
    const url = Platform.OS === 'ios' 
      ? `maps:?daddr=${latitude},${longitude}&dirflg=d`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
    
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to Google Maps
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        Linking.openURL(googleMapsUrl);
      }
    });
  } else if (customerAddress) {
    const address = encodeURIComponent(`${customerAddress}${city ? ', ' + city : ''}, India`);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
    Linking.openURL(googleMapsUrl);
  } else {
    Alert.alert('Location Unavailable', 'No location data available for navigation.');
  }
};

// Inspection Card
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
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.vehicleNumberBox}>
          <Text style={styles.vehicleNumber}>{inspection.vehicleNumber || 'KA01AB1234'}</Text>
        </View>
        <StatusBadge status={inspection.status} />
      </View>
      
      {/* Details Grid */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Ionicons name="car-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.detailText} numberOfLines={1}>
            {inspection.makeModelVariant || 'Vehicle Model'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.detailText}>{dateStr} • {timeStr}</Text>
        </View>
      </View>
      
      {/* Location with Navigate */}
      {(inspection.customerAddress || inspection.latitude) && (
        <TouchableOpacity 
          style={styles.locationBar} 
          onPress={() => openMapsNavigation(inspection)}
          activeOpacity={0.7}
        >
          <View style={styles.locationLeft}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {inspection.customerAddress}{inspection.city ? `, ${inspection.city}` : ''}
            </Text>
          </View>
          <View style={styles.navigateBtn}>
            <Ionicons name="navigate" size={14} color={Colors.primary} />
            <Text style={styles.navigateBtnText}>Navigate</Text>
          </View>
        </TouchableOpacity>
      )}
      
      {/* Customer Info */}
      {inspection.customerName && (
        <View style={styles.customerBar}>
          <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.customerName}>{inspection.customerName}</Text>
          {inspection.customerPhone && (
            <TouchableOpacity 
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${inspection.customerPhone}`)}
            >
              <Ionicons name="call" size={12} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Actions */}
      <View style={styles.cardActions}>
        {inspection.status === 'NEW' && (
          <>
            <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onAccept} activeOpacity={0.9} style={styles.acceptBtnWrapper}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptBtn}
              >
                <Text style={styles.acceptBtnText}>Accept</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
        
        {inspection.status === 'ACCEPTED' && (
          <TouchableOpacity onPress={onStart} activeOpacity={0.9} style={styles.startBtnWrapper}>
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
          <View style={styles.statusRow}>
            <Ionicons 
              name={inspection.status === 'COMPLETED' ? 'checkmark-circle' : 'close-circle'} 
              size={18} 
              color={inspection.status === 'COMPLETED' ? Colors.success : Colors.error} 
            />
            <Text style={[styles.statusText, { color: inspection.status === 'COMPLETED' ? Colors.success : Colors.error }]}>
              {inspection.status === 'COMPLETED' ? 'Completed' : 'Declined'}
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
  
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      Alert.alert('Success', 'Inspection accepted! Tap Navigate to reach the location.');
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
    } catch (error) {
      Alert.alert('Error', 'Failed to reject');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = (inspection: Inspection) => {
    setCurrentInspection(inspection.id, inspection);
    router.push(`/verify-vehicle/${inspection.id}`);
  };

  // Filter
  const filteredInspections = inspections.filter(i => {
    let passesTabFilter = true;
    if (activeTab === 'new') passesTabFilter = i.status === 'NEW';
    else if (activeTab === 'accepted') passesTabFilter = i.status === 'ACCEPTED' || i.status === 'IN_PROGRESS';
    else if (activeTab === 'history') passesTabFilter = i.status === 'COMPLETED' || i.status === 'REJECTED';
    if (!passesTabFilter) return false;
    
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

  const counts = {
    all: inspections.length,
    new: inspections.filter(i => i.status === 'NEW').length,
    accepted: inspections.filter(i => i.status === 'ACCEPTED' || i.status === 'IN_PROGRESS').length,
    history: inspections.filter(i => i.status === 'COMPLETED' || i.status === 'REJECTED').length,
  };

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'accepted', label: 'Active' },
    { key: 'history', label: 'History' },
  ];

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hi, {mechanic?.name?.split(' ')[0] || 'Partner'}</Text>
          <Text style={styles.dateText}>{todayStr}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={[styles.iconBtn, dateFilter !== 'all' && styles.iconBtnActive]} 
            onPress={() => setDateFilterModalVisible(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={dateFilter !== 'all' ? Colors.primary : Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/profile')}>
            <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={styles.avatar}>
              <Text style={styles.avatarText}>{mechanic?.name?.charAt(0)?.toUpperCase() || 'P'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.new}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.accepted}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.history}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as any)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
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
                <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Inspections</Text>
              <Text style={styles.emptyText}>Pull down to refresh</Text>
            </View>
          }
        />
      )}

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="slide" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Decline Inspection</Text>
            <Text style={styles.modalSubtitle}>Please select a reason</Text>

            <View style={styles.reasonsList}>
              {REJECTION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[styles.reasonItem, selectedReason === reason.id && styles.reasonItemSelected]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <Ionicons name={reason.icon as any} size={18} color={selectedReason === reason.id ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.reasonText, selectedReason === reason.id && styles.reasonTextSelected]}>{reason.label}</Text>
                  {selectedReason === reason.id && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, !selectedReason && styles.confirmBtnDisabled]}
                onPress={submitRejection}
                disabled={!selectedReason || isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.confirmBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Filter Modal */}
      <Modal visible={dateFilterModalVisible} transparent animationType="slide" onRequestClose={() => setDateFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Filter by Date</Text>

            <View style={styles.reasonsList}>
              {[
                { key: 'all', label: 'All Inspections', icon: 'list' },
                { key: 'today', label: 'Today', icon: 'today' },
                { key: 'week', label: 'This Week', icon: 'calendar-outline' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.reasonItem, dateFilter === option.key && styles.reasonItemSelected]}
                  onPress={() => { setDateFilter(option.key as any); setDateFilterModalVisible(false); }}
                >
                  <Ionicons name={option.icon as any} size={18} color={dateFilter === option.key ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.reasonText, dateFilter === option.key && styles.reasonTextSelected]}>{option.label}</Text>
                  {dateFilter === option.key && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.closeFilterBtn} onPress={() => setDateFilterModalVisible(false)}>
              <Text style={styles.closeFilterBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
  },
  headerLeft: {},
  greeting: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  dateText: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnActive: { backgroundColor: Colors.primaryLight },
  avatarBtn: {},
  avatar: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: { paddingVertical: 12, paddingHorizontal: 16, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 16, right: 16,
    height: 2, backgroundColor: Colors.primary, borderRadius: 1,
  },

  // List
  listContent: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#FAFBFC',
  },
  vehicleNumberBox: {},
  vehicleNumber: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: 0.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 5 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  detailsGrid: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 12, gap: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: Colors.textSecondary },

  locationBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 14, marginTop: 10, padding: 10,
    backgroundColor: Colors.primaryLight, borderRadius: 8,
  },
  locationLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  locationText: { fontSize: 13, color: Colors.primary, fontWeight: '500', flex: 1 },
  navigateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 },
  navigateBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  customerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, gap: 6 },
  customerName: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  callBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },

  cardActions: { flexDirection: 'row', padding: 14, gap: 10 },
  rejectBtn: {
    flex: 0.35, paddingVertical: 11, borderRadius: 8,
    backgroundColor: Colors.errorBg, alignItems: 'center',
  },
  rejectBtnText: { fontSize: 14, fontWeight: '600', color: Colors.error },
  acceptBtnWrapper: { flex: 0.65 },
  acceptBtn: { paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  acceptBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  startBtnWrapper: { flex: 1 },
  startBtn: { flexDirection: 'row', paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 8 },
  startBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  statusRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 13, fontWeight: '600' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  reasonsList: { gap: 8, marginBottom: 20 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  reasonItemSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reasonText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  reasonTextSelected: { color: Colors.textPrimary, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 0.4, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 0.6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.error, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#FFAAAA' },
  confirmBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  closeFilterBtn: { paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  closeFilterBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
