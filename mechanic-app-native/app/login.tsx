import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import axios from 'axios';
import { diagLogger } from '../src/lib/diagLogger';
import { getCurrentApiUrl, getEnvironment } from '../src/lib/api';
import { CopyLogsButton } from '../src/components/CopyLogsButton';

// API Base URL
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
  const [errorMessage, setErrorMessage] = useState('');
  
  const otpInputs = useRef<(TextInput | null)[]>([]);

  // Log screen mount
  useEffect(() => {
    diagLogger.info('LOGIN_SCREEN_MOUNTED', {
      apiUrl: API_BASE_URL,
      configuredApiUrl: getCurrentApiUrl(),
      environment: getEnvironment(),
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      version: Platform.Version,
    });
    console.log('[LOGIN] Screen mounted');
    console.log('[LOGIN] API URL:', API_BASE_URL);
    console.log('[LOGIN] Configured API:', getCurrentApiUrl());
    console.log('[LOGIN] Environment:', getEnvironment());
  }, []);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      diagLogger.warn('LOGIN_PHONE_VALIDATION_FAILED', { phoneLength: phone.length });
      setErrorMessage('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    
    const fullPhone = `${countryCode}${phone}`;
    diagLogger.info('LOGIN_OTP_REQUEST_START', { 
      phone: fullPhone,
      apiUrl: API_BASE_URL,
      timestamp: new Date().toISOString()
    });
    console.log('[LOGIN] Requesting OTP for:', fullPhone);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/request-otp`, {
        phone: fullPhone
      });
      
      diagLogger.info('LOGIN_OTP_REQUEST_SUCCESS', {
        phone: fullPhone,
        responseStatus: response.status,
        responseData: response.data,
        timestamp: new Date().toISOString()
      });
      console.log('[LOGIN] OTP request success:', response.data);
      
      setStep('otp');
      // Focus first OTP input after a short delay
      setTimeout(() => {
        otpInputs.current[0]?.focus();
      }, 100);
    } catch (error: any) {
      const errorInfo = {
        phone: fullPhone,
        errorMessage: error.message,
        errorCode: error.code,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        requestMade: !!error.request,
        timestamp: new Date().toISOString()
      };
      diagLogger.error('LOGIN_OTP_REQUEST_FAILED', errorInfo);
      console.log('[LOGIN] OTP request failed:', errorInfo);
      
      if (error.response) {
        const detail = error.response.data?.detail || 'Failed to send OTP';
        setErrorMessage(detail);
      } else if (error.request) {
        setErrorMessage('No response from server. Please check your internet connection.');
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      // Don't show error - button is already disabled
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const fullPhone = `${countryCode}${phone}`;
    diagLogger.info('LOGIN_OTP_VERIFY_START', {
      phone: fullPhone,
      otpLength: otpValue.length,
      apiUrl: API_BASE_URL,
      timestamp: new Date().toISOString()
    });
    console.log('[LOGIN] Verifying OTP for:', fullPhone);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        phone: fullPhone,
        otp: otpValue
      });

      diagLogger.info('LOGIN_OTP_VERIFY_RESPONSE', {
        phone: fullPhone,
        responseStatus: response.status,
        success: response.data.success,
        hasToken: !!response.data.token,
        hasProfile: !!response.data.mechanicProfile,
        profileName: response.data.mechanicProfile?.name,
        profileId: response.data.mechanicProfile?.id,
        profileCities: response.data.mechanicProfile?.inspection_cities,
        timestamp: new Date().toISOString()
      });
      console.log('[LOGIN] OTP verify response:', {
        success: response.data.success,
        hasToken: !!response.data.token,
        profile: response.data.mechanicProfile
      });

      if (response.data.success && response.data.token) {
        diagLogger.info('LOGIN_SUCCESS', {
          phone: fullPhone,
          mechanicId: response.data.mechanicProfile?.id,
          mechanicName: response.data.mechanicProfile?.name,
          cities: response.data.mechanicProfile?.inspection_cities,
          timestamp: new Date().toISOString()
        });
        console.log('[LOGIN] Login successful, navigating to home');
        
        await login(response.data.token, response.data.mechanicProfile);
        router.replace('/home');
      } else {
        diagLogger.warn('LOGIN_VERIFY_UNEXPECTED_RESPONSE', {
          phone: fullPhone,
          response: response.data,
          timestamp: new Date().toISOString()
        });
        setErrorMessage('Verification failed. Please try again.');
      }
    } catch (error: any) {
      const errorInfo = {
        phone: fullPhone,
        errorMessage: error.message,
        errorCode: error.code,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        timestamp: new Date().toISOString()
      };
      diagLogger.error('LOGIN_OTP_VERIFY_FAILED', errorInfo);
      console.log('[LOGIN] OTP verify failed:', errorInfo);
      
      if (error.response) {
        const detail = error.response.data?.detail || 'Invalid OTP';
        setErrorMessage(detail);
      } else {
        setErrorMessage('Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorMessage('');

    // Auto-focus next input
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && value) {
      const completeOtp = newOtp.join('');
      if (completeOtp.length === 6) {
        handleVerifyOtp();
      }
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const fullPhone = `${countryCode}${phone}`;
      await axios.post(`${API_BASE_URL}/auth/request-otp`, { phone: fullPhone });
      // Just clear OTP fields on resend
      setOtp(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } catch (error: any) {
      setErrorMessage('Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
    setErrorMessage('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Copy Logs Button - Top Right */}
      <View style={styles.copyLogsContainer}>
        <CopyLogsButton iconColor="#666" iconSize={22} />
      </View>
      
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo and Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                style={styles.logoGradient}
              >
                <Ionicons name="car-sport" size={40} color={Colors.white} />
              </LinearGradient>
            </View>
            <Text style={styles.brandName}>WiseDrive</Text>
            <Text style={styles.brandTagline}>Mechanic Partner App</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {step === 'phone' ? (
              <>
                <Text style={styles.formTitle}>Welcome Back</Text>
                <Text style={styles.formSubtitle}>Enter your phone number to continue</Text>

                <View style={[styles.phoneInputContainer, inputFocused && styles.inputFocused]}>
                  <View style={styles.countryCodeContainer}>
                    <Text style={styles.countryCode}>{countryCode}</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter phone number"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={(text) => { setPhone(text.replace(/[^0-9]/g, '')); setErrorMessage(''); }}
                    maxLength={10}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                  />
                </View>

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryButton, phone.length < 10 && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={isLoading || phone.length < 10}
                >
                  <LinearGradient
                    colors={phone.length >= 10 ? [Colors.gradientStart, Colors.gradientEnd] : ['#CCC', '#CCC']}
                    style={styles.buttonGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <Text style={styles.buttonText}>Get OTP</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.formTitle}>Verify OTP</Text>
                <Text style={styles.formSubtitle}>
                  Enter the 6-digit code sent to {countryCode} {phone}
                </Text>

                {/* OTP Awaiting Message */}
                <View style={styles.awaitingContainer}>
                  <Ionicons name="time-outline" size={16} color={Colors.primary} />
                  <Text style={styles.awaitingText}>Waiting for SMS verification code...</Text>
                </View>

                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (otpInputs.current[index] = ref)}
                      style={[styles.otpInput, digit && styles.otpInputFilled]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(e) => handleOtpKeyPress(e, index)}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryButton, otp.join('').length < 6 && styles.buttonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={isLoading || otp.join('').length < 6}
                >
                  <LinearGradient
                    colors={otp.join('').length === 6 ? [Colors.gradientStart, Colors.gradientEnd] : ['#CCC', '#CCC']}
                    style={styles.buttonGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <Text style={styles.buttonText}>Verify & Continue</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.otpActions}>
                  <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
                    <Text style={styles.linkText}>Resend OTP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleChangeNumber}>
                    <Text style={styles.linkText}>Change Number</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>By continuing, you agree to our</Text>
            <Text style={styles.footerLink}>Terms of Service & Privacy Policy</Text>
          </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.08,
    paddingBottom: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  formSection: {
    flex: 1,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: Colors.borderFocus,
  },
  countryCodeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  awaitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  awaitingText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  footerLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 4,
  },
});
