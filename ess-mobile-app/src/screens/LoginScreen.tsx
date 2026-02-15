// Premium Login Screen - Dark Theme
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize, fontWeight, radius, shadows } from '../theme';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const { login, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      {/* Background */}
      <LinearGradient
        colors={['#0B1120', '#1E293B', '#0B1120']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative Elements */}
      <View style={[styles.glowOrb, styles.glowOrb1]} />
      <View style={[styles.glowOrb, styles.glowOrb2]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={[styles.content, { paddingTop: insets.top + spacing.xxxxl }]}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={colors.gradients.primary}
                style={styles.logoGradient}
              >
                <Ionicons name="car-sport" size={28} color="#FFF" />
              </LinearGradient>
            </View>
            <Text style={styles.brandName}>WiseDrive</Text>
            <Text style={styles.tagline}>Employee Self-Service</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formSection}>
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.subtitleText}>Sign in to your account</Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'email' && styles.inputFocused
              ]}>
                <Ionicons 
                  name="mail-outline" 
                  size={18} 
                  color={focusedInput === 'email' ? colors.primary : colors.text.tertiary} 
                />
                <TextInput
                  testID="email-input"
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[
                styles.inputWrapper,
                focusedInput === 'password' && styles.inputFocused
              ]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={18} 
                  color={focusedInput === 'password' ? colors.primary : colors.text.tertiary} 
                />
                <TextInput
                  testID="password-input"
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.text.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity
                  testID="toggle-password-btn"
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              testID="login-button"
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Text style={styles.footerText}>Powered by WiseDrive</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  glowOrb1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
  },
  glowOrb2: {
    width: 200,
    height: 200,
    bottom: 100,
    left: -80,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxxl,
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoGradient: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitleText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
    flex: 1,
  },
  inputGroup: {
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text.primary,
    height: '100%',
  },
  loginButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
});
