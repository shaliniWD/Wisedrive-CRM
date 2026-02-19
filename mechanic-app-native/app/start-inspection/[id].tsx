import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { inspectionsApi } from '../../src/lib/api';
import { useInspection } from '../../src/context/InspectionContext';

export default function StartInspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setCurrentInspection } = useInspection();
  const [inspection, setInspection] = useState<any>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

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

  const handleStartInspection = () => {
    const cleanInput = vehicleNumber.replace(/\s/g, '').toUpperCase();
    const expectedNumber = inspection?.vehicleNumber?.replace(/\s/g, '').toUpperCase();

    if (cleanInput !== expectedNumber) {
      Alert.alert('Mismatch', `Vehicle number does not match.\nExpected: ${expectedNumber}`);
      return;
    }

    setIsVerifying(true);
    // Set current inspection and navigate to OBD Scanner
    setCurrentInspection(id!, inspection);
    setTimeout(() => {
      setIsVerifying(false);
      router.push('/scanner');
    }, 500);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
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
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Vehicle Info Card */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIconContainer}>
            <MaterialIcons name="directions-car" size={32} color="#3B82F6" />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleLabel}>Vehicle to Inspect</Text>
            <Text style={styles.vehicleNumberDisplay}>{inspection?.vehicleNumber || 'N/A'}</Text>
            <Text style={styles.vehicleModel}>{inspection?.makeModelVariant || 'Vehicle'}</Text>
          </View>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Enter Car Number</Text>
          <Text style={styles.inputHint}>Enter the vehicle registration number to verify</Text>

          <TextInput
            style={styles.input}
            placeholder="KA03NC2764"
            placeholderTextColor="#CBD5E1"
            value={vehicleNumber}
            onChangeText={(text) => setVehicleNumber(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={15}
          />
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, vehicleNumber.length < 6 && styles.startButtonDisabled]}
          onPress={handleStartInspection}
          disabled={isVerifying || vehicleNumber.length < 6}
          activeOpacity={0.8}
        >
          {isVerifying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialIcons name="play-arrow" size={24} color="#FFF" />
              <Text style={styles.startButtonText}>Start Inspection</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoIconText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  logoTextContainer: {
    alignItems: 'flex-start',
  },
  logoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  logoTagline: {
    fontSize: 7,
    color: '#64748B',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  vehicleCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 32,
  },
  vehicleIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleNumberDisplay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  vehicleModel: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  input: {
    height: 64,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 3,
    color: '#1E293B',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    height: 56,
    borderRadius: 12,
    gap: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
