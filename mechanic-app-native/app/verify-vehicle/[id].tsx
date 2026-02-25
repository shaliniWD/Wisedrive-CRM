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
  Linking,
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
  primary: '#1E3A5F',
  primaryLight: '#E8F0FE',
  gradientStart: '#1E3A5F',
  gradientEnd: '#3B82F6',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  error: '#EF4444',
};

export default function VerifyVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setCurrentInspection } = useInspection();
  const [inspection, setInspection] = useState<any>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    fetchInspection();
  }, [id]);

  const fetchInspection = async () => {
    try {
      const data = await inspectionsApi.getInspection(id!);
      setInspection(data);
      console.log('Inspection loaded:', JSON.stringify(data, null, 2));
    } catch (err) {
      Alert.alert('Error', 'Failed to load inspection');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    const cleanInput = vehicleNumber.replace(/\s/g, '').toUpperCase();
    const expectedNumber = inspection?.vehicleNumber?.replace(/\s/g, '').toUpperCase();

    if (cleanInput !== expectedNumber) {
      Alert.alert(
        'Vehicle Mismatch',
        `The entered number doesn't match.\n\nExpected: ${expectedNumber}\nEntered: ${cleanInput}`,
        [{ text: 'Retry' }]
      );
      return;
    }

    setIsVerifying(true);
    
    try {
      // Call the start inspection API to update status
      await inspectionsApi.startInspection(id!);
      console.log('Inspection started successfully');
    } catch (error) {
      console.log('Error starting inspection (non-critical):', error);
      // Continue even if this fails - the inspection can still proceed
    }
    
    // Set current inspection and navigate to inspection categories
    setCurrentInspection(id!, inspection);
    setTimeout(() => {
      setIsVerifying(false);
      router.push('/inspection-categories');
    }, 500);
  };

  const handleCall = () => {
    if (inspection?.customerPhone) {
      Linking.openURL(`tel:${inspection.customerPhone}`);
    }
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Inspection</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vehicle Details Card */}
        <View style={styles.vehicleCard}>
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.vehicleHeader}
          >
            <MaterialCommunityIcons name="car" size={24} color="#FFF" />
            <Text style={styles.vehicleHeaderText}>Vehicle Details</Text>
          </LinearGradient>
          
          <View style={styles.vehicleBody}>
            {/* Vehicle Number - Prominent */}
            <View style={styles.vehicleNumberRow}>
              <Text style={styles.vehicleNumberLabel}>Registration Number</Text>
              <Text style={styles.vehicleNumberValue}>{inspection?.vehicleNumber || 'N/A'}</Text>
            </View>

            {/* Make & Model */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Make & Model</Text>
                <Text style={styles.detailValue}>
                  {inspection?.makeModelVariant || inspection?.carMake && inspection?.carModel 
                    ? `${inspection.carMake} ${inspection.carModel}`.trim() 
                    : 'Not Available'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Fuel Type</Text>
                <Text style={styles.detailValue}>{inspection?.fuelType || inspection?.fuel_type || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Year</Text>
                <Text style={styles.detailValue}>{inspection?.manufacturingYear || inspection?.year || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Odometer</Text>
                <Text style={styles.detailValue}>
                  {inspection?.odometerReading || inspection?.odometer ? `${inspection?.odometerReading || inspection?.odometer} km` : 'N/A'}
                </Text>
              </View>
            </View>

            {/* Customer Info */}
            <View style={styles.customerSection}>
              <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.customerName}>
                {inspection?.customerName || inspection?.customer_name || 'Customer'}
              </Text>
              {inspection?.customerPhone && (
                <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                  <Ionicons name="call" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Verification Section */}
        <View style={styles.verificationCard}>
          <Text style={styles.verificationTitle}>Verify Vehicle</Text>
          <Text style={styles.verificationSubtitle}>
            Enter the registration number to confirm you're inspecting the correct vehicle
          </Text>

          <TextInput
            style={[styles.input, inputFocused && styles.inputFocused]}
            placeholder="Enter vehicle number (e.g., KA01AB1234)"
            placeholderTextColor={Colors.textMuted}
            value={vehicleNumber}
            onChangeText={(text) => setVehicleNumber(text.toUpperCase().replace(/\s/g, ''))}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoCapitalize="characters"
            maxLength={15}
          />
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, vehicleNumber.length < 6 && styles.startButtonDisabled]}
          onPress={handleVerify}
          disabled={isVerifying || vehicleNumber.length < 6}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={vehicleNumber.length >= 6 ? [Colors.success, '#059669'] : ['#94A3B8', '#94A3B8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startButtonGradient}
          >
            {isVerifying ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="play-arrow" size={24} color="#FFF" />
                <Text style={styles.startButtonText}>Start Inspection</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  vehicleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  vehicleHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  vehicleBody: {
    padding: 16,
  },
  vehicleNumberRow: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  vehicleNumberLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleNumberValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 2,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  customerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    gap: 8,
  },
  customerName: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  verificationSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    height: 56,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 2,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 32,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 8,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
