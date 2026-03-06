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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { useInspection } from '../src/context/InspectionContext';
import { inspectionsApi, getCurrentApiUrl, getEnvironment } from '../src/lib/api';
import { diagLogger } from '../src/lib/diagLogger';
import { CopyLogsButton } from '../src/components/CopyLogsButton';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDateShort, formatTime, formatDateMedium, formatDateWithDay, formatDateForApi } from '../src/utils/dateFormat';

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
  successCard: '#F0FDF4',
  successBorder: '#86EFAC',
  warning: '#FF9500',
  warningBg: '#FFF8E6',
  warningCard: '#FFFBEB',
  warningBorder: '#FCD34D',
  error: '#FF3B30',
  errorBg: '#FFEBEE',
  errorCard: '#FEF2F2',
  errorBorder: '#FCA5A5',
  info: '#0066FF',
  infoBg: '#E6F0FF',
  infoCard: '#EFF6FF',
  infoBorder: '#93C5FD',
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

// Get card style based on status
const getCardStyle = (status: string) => {
  switch (status) {
    case 'NEW':
      return { bg: Colors.infoCard, border: Colors.infoBorder };
    case 'ACCEPTED':
    case 'IN_PROGRESS':
      return { bg: Colors.warningCard, border: Colors.warningBorder };
    case 'COMPLETED':
      return { bg: Colors.successCard, border: Colors.successBorder };
    case 'REJECTED':
      return { bg: Colors.errorCard, border: Colors.errorBorder };
    default:
      return { bg: Colors.surface, border: Colors.border };
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
  const timeStr = formatTime(scheduledDate);
  const dateStr = formatDateShort(scheduledDate);
  const cardStyle = getCardStyle(inspection.status);
  
  return (
    <View style={[styles.card, { backgroundColor: cardStyle.bg, borderColor: cardStyle.border, borderWidth: 1 }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.vehicleNumberBox}>
          <Text style={styles.vehicleNumber}>{inspection.vehicleNumber || 'KA01AB1234'}</Text>
        </View>
        <StatusBadge status={inspection.status} />
      </View>
      
      {/* Details Grid */}
      <View style={styles.detailsGrid}>
        <View style={[styles.detailItem, { flex: 1, minWidth: 0 }]}>
          <Ionicons name="car-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
            {inspection.makeModelVariant || 'Vehicle Model'}
          </Text>
        </View>
        <View style={[styles.detailItem, { flexShrink: 0 }]}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
          <Text style={[styles.detailText, { flexShrink: 0 }]}>{dateStr} • {timeStr}</Text>
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
          <View style={styles.acceptedActions}>
            <TouchableOpacity 
              onPress={() => openMapsNavigation(inspection)} 
              activeOpacity={0.8} 
              style={styles.mapBtn}
            >
              <Ionicons name="navigate" size={18} color={Colors.primary} />
              <Text style={styles.mapBtnText}>Navigate</Text>
            </TouchableOpacity>
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
          </View>
        )}
        
        {inspection.status === 'IN_PROGRESS' && (
          <View style={styles.acceptedActions}>
            <TouchableOpacity 
              onPress={() => openMapsNavigation(inspection)} 
              activeOpacity={0.8} 
              style={styles.mapBtn}
            >
              <Ionicons name="navigate" size={18} color={Colors.primary} />
              <Text style={styles.mapBtnText}>Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onStart} activeOpacity={0.9} style={styles.startBtnWrapper}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startBtn}
              >
                <Text style={styles.startBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  const { mechanic, logout, clearAllCache } = useAuth();
  const { setCurrentInspection } = useInspection();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'week' | 'custom'>('today');
  
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'last_month' | 'custom'>('all');
  
  // Debug modal state
  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  
  // Custom date range
  const [customDateFrom, setCustomDateFrom] = useState<Date>(new Date());
  const [customDateTo, setCustomDateTo] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);

  // Log home screen mount
  useEffect(() => {
    diagLogger.info('HOME_SCREEN_MOUNTED', {
      mechanicId: mechanic?.id,
      mechanicName: mechanic?.name,
      mechanicCities: mechanic?.inspection_cities,
      apiUrl: getCurrentApiUrl(),
      environment: getEnvironment(),
      timestamp: new Date().toISOString()
    });
    console.log('[HOME] Screen mounted');
    console.log('[HOME] Mechanic:', mechanic?.name, mechanic?.id);
    console.log('[HOME] Cities:', mechanic?.inspection_cities);
    console.log('[HOME] API URL:', getCurrentApiUrl());
    console.log('[HOME] Environment:', getEnvironment());
  }, []);

  // Fetch debug info
  const fetchDebugInfo = async () => {
    setDebugLoading(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://crmdev.wisedrive.com/api';
      
      // Get version info
      let versionData = null;
      try {
        const versionRes = await fetch(`${API_URL}/version`);
        versionData = await versionRes.json();
      } catch (e: any) {
        versionData = { error: e.message };
      }
      
      // Get stored token
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedProfile = await AsyncStorage.getItem('mechanicProfile');
      
      // Test auth endpoint if token exists
      let authTest = null;
      if (storedToken) {
        try {
          const authRes = await fetch(`${API_URL}/auth/test-auth`, {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          });
          const authData = await authRes.json();
          authTest = { ...authData, http_status: authRes.status };
        } catch (e: any) {
          authTest = { error: e.message };
        }
      }

      // Test debug/mechanic-query endpoint
      let mechanicQueryDebug = null;
      if (storedToken) {
        try {
          const debugRes = await fetch(`${API_URL}/debug/mechanic-query`, {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          });
          if (debugRes.ok) {
            mechanicQueryDebug = await debugRes.json();
          } else {
            mechanicQueryDebug = { http_status: debugRes.status, error: 'Endpoint may not exist yet - redeploy needed' };
          }
        } catch (e: any) {
          mechanicQueryDebug = { error: e.message };
        }
      }

      // Test inspections endpoint
      let inspectionsTest = null;
      if (storedToken) {
        try {
          const inspRes = await fetch(`${API_URL}/mechanic/inspections`, {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          });
          if (inspRes.ok) {
            const inspData = await inspRes.json();
            inspectionsTest = { http_status: inspRes.status, count: Array.isArray(inspData) ? inspData.length : 'not array' };
          } else {
            const errData = await inspRes.json().catch(() => ({}));
            inspectionsTest = { http_status: inspRes.status, error: errData.detail || 'Unknown error' };
          }
        } catch (e: any) {
          inspectionsTest = { error: e.message };
        }
      }
      
      setDebugInfo({
        api_url: API_URL,
        version: versionData?.version || 'unknown',
        jwt_status: versionData?.jwt_secret_status || 'unknown',
        token_present: !!storedToken,
        token_preview: storedToken ? `${storedToken.substring(0, 20)}...` : 'NONE',
        profile_name: storedProfile ? JSON.parse(storedProfile)?.name : 'none',
        profile_cities: storedProfile ? JSON.parse(storedProfile)?.inspection_cities : [],
        auth_test: authTest,
        mechanic_query_debug: mechanicQueryDebug,
        inspections_test: inspectionsTest,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      setDebugInfo({ fatal_error: e.message, stack: e.stack });
    } finally {
      setDebugLoading(false);
    }
  };

  const DATE_FILTERS = [
    { id: 'all', label: 'All Time', icon: 'infinite-outline' },
    { id: 'today', label: 'Today', icon: 'today-outline' },
    { id: 'week', label: 'This Week', icon: 'calendar-outline' },
    { id: 'month', label: 'This Month', icon: 'calendar-number-outline' },
    { id: 'last_month', label: 'Last Month', icon: 'time-outline' },
    { id: 'custom', label: 'Custom Range', icon: 'options-outline' },
  ];

  const formatDateForApi = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDateDisplay = (date: Date) => {
    return formatDateMedium(date);
  };

  const fetchInspections = useCallback(async (filterType?: string, fromDate?: Date, toDate?: Date) => {
    const startTime = Date.now();
    diagLogger.info('HOME_FETCH_INSPECTIONS_START', {
      mechanicId: mechanic?.id,
      mechanicName: mechanic?.name,
      filterType: filterType ?? dateFilter,
      apiUrl: getCurrentApiUrl(),
      timestamp: new Date().toISOString()
    });
    console.log('[HOME] Fetching inspections...');
    console.log('[HOME] Mechanic ID:', mechanic?.id);
    console.log('[HOME] Filter:', filterType ?? dateFilter);
    
    try {
      setIsLoading(true);
      const params: any = {};
      
      // Use passed parameters or fall back to state
      const currentFilter = filterType ?? dateFilter;
      const currentFrom = fromDate ?? customDateFrom;
      const currentTo = toDate ?? customDateTo;
      
      if (currentFilter === 'custom') {
        params.date_from = formatDateForApi(currentFrom);
        params.date_to = formatDateForApi(currentTo);
      } else if (currentFilter !== 'all') {
        params.date_filter = currentFilter;
      }
      
      console.log('[HOME] Fetch params:', params);
      diagLogger.info('HOME_FETCH_INSPECTIONS_PARAMS', { params });
      
      const data = await inspectionsApi.getInspections(params);
      const duration = Date.now() - startTime;
      
      diagLogger.info('HOME_FETCH_INSPECTIONS_SUCCESS', {
        mechanicId: mechanic?.id,
        inspectionsCount: data?.length || 0,
        inspectionIds: data?.slice(0, 5).map((i: any) => i.id),
        inspectionStatuses: data?.map((i: any) => ({ id: i.id?.substring(0, 8), status: i.status, vehicleNumber: i.vehicleNumber })),
        durationMs: duration,
        timestamp: new Date().toISOString()
      });
      console.log('[HOME] Fetch success:', data?.length, 'inspections in', duration, 'ms');
      console.log('[HOME] Inspections:', data?.map((i: any) => ({ 
        id: i.id?.substring(0, 8), 
        status: i.status, 
        vehicle: i.vehicleNumber,
        mechanic: i.assignedMechanicId?.substring(0, 8)
      })));
      
      setInspections(data || []);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorInfo = {
        mechanicId: mechanic?.id,
        errorMessage: error.message,
        errorCode: error.code,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        durationMs: duration,
        timestamp: new Date().toISOString()
      };
      diagLogger.error('HOME_FETCH_INSPECTIONS_FAILED', errorInfo);
      console.log('[HOME] Fetch failed:', errorInfo);
      
      Alert.alert('Error', 'Failed to load inspections. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []); // Remove dependencies to prevent infinite loops

  // Refresh when screen comes into focus (after returning from inspection)
  useFocusEffect(
    useCallback(() => {
      diagLogger.info('HOME_SCREEN_FOCUSED', {
        mechanicId: mechanic?.id,
        dateFilter,
        timestamp: new Date().toISOString()
      });
      console.log('[HOME] Screen focused, refreshing inspections...');
      // Fetch based on activeTab for today/tomorrow/week/custom
      if (activeTab === 'custom') {
        fetchInspections('custom', customDateFrom, customDateTo);
      } else if (activeTab === 'today') {
        fetchInspections('today', new Date(), new Date());
      } else if (activeTab === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        fetchInspections('today', tomorrow, tomorrow);
      } else {
        fetchInspections('week', new Date(), new Date());
      }
    }, [activeTab, customDateFrom, customDateTo])
  );

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }
    if (selectedDate) {
      if (showDatePicker === 'from') {
        setCustomDateFrom(selectedDate);
      } else if (showDatePicker === 'to') {
        setCustomDateTo(selectedDate);
      }
    }
  };

  const handleAccept = async (inspection: Inspection) => {
    try {
      await inspectionsApi.acceptInspection(inspection.id);
      // Refresh list
      if (activeTab === 'custom') {
        fetchInspections('custom', customDateFrom, customDateTo);
      } else {
        fetchInspections('all', new Date(), new Date());
      }
      // No modal - just refresh the list silently
    } catch (error) {
      Alert.alert('Error', 'Failed to accept inspection');
    }
  };

  const handleNavigate = (inspection: Inspection) => {
    // Get address from inspection data
    const address = inspection.customerAddress || '';
    const lat = inspection.latitude;
    const lng = inspection.longitude;
    
    if (lat && lng) {
      // Open maps with coordinates
      const url = Platform.select({
        ios: `maps://app?daddr=${lat},${lng}`,
        android: `google.navigation:q=${lat},${lng}`,
      });
      Linking.openURL(url || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    } else if (address) {
      // Open maps with address
      const encodedAddress = encodeURIComponent(address);
      const url = Platform.select({
        ios: `maps://app?daddr=${encodedAddress}`,
        android: `google.navigation:q=${encodedAddress}`,
      });
      Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
    } else {
      Alert.alert('No Address', 'No address or location available for this inspection.');
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
      // Refresh list
      if (activeTab === 'custom') {
        fetchInspections('custom', customDateFrom, customDateTo);
      } else {
        fetchInspections('all', new Date(), new Date());
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reject');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = (inspection: Inspection) => {
    setCurrentInspection(inspection.id, inspection);
    
    // If inspection is already in progress, skip verification and go directly to categories
    if (inspection.status === 'IN_PROGRESS') {
      router.push('/inspection-categories');
    } else {
      router.push(`/verify-vehicle/${inspection.id}`);
    }
  };

  // Filter inspections based on date tab
  const filteredInspections = inspections.filter(i => {
    const inspectionDate = new Date(i.scheduledAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    
    if (activeTab === 'today') {
      return inspectionDate >= today && inspectionDate < tomorrow;
    } else if (activeTab === 'tomorrow') {
      return inspectionDate >= tomorrow && inspectionDate < dayAfterTomorrow;
    } else if (activeTab === 'week') {
      return inspectionDate >= today && inspectionDate < weekFromNow;
    } else if (activeTab === 'custom' && customDateFrom && customDateTo) {
      const fromDate = new Date(customDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(customDateTo);
      toDate.setHours(23, 59, 59, 999);
      return inspectionDate >= fromDate && inspectionDate <= toDate;
    }
    return true;
  });

  // Counts for today/tomorrow/week
  const getCounts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    
    return {
      today: inspections.filter(i => {
        const d = new Date(i.scheduledAt);
        return d >= today && d < tomorrow;
      }).length,
      tomorrow: inspections.filter(i => {
        const d = new Date(i.scheduledAt);
        return d >= tomorrow && d < dayAfterTomorrow;
      }).length,
      week: inspections.filter(i => {
        const d = new Date(i.scheduledAt);
        return d >= today && d < weekFromNow;
      }).length,
    };
  };
  
  const counts = getCounts();

  const tabs = [
    { key: 'today', label: 'Today', icon: 'today-outline' },
    { key: 'tomorrow', label: 'Tomorrow', icon: 'sunny-outline' },
    { key: 'week', label: 'This Week', icon: 'calendar-outline' },
    { key: 'custom', label: '', icon: 'calendar-number-outline', isCalendar: true },
  ];

  const todayStr = formatDateWithDay(new Date());

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerLeft}
          onLongPress={() => { setDebugModalVisible(true); fetchDebugInfo(); }}
          delayLongPress={1000}
        >
          <Text style={styles.greeting}>Hi, {mechanic?.name?.split(' ')[0] || 'Partner'}</Text>
          <Text style={styles.dateText}>{todayStr}</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <CopyLogsButton iconColor={Colors.textSecondary} iconSize={20} style={styles.iconBtn} />
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
          <Text style={styles.statValue}>{counts.today}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.tomorrow}</Text>
          <Text style={styles.statLabel}>Tomorrow</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.week}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          if (tab.isCalendar) {
            // Calendar icon for custom date selection
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.calendarTab, isActive && styles.tabActive]}
                onPress={() => setDateFilterModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={tab.icon as any} 
                  size={20} 
                  color={isActive ? Colors.primary : Colors.textSecondary} 
                />
                {isActive && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            );
          }
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
              onRefresh={() => { 
                setRefreshing(true); 
                if (activeTab === 'custom') {
                  fetchInspections('custom', customDateFrom, customDateTo);
                } else {
                  fetchInspections('all', new Date(), new Date());
                }
              }}
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
            <Text style={styles.modalTitle}>Select Date Range</Text>

            <View style={styles.customDateContainer}>
              <View style={styles.datePickerRow}>
                <TouchableOpacity 
                  style={styles.datePickerBtn}
                  onPress={() => setShowDatePicker('from')}
                >
                  <Ionicons name="calendar" size={18} color={Colors.primary} />
                  <View style={styles.datePickerTextContainer}>
                    <Text style={styles.datePickerLabel}>From</Text>
                    <Text style={styles.datePickerValue}>{formatDateDisplay(customDateFrom)}</Text>
                  </View>
                </TouchableOpacity>
                
                <Ionicons name="arrow-forward" size={20} color={Colors.textMuted} />
                
                <TouchableOpacity 
                  style={styles.datePickerBtn}
                  onPress={() => setShowDatePicker('to')}
                >
                  <Ionicons name="calendar" size={18} color={Colors.primary} />
                  <View style={styles.datePickerTextContainer}>
                    <Text style={styles.datePickerLabel}>To</Text>
                    <Text style={styles.datePickerValue}>{formatDateDisplay(customDateTo)}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.closeFilterBtn} 
              onPress={() => {
                setDateFilterModalVisible(false);
                setActiveTab('custom');
                // Fetch with custom date settings
                fetchInspections('custom', customDateFrom, customDateTo);
              }}
            >
              <Text style={styles.closeFilterBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={showDatePicker === 'from' ? customDateFrom : customDateTo}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Debug Modal - Long press on "Hi, Name" to open */}
      <Modal visible={debugModalVisible} transparent animationType="slide" onRequestClose={() => setDebugModalVisible(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}>
          <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 400, maxHeight: '85%' }}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { marginBottom: 4 }]}>🔧 Debug Info</Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 16 }}>
              Long press captured! Share this screenshot with support.
            </Text>
            
            <ScrollView style={{ flex: 1, marginBottom: 16 }} showsVerticalScrollIndicator={true}>
              {debugLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Loading debug info...</Text>
                </View>
              ) : debugInfo ? (
                <View style={{ backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12 }}>
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10, color: '#00ff00', lineHeight: 16 }}>
                    {JSON.stringify(debugInfo, null, 2)}
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ color: Colors.textSecondary }}>Tap Refresh to load debug info</Text>
                </View>
              )}
            </ScrollView>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
                onPress={fetchDebugInfo}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: Colors.error, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
                onPress={async () => {
                  await clearAllCache();
                  setDebugModalVisible(false);
                  router.replace('/login');
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Clear Cache & Logout</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={{ marginTop: 12, backgroundColor: '#ddd', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
              onPress={() => setDebugModalVisible(false)}
            >
              <Text style={{ color: '#333', fontWeight: '600' }}>Close</Text>
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
  calendarTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
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

  detailsGrid: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 12, justifyContent: 'space-between', alignItems: 'center' },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: Colors.textSecondary, flexShrink: 1 },

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
  acceptedActions: { flex: 1, flexDirection: 'row', gap: 10 },
  mapBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 6, 
    paddingVertical: 12, 
    paddingHorizontal: 14,
    borderRadius: 8, 
    backgroundColor: Colors.primaryLight,
  },
  mapBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
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
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '70%' },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  reasonsList: { marginBottom: 20 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, gap: 10, marginBottom: 8 },
  reasonItemSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reasonText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  reasonTextSelected: { color: Colors.textPrimary, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 0.4, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 0.6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.error, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#FFAAAA' },
  confirmBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  closeFilterBtn: { paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  closeFilterBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // Custom Date Picker
  customDateContainer: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  customDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 8,
  },
  datePickerTextContainer: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  datePickerValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
