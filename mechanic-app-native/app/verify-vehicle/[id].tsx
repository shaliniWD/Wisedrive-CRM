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
  licensePlate: '#F7B500',
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
        'Mismatch',
        `Vehicle number does not match.\n\nExpected: ${expectedNumber}\nEntered: ${cleanInput}`,
        [{ text: 'Retry' }]
      );
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setVehicleDetails({
        vehicleNumber: inspection.vehicleNumber,
        makeModelVariant: inspection.makeModelVariant || 'N/A',
        fuelType: 'Petrol',
        color: 'White',
        year: '2022',
        ownerName: inspection.customerName || 'N/A',
      });
      setIsVerified(true);
      setIsVerifying(false);
    }, 800);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Vehicle</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>1 of 3</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {!isVerified ? (
            <>
              {/* Illustration */}
              <View style={styles.illustrationContainer}>
                <View style={styles.carIconCircle}>
                  <MaterialCommunityIcons name="car-side" size={48} color={Colors.primary} />
                </View>
              </View>

              {/* Title */}
              <View style={styles.titleSection}>
                <Text style={styles.title}>Enter Registration Number</Text>
                <Text style={styles.subtitle}>
                  Type the vehicle registration number as shown on the number plate
                </Text>
              </View>

              {/* License Plate Input */}
              <View style={styles.plateContainer}>
                <View style={styles.plateStrip} />
                <View style={[styles.plateInput, inputFocused && styles.plateInputFocused]}>
                  <TextInput
                    style={styles.plateText}
                    placeholder="KA 01 AB 1234"
                    placeholderTextColor={Colors.textMuted}
                    value={vehicleNumber}
                    onChangeText={(text) => {
                      setVehicleNumber(text.toUpperCase());
                      setIsVerified(false);
                    }}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </View>
              </View>

              {/* Expected Hint */}
              <View style={styles.hintBox}>
                <Ionicons name="information-circle" size={18} color={Colors.primary} />
                <Text style={styles.hintText}>
                  Expected: <Text style={styles.hintHighlight}>{inspection?.vehicleNumber || 'N/A'}</Text>
                </Text>
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                onPress={handleVerify}
                disabled={isVerifying || vehicleNumber.length < 6}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={vehicleNumber.length < 6 ? ['#C4C4C4', '#A0A0A0'] : [Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.verifyBtn}
                >
                  {isVerifying ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="verified" size={20} color="#FFF" />
                      <Text style={styles.verifyBtnText}>Verify</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Verified Banner */}
              <View style={styles.verifiedBanner}>
                <View style={styles.verifiedIconCircle}>
                  <Ionicons name="checkmark" size={28} color={Colors.success} />
                </View>
                <Text style={styles.verifiedTitle}>Vehicle Verified</Text>
                <Text style={styles.verifiedNumber}>{vehicleDetails?.vehicleNumber}</Text>
              </View>

              {/* Details Card */}
              <View style={styles.detailsCard}>
                <View style={styles.detailsHeader}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color="#FFF" />
                  <Text style={styles.detailsHeaderText}>Vehicle Details</Text>
                </View>
                <View style={styles.detailsBody}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Registration</Text>
                      <Text style={styles.detailValue}>{vehicleDetails?.vehicleNumber}</Text>
                    </View>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Year</Text>
                      <Text style={styles.detailValue}>{vehicleDetails?.year}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Make & Model</Text>
                      <Text style={styles.detailValue}>{vehicleDetails?.makeModelVariant}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Fuel</Text>
                      <Text style={styles.detailValue}>{vehicleDetails?.fuelType}</Text>
                    </View>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Color</Text>
                      <Text style={styles.detailValue}>{vehicleDetails?.color}</Text>
                    </View>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Owner</Text>
                      <Text style={styles.detailValue}>{vehicleDetails?.ownerName}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Confirm Prompt */}
              <View style={styles.confirmBox}>
                <Ionicons name="help-circle" size={18} color={Colors.warning} />
                <Text style={styles.confirmText}>Is this the vehicle in front of you?</Text>
              </View>

              {/* Proceed Button */}
              <TouchableOpacity onPress={handleProceedToInspection} activeOpacity={0.9}>
                <LinearGradient
                  colors={[Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.proceedBtn}
                >
                  <Text style={styles.proceedBtnText}>Yes, Proceed</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Wrong Vehicle */}
              <TouchableOpacity
                style={styles.wrongBtn}
                onPress={() => {
                  setVehicleNumber('');
                  setIsVerified(false);
                  setVehicleDetails(null);
                }}
              >
                <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                <Text style={styles.wrongBtnText}>No, wrong vehicle</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.primaryLight, borderRadius: 6 },
  stepText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Content
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Illustration
  illustrationContainer: { alignItems: 'center', marginVertical: 24 },
  carIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },

  // Title
  titleSection: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 16 },

  // Plate Input
  plateContainer: { flexDirection: 'row', marginBottom: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  plateStrip: { width: 36, backgroundColor: '#1E3A5F', justifyContent: 'center', alignItems: 'center' },
  plateInput: { flex: 1, backgroundColor: Colors.licensePlate, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  plateInputFocused: { backgroundColor: '#F9C31F' },
  plateText: {
    fontSize: 20, fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center', letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Hint
  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginBottom: 20 },
  hintText: { fontSize: 13, color: Colors.textSecondary },
  hintHighlight: { fontWeight: '700', color: Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Verify Button
  verifyBtn: { height: 52, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  verifyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Verified
  verifiedBanner: { alignItems: 'center', backgroundColor: Colors.successBg, paddingVertical: 24, borderRadius: 12, marginBottom: 20 },
  verifiedIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  verifiedTitle: { fontSize: 16, fontWeight: '600', color: Colors.success },
  verifiedNumber: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },

  // Details Card
  detailsCard: { backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.textPrimary, paddingHorizontal: 14, paddingVertical: 10 },
  detailsHeaderText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  detailsBody: { padding: 14 },
  detailRow: { flexDirection: 'row', marginBottom: 14 },
  detailCol: { flex: 1 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  detailDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 14 },

  // Confirm
  confirmBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warningBg, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginBottom: 20 },
  confirmText: { fontSize: 13, color: Colors.warning, fontWeight: '500' },

  // Proceed
  proceedBtn: { height: 52, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12 },
  proceedBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Wrong
  wrongBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12 },
  wrongBtnText: { fontSize: 14, fontWeight: '600', color: Colors.error },
});
