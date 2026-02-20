import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { inspectionsApi } from '../../src/lib/api';
import { useInspection } from '../../src/context/InspectionContext';

interface VehicleDetails {
  vehicleNumber: string;
  makeModelVariant: string;
  fuelType?: string;
  color?: string;
  year?: string;
  ownerName?: string;
}

export default function VerifyVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setCurrentInspection } = useInspection();
  const [inspection, setInspection] = useState<any>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetails | null>(null);

  useEffect(() => {
    fetchInspection();
  }, [id]);

  const fetchInspection = async () => {
    try {
      const data = await inspectionsApi.getInspection(id!);
      setInspection(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load inspection');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = () => {
    const cleanInput = vehicleNumber.replace(/\s/g, '').toUpperCase();
    const expectedNumber = inspection?.vehicleNumber?.replace(/\s/g, '').toUpperCase();

    if (cleanInput !== expectedNumber) {
      Alert.alert(
        'Vehicle Mismatch',
        `The entered vehicle number doesn't match.\n\nExpected: ${expectedNumber}\nEntered: ${cleanInput}`,
        [{ text: 'Try Again', style: 'default' }]
      );
      return;
    }

    setIsVerifying(true);
    // Simulate API call to fetch vehicle details
    setTimeout(() => {
      setVehicleDetails({
        vehicleNumber: inspection.vehicleNumber,
        makeModelVariant: inspection.makeModelVariant,
        fuelType: 'Petrol',
        color: 'White',
        year: '2022',
        ownerName: inspection.customerName,
      });
      setIsVerified(true);
      setIsVerifying(false);
    }, 1000);
  };

  const handleProceedToInspection = () => {
    setCurrentInspection(id!, inspection);
    router.push('/inspection-categories');
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Vehicle</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Vehicle Icon */}
          <View style={styles.vehicleIconSection}>
            <View style={styles.vehicleIconContainer}>
              <MaterialCommunityIcons name="car-side" size={48} color="#3B82F6" />
            </View>
            <Text style={styles.vehicleIconTitle}>Enter Vehicle Number</Text>
            <Text style={styles.vehicleIconSubtitle}>
              Enter the registration number of the vehicle in front of you
            </Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g. KA03NC2764"
                placeholderTextColor="#94A3B8"
                value={vehicleNumber}
                onChangeText={(text) => {
                  setVehicleNumber(text.toUpperCase());
                  setIsVerified(false);
                  setVehicleDetails(null);
                }}
                autoCapitalize="characters"
                maxLength={15}
                editable={!isVerified}
              />
              {vehicleNumber.length > 0 && !isVerified && (
                <TouchableOpacity 
                  style={styles.clearBtn}
                  onPress={() => setVehicleNumber('')}
                >
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
              {isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
              )}
            </View>

            {!isVerified && (
              <TouchableOpacity
                style={[styles.verifyBtn, vehicleNumber.length < 6 && styles.verifyBtnDisabled]}
                onPress={handleVerify}
                disabled={isVerifying || vehicleNumber.length < 6}
                activeOpacity={0.8}
              >
                {isVerifying ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="verified" size={20} color="#FFF" />
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Vehicle Details Card */}
          {isVerified && vehicleDetails && (
            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <View style={styles.detailsIconContainer}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.detailsTitle}>Vehicle Verified</Text>
                  <Text style={styles.detailsSubtitle}>Please confirm the details below</Text>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Registration No.</Text>
                  <Text style={styles.detailValue}>{vehicleDetails.vehicleNumber}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Make & Model</Text>
                  <Text style={styles.detailValue}>{vehicleDetails.makeModelVariant}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Fuel Type</Text>
                  <Text style={styles.detailValue}>{vehicleDetails.fuelType}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Color</Text>
                  <Text style={styles.detailValue}>{vehicleDetails.color}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Year</Text>
                  <Text style={styles.detailValue}>{vehicleDetails.year}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Owner</Text>
                  <Text style={styles.detailValue}>{vehicleDetails.ownerName}</Text>
                </View>
              </View>

              <View style={styles.confirmSection}>
                <Text style={styles.confirmText}>
                  Does this match the vehicle in front of you?
                </Text>
              </View>
            </View>
          )}

          {/* Proceed Button */}
          {isVerified && (
            <TouchableOpacity
              style={styles.proceedBtn}
              onPress={handleProceedToInspection}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.proceedBtnGradient}
              >
                <Text style={styles.proceedBtnText}>Proceed to Inspection</Text>
                <MaterialIcons name="arrow-forward" size={22} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Change Vehicle Button */}
          {isVerified && (
            <TouchableOpacity
              style={styles.changeVehicleBtn}
              onPress={() => {
                setVehicleNumber('');
                setIsVerified(false);
                setVehicleDetails(null);
              }}
            >
              <Text style={styles.changeVehicleBtnText}>This is not the correct vehicle</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },

  // Content
  content: {
    flex: 1,
    padding: 20,
  },

  // Vehicle Icon Section
  vehicleIconSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  vehicleIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  vehicleIconTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  vehicleIconSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Input Section
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 60,
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: 2,
  },
  clearBtn: {
    padding: 4,
  },
  verifiedBadge: {
    padding: 4,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  verifyBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  verifyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Details Card
  detailsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  detailsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    width: '50%',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  confirmSection: {
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  confirmText: {
    fontSize: 14,
    color: '#C2410C',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Proceed Button
  proceedBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  proceedBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  proceedBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },

  // Change Vehicle Button
  changeVehicleBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  changeVehicleBtnText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
});
