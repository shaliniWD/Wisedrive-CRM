import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authApi } from '../src/lib/api';
import { useAuth } from '../src/context/AuthContext';
import axios from 'axios';

// API Base URL for debugging
const API_BASE_URL = 'https://crmdev.wisedrive.com/api';

const { width, height } = Dimensions.get('window');

// Professional Blue Theme
const Colors = {
  primary: '#0066FF',
  primaryDark: '#0052CC',
  primaryLight: '#E6F0FF',
  gradientStart: '#0066FF',
  gradientEnd: '#0052CC',
  background: '#FFFFFF',
  surface: '#F7F9FC',
  textPrimary: '#1A1A2E',
  textSecondary: '#5C6370',
  textMuted: '#9CA3AF',
  border: '#E5E9F0',
  borderFocus: '#0066FF',
  success: '#00C853',
  error: '#FF3B30',
  white: '#FFFFFF',
};

export default function LoginScreen() {
  const { login } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countryCode] = useState('+91');
  const [inputFocused, setInputFocused] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState({ title: '', message: '', isAuthError: false });
  
  const otpInputs = useRef<(TextInput | null)[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Show custom error modal
  const showError = (title: string, message: string, isAuthError: boolean = false) => {
    setErrorModalContent({ title, message, isAuthError });
    setShowErrorModal(true);
  };

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      showError('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    setDebugLogs([]); // Clear previous logs
    
    try {
      const fullPhone = `${countryCode}${phone}`;
      addLog(`Requesting OTP for: ${fullPhone}`);
      addLog(`API URL: ${API_BASE_URL}/auth/request-otp`);
      
      // Make direct API call with detailed logging
      const response = await axios.post(`${API_BASE_URL}/auth/request-otp`, {
        phone: fullPhone
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      addLog(`Response Status: ${response.status}`);
      addLog(`Response Data: ${JSON.stringify(response.data)}`);
      
      setStep('otp');
      showError('OTP Sent', 'Please check your phone for the verification code');
    } catch (error: any) {
      addLog(`ERROR occurred!`);
      
      if (error.response) {
        // Server responded with error
        addLog(`Status Code: ${error.response.status}`);
        addLog(`Error Data: ${JSON.stringify(error.response.data)}`);
        addLog(`Headers: ${JSON.stringify(error.response.headers)}`);
        
        const errorDetail = error.response.data?.detail || error.response.data?.message || 'Unknown server error';
        
        // Check if it's an authorization error
        if (errorDetail.toLowerCase().includes('not authorized') || 
            errorDetail.toLowerCase().includes('only mechanics') ||
            error.response.status === 404) {
          showError(
            'Access Denied', 
            'You are not authorized to access this app. Please contact admin or send email to support@wisedrive.com',
            true
          );
        } else {
          showError('Error', errorDetail);
        }
      } else if (error.request) {
        // Request made but no response
        addLog(`No response received`);
        addLog(`Request: ${JSON.stringify(error.request._url || error.request)}`);
        showError('Connection Error', 'No response from server. Please check your internet connection.');
      } else {
        // Error setting up request
        addLog(`Request setup error: ${error.message}`);
        showError('Error', `Request failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter complete OTP');
      return;
    }

    setIsLoading(true);
    
    try {
      const fullPhone = `${countryCode}${phone}`;
      addLog(`Verifying OTP for: ${fullPhone}`);
      addLog(`OTP entered: ${otpString}`);
      addLog(`API URL: ${API_BASE_URL}/auth/verify-otp`);
      
      // Make direct API call with detailed logging
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        phone: fullPhone,
        otp: otpString
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      addLog(`Verify Response Status: ${response.status}`);
      addLog(`Verify Response: ${JSON.stringify(response.data)}`);
      
      if (response.data.success && response.data.token) {
        await login(response.data.token, response.data.mechanicProfile);
        router.replace('/home');
      } else {
        Alert.alert('Error', response.data.message || 'Verification failed');
      }
    } catch (error: any) {
      addLog(`VERIFY ERROR occurred!`);
      
      if (error.response) {
        addLog(`Verify Status Code: ${error.response.status}`);
        addLog(`Verify Error Data: ${JSON.stringify(error.response.data)}`);
        
        const errorMessage = error.response.data?.detail || error.response.data?.message || 'Invalid OTP';
        Alert.alert('Error', errorMessage);
      } else if (error.request) {
        addLog(`No response received for verify`);
        Alert.alert('Error', 'No response from server. Please check your internet connection.');
      } else {
        addLog(`Verify setup error: ${error.message}`);
        Alert.alert('Error', `Verification failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle change number - go back to phone entry
  const handleChangeNumber = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
    setDebugLogs([]); // Clear logs when changing number
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    setIsLoading(true);
    setDebugLogs([]); // Clear previous logs
    
    try {
      const fullPhone = `${countryCode}${phone}`;
      addLog(`Resending OTP for: ${fullPhone}`);
      
      const response = await axios.post(`${API_BASE_URL}/auth/request-otp`, {
        phone: fullPhone
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      addLog(`Resend Response Status: ${response.status}`);
      addLog(`Resend Response: ${JSON.stringify(response.data)}`);
      
      Alert.alert('Success', 'OTP resent successfully');
      setOtp(['', '', '', '', '', '']); // Clear OTP inputs
    } catch (error: any) {
      addLog(`RESEND ERROR occurred!`);
      
      if (error.response) {
        addLog(`Resend Status: ${error.response.status}`);
        addLog(`Resend Error: ${JSON.stringify(error.response.data)}`);
        Alert.alert('Error', error.response.data?.detail || 'Failed to resend OTP');
      } else {
        addLog(`Resend error: ${error.message}`);
        Alert.alert('Error', 'Failed to resend OTP');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Section with Logo */}
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerSection}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Image 
                source={require('../assets/icon.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content Card */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.contentWrapper}
      >
        <View style={styles.contentCard}>
          {step === 'phone' ? (
            <>
              <View style={styles.titleSection}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Sign in with your registered mobile number
                </Text>
              </View>

              {/* Phone Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <View style={[
                  styles.phoneInputContainer,
                  inputFocused && styles.inputFocused
                ]}>
                  <View style={styles.countryCodeBox}>
                    <Text style={styles.countryFlag}>🇮🇳</Text>
                    <Text style={styles.countryCodeText}>{countryCode}</Text>
                  </View>
                  <View style={styles.inputDivider} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter 10 digit number"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                  />
                </View>
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={isLoading || phone.length < 10}
                activeOpacity={0.9}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={phone.length < 10 ? ['#C4C4C4', '#A0A0A0'] : [Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Get OTP</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                By continuing, you agree to our{' '}
                <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>

              {/* Debug Button */}
              <TouchableOpacity 
                onPress={() => setShowDebugModal(true)}
                style={styles.debugButton}
              >
                <Text style={styles.debugButtonText}>📋 View Debug Logs ({debugLogs.length})</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.titleSection}>
                <Text style={styles.title}>Verify OTP</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to{'\n'}
                  <Text style={styles.phoneHighlight}>{countryCode} {phone}</Text>
                </Text>
              </View>

              {/* OTP Inputs */}
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpInputs.current[index] = ref)}
                    style={[
                      styles.otpInput,
                      digit && styles.otpInputFilled
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={isLoading || otp.join('').length !== 6}
                activeOpacity={0.9}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={otp.join('').length !== 6 ? ['#C4C4C4', '#A0A0A0'] : [Colors.gradientStart, Colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend & Change Number */}
              <View style={styles.otpActions}>
                <TouchableOpacity 
                  onPress={handleResendOtp} 
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <Text style={[styles.resendText, isLoading && styles.disabledText]}>
                    Resend OTP
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={handleChangeNumber}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <Text style={[styles.changeNumberText, isLoading && styles.disabledText]}>
                    Change Number
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Debug Button on OTP Screen */}
              <TouchableOpacity 
                onPress={() => setShowDebugModal(true)}
                style={styles.debugButton}
              >
                <Text style={styles.debugButtonText}>📋 View Debug Logs ({debugLogs.length})</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Debug Modal */}
      <Modal
        visible={showDebugModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDebugModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Debug Logs</Text>
              <TouchableOpacity onPress={() => setShowDebugModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.apiUrlText}>API: {API_BASE_URL}</Text>
            <ScrollView style={styles.logsContainer}>
              {debugLogs.length === 0 ? (
                <Text style={styles.noLogsText}>No logs yet. Try sending OTP first.</Text>
              ) : (
                debugLogs.map((log, index) => (
                  <Text key={index} style={styles.logText}>{log}</Text>
                ))
              )}
            </ScrollView>
            <TouchableOpacity 
              onPress={() => setDebugLogs([])}
              style={styles.clearLogsButton}
            >
              <Text style={styles.clearLogsText}>Clear Logs</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  
  // Header
  headerSection: {
    height: height * 0.32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSafeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoBox: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  logoImage: {
    width: 90,
    height: 90,
  },
  
  // Content
  contentWrapper: {
    flex: 1,
    marginTop: -40,
  },
  contentCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  
  // Title
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  phoneHighlight: {
    color: Colors.primary,
    fontWeight: '600',
  },
  
  // Input
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 56,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.white,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  inputDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  
  // Button
  buttonWrapper: {
    marginBottom: 20,
  },
  primaryButton: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  
  // Terms
  termsText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '500',
  },
  
  // OTP
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  otpInput: {
    width: (width - 56 - 48 - 40) / 6,
    height: 54,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  changeNumberText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  disabledText: {
    opacity: 0.5,
  },

  // Debug styles
  debugButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  debugButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  apiUrlText: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logsContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    maxHeight: 300,
  },
  noLogsText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  logText: {
    color: '#00ff00',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
    lineHeight: 16,
  },
  clearLogsButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: Colors.error,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearLogsText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});
