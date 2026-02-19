import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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
  isNew?: boolean;
}

const WISEDRIVE_LOGO = 'https://cdn.prod.website-files.com/66ce56aafd5dd215e64eaf55/66cfed41bae84b8ac2e1e62f_Asset%2012-p-500.png';

// Status indicator dot component
const StatusDot = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    active: '#3B82F6',
    completed: '#10B981',
    rejected: '#EF4444',
  };
  return <View style={[styles.statusDot, { backgroundColor: colors[status] || colors.active }]} />;
};

// Collapsible section component
const CollapsibleSection = ({ 
  title, 
  count, 
  status, 
  children, 
  defaultExpanded = false 
}: { 
  title: string; 
  count: number; 
  status: string; 
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity 
        style={styles.sectionHeader} 
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionLeft}>
          <StatusDot status={status} />
          <Text style={styles.sectionTitle}>{title} ({count})</Text>
        </View>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#94A3B8" 
        />
      </TouchableOpacity>
      {expanded && children}
    </View>
  );
};

// Inspection card component
const InspectionCard = ({ 
  inspection, 
  onAccept, 
  onReject,
  showActions = true,
}: { 
  inspection: Inspection; 
  onAccept?: () => void; 
  onReject?: () => void;
  showActions?: boolean;
}) => {
  const date = new Date(inspection.scheduledAt);
  const formattedDate = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  return (
    <View style={styles.inspectionCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.vehicleNumber}>{inspection.vehicleNumber || 'N/A'}</Text>
        {inspection.status === 'NEW' && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.vehicleModel}>{inspection.makeModelVariant || 'Vehicle'}</Text>
      
      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="location-outline" size={14} color="#94A3B8" />
          <Text style={styles.detailText}>{inspection.city}</Text>
        </View>
        <Text style={styles.detailSeparator}>-</Text>
        <Text style={styles.detailText}>{formattedDate}</Text>
      </View>

      {showActions && inspection.status === 'NEW' && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
            <Ionicons name="close" size={18} color="#EF4444" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {inspection.status === 'ACCEPTED' && (
        <TouchableOpacity 
          style={styles.startInspectionButton}
          onPress={() => router.push(`/start-inspection/${inspection.id}`)}
        >
          <MaterialIcons name="play-arrow" size={20} color="#FFF" />
          <Text style={styles.startInspectionText}>Start Inspection</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function HomeScreen() {
  const { mechanic, logout } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

  const rejectReasons = [
    'Not available at the scheduled time',
    'Location too far',
    'Vehicle type not supported',
    'Already have another inspection',
    'Other',
  ];

  const fetchInspections = useCallback(async () => {
    try {
      const data = await inspectionsApi.getInspections();
      // Mark new inspections
      const withNewFlag = data.map((insp: Inspection) => ({
        ...insp,
        status: insp.status === 'NEW' ? 'NEW' : insp.status,
      }));
      setInspections(withNewFlag);
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
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!selectedInspection) return;
    try {
      await inspectionsApi.reject(selectedInspection.id, reason);
      setRejectModalVisible(false);
      setSelectedInspection(null);
      fetchInspections();
    } catch (error) {
      console.error('Error rejecting inspection:', error);
    }
  };

  // Group inspections by status
  const activeInspections = inspections.filter(i => i.status === 'NEW' || i.status === 'ACCEPTED');
  const completedInspections = inspections.filter(i => i.status === 'COMPLETED');
  const rejectedInspections = inspections.filter(i => i.status === 'REJECTED');

  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#1E293B" />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>W</Text>
          </View>
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoText}>WISEDRIVE</Text>
            <Text style={styles.logoTagline}>INSPECT. DRIVE. SMART.</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="calendar-outline" size={22} color="#1E293B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/profile')}>
            <Ionicons name="funnel-outline" size={22} color="#1E293B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Banner */}
      <View style={styles.dateBanner}>
        <View style={styles.dateIconContainer}>
          <Ionicons name="calendar" size={24} color="#FFF" />
        </View>
        <View style={styles.dateTextContainer}>
          <Text style={styles.dateLabel}>VIEWING INSPECTIONS FOR</Text>
          <Text style={styles.dateValue}>Today</Text>
        </View>
        <Text style={styles.dayName}>{dayName}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.pageTitle}>Inspections</Text>
        <Text style={styles.locationSubtitle}>{mechanic?.city || 'Bangalore'}</Text>

        <FlatList
          data={[1]} // Dummy data to render sections
          keyExtractor={() => 'sections'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
          renderItem={() => (
            <>
              {/* Active Section */}
              <CollapsibleSection 
                title="Active" 
                count={activeInspections.length} 
                status="active"
                defaultExpanded={true}
              >
                {activeInspections.map((inspection) => (
                  <InspectionCard
                    key={inspection.id}
                    inspection={inspection}
                    onAccept={() => handleAccept(inspection)}
                    onReject={() => handleRejectPress(inspection)}
                  />
                ))}
                {activeInspections.length === 0 && (
                  <Text style={styles.emptyText}>No active inspections</Text>
                )}
              </CollapsibleSection>

              {/* Completed Section */}
              <CollapsibleSection 
                title="Completed" 
                count={completedInspections.length} 
                status="completed"
              >
                {completedInspections.map((inspection) => (
                  <InspectionCard
                    key={inspection.id}
                    inspection={inspection}
                    showActions={false}
                  />
                ))}
                {completedInspections.length === 0 && (
                  <Text style={styles.emptyText}>No completed inspections</Text>
                )}
              </CollapsibleSection>

              {/* Rejected Section */}
              <CollapsibleSection 
                title="Rejected" 
                count={rejectedInspections.length} 
                status="rejected"
              >
                {rejectedInspections.map((inspection) => (
                  <InspectionCard
                    key={inspection.id}
                    inspection={inspection}
                    showActions={false}
                  />
                ))}
                {rejectedInspections.length === 0 && (
                  <Text style={styles.emptyText}>No rejected inspections</Text>
                )}
              </CollapsibleSection>
            </>
          )}
          contentContainerStyle={styles.listContent}
        />
      </View>

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Inspection</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Please select a reason for rejecting this inspection
            </Text>

            {rejectReasons.map((reason, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reasonOption}
                onPress={() => handleRejectConfirm(reason)}
              >
                <Text style={styles.reasonText}>{reason}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity 
              style={styles.rejectConfirmButton}
              onPress={() => handleRejectConfirm('Other')}
            >
              <Text style={styles.rejectConfirmText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setRejectModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  
  // Header
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
  menuButton: {
    padding: 4,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoIconText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  logoTextContainer: {
    alignItems: 'flex-start',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 1,
  },
  logoTagline: {
    fontSize: 8,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 6,
  },

  // Date Banner
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  dateIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  dayName: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  locationSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 100,
  },

  // Section
  sectionContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Inspection Card
  inspectionCard: {
    backgroundColor: '#FFF',
    marginTop: 8,
    marginLeft: 22,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vehicleNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  newBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  vehicleModel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#94A3B8',
    marginLeft: 4,
  },
  detailSeparator: {
    color: '#CBD5E1',
    marginHorizontal: 8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 6,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 6,
  },
  startInspectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  startInspectionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
    paddingLeft: 22,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  reasonOption: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonText: {
    fontSize: 15,
    color: '#1E293B',
  },
  rejectConfirmButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  rejectConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
});
