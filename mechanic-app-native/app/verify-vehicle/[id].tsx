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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { inspectionsApi } from '../../src/lib/api';
import { useInspection } from '../../src/context/InspectionContext';

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
  successLight: '#D1FAE5',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  error: '#B91C1C',
  errorBg: '#FEE2E2',
  licensePlate: '#FBBF24', // Yellow for license plate style
  licensePlateText: '#0F172A',
};

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
  const [inputFocused, setInputFocused] = useState(false);

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
    setTimeout(() => {
      setVehicleDetails({
        vehicleNumber: inspection.vehicleNumber,
        makeModelVariant: inspection.makeModelVariant || 'Vehicle Model',
        fuelType: 'Petrol',
        color: 'White',
        year: '2022',
        ownerName: inspection.customerName || 'Owner',
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
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Vehicle</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 1/3</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {!isVerified ? (
            <>
              {/* Car Illustration */}
              <View style={styles.illustrationSection}>
                <View style={styles.carCircle}>
                  <MaterialCommunityIcons name="car-side" size={56} color={Colors.primary} />
                </View>
              </View>

              {/* Title */}
              <View style={styles.titleSection}>
                <Text style={styles.title}>Enter Vehicle Number</Text>
                <Text style={styles.subtitle}>
                  Type the registration number exactly as shown on the vehicle
                </Text>
              </View>

              {/* License Plate Style Input */}
              <View style={styles.licensePlateContainer}>
                <View style={styles.licensePlateLeft}>
                  <Text style={styles.licensePlateCountry}>IND</Text>
                </View>
                <View style={[
                  styles.licensePlateInput,
                  inputFocused && styles.licensePlateInputFocused
                ]}>
                  <TextInput
                    style={styles.licensePlateText}
                    placeholder="KA 01 AB 1234"
                    placeholderTextColor={Colors.textTertiary}
                    value={vehicleNumber}
                    onChangeText={(text) => {
                      setVehicleNumber(text.toUpperCase());
                      setIsVerified(false);
                      setVehicleDetails(null);
                    }}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </View>
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                onPress={handleVerify}
                disabled={isVerifying || vehicleNumber.length < 6}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={vehicleNumber.length < 6 ? ['#D1D5DB', '#D1D5DB'] : [Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.verifyBtn}
                >
                  {isVerifying ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="verified" size={22} color="#FFF" />
                      <Text style={styles.verifyBtnText}>Verify Vehicle</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Expected Vehicle Hint */}
              <View style={styles.hintCard}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.hintText}>
                  Expected vehicle: <Text style={styles.hintHighlight}>{inspection?.vehicleNumber || 'N/A'}</Text>
                </Text>
              </View>
            </>
          ) : (
            <>
              {/* Verified Header */}
              <View style={styles.verifiedHeader}>
                <LinearGradient
                  colors={[Colors.successLight, '#F0FDF4']}
                  style={styles.verifiedHeaderGradient}
                >
                  <View style={styles.verifiedIcon}>
                    <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                  </View>
                  <Text style={styles.verifiedTitle}>Vehicle Verified</Text>
                  <Text style={styles.verifiedNumber}>{vehicleDetails?.vehicleNumber}</Text>
                </LinearGradient>
              </View>

              {/* Digital Manifest Card */}
              <View style={styles.manifestCard}>
                <View style={styles.manifestHeader}>
                  <MaterialCommunityIcons name="file-document-outline" size={20} color={Colors.paper} />
                  <Text style={styles.manifestHeaderText}>Vehicle Details</Text>
                  <View style={styles.manifestBadge}>
                    <Text style={styles.manifestBadgeText}>Confirmed</Text>
                  </View>
                </View>

                <View style={styles.manifestBody}>
                  <View style={styles.manifestRow}>
                    <View style={styles.manifestItem}>
                      <Text style={styles.manifestLabel}>Registration</Text>
                      <Text style={styles.manifestValue}>{vehicleDetails?.vehicleNumber}</Text>
                    </View>
                    <View style={styles.manifestItem}>
                      <Text style={styles.manifestLabel}>Year</Text>
                      <Text style={styles.manifestValue}>{vehicleDetails?.year}</Text>
                    </View>
                  </View>

                  <View style={styles.manifestRow}>
                    <View style={styles.manifestItem}>
                      <Text style={styles.manifestLabel}>Make & Model</Text>
                      <Text style={styles.manifestValue}>{vehicleDetails?.makeModelVariant}</Text>
                    </View>
                  </View>

                  <View style={styles.manifestRow}>
                    <View style={styles.manifestItem}>
                      <Text style={styles.manifestLabel}>Fuel Type</Text>
                      <Text style={styles.manifestValue}>{vehicleDetails?.fuelType}</Text>
                    </View>
                    <View style={styles.manifestItem}>
                      <Text style={styles.manifestLabel}>Color</Text>
                      <Text style={styles.manifestValue}>{vehicleDetails?.color}</Text>
                    </View>
                  </View>

                  <View style={styles.manifestDivider} />

                  <View style={styles.manifestRow}>
                    <View style={styles.manifestItem}>
                      <Text style={styles.manifestLabel}>Owner Name</Text>
                      <Text style={styles.manifestValue}>{vehicleDetails?.ownerName}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Confirmation Prompt */}
              <View style={styles.confirmPrompt}>
                <Ionicons name="help-circle-outline" size={20} color={Colors.warning} />
                <Text style={styles.confirmPromptText}>
                  Does this match the vehicle in front of you?
                </Text>
              </View>

              {/* Proceed Button */}
              <TouchableOpacity
                onPress={handleProceedToInspection}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.proceedBtn}
                >
                  <Text style={styles.proceedBtnText}>Yes, Proceed to Inspection</Text>
                  <Ionicons name="arrow-forward" size={22} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Wrong Vehicle */}
              <TouchableOpacity
                style={styles.wrongVehicleBtn}
                onPress={() => {
                  setVehicleNumber('');
                  setIsVerified(false);
                  setVehicleDetails(null);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                <Text style={styles.wrongVehicleText}>No, this is not the correct vehicle</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  stepIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Illustration
  illustrationSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 28,
  },
  carCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },

  // Title
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  // License Plate Input
  licensePlateContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  licensePlateLeft: {
    width: 44,
    backgroundColor: '#1E40AF',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  licensePlateCountry: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  licensePlateInput: {
    flex: 1,
    backgroundColor: Colors.licensePlate,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 2,
    borderLeftWidth: 0,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  licensePlateInputFocused: {
    borderColor: Colors.primary,
  },
  licensePlateText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.licensePlateText,
    textAlign: 'center',
    paddingVertical: 14,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Verify Button
  verifyBtn: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
  },
  verifyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Hint Card
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.subtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  hintText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  hintHighlight: {
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Verified Header
  verifiedHeader: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  verifiedHeaderGradient: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  verifiedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  verifiedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 4,
  },
  verifiedNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Manifest Card
  manifestCard: {
    backgroundColor: Colors.paper,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  manifestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  manifestHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.paper,
  },
  manifestBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  manifestBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.paper,
  },
  manifestBody: {
    padding: 16,
  },
  manifestRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  manifestItem: {
    flex: 1,
  },
  manifestLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  manifestValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  manifestDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },

  // Confirmation Prompt
  confirmPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  confirmPromptText: {
    flex: 1,
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
  },

  // Proceed Button
  proceedBtn: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 12,
  },
  proceedBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Wrong Vehicle
  wrongVehicleBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  wrongVehicleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
});
