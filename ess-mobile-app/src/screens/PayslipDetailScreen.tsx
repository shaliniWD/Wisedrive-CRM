// Professional Payslip Detail Screen - Light Theme
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { getPayslipDetail } from '../services/api';
import { API_BASE_URL, API_ENDPOINTS } from '../services/config';
import { colors, spacing, fontSize, fontWeight, radius, iconSize, shadows } from '../theme';

export default function PayslipDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { payslipId } = route.params;

  const { data: payslip, isLoading } = useQuery({
    queryKey: ['payslipDetail', payslipId],
    queryFn: () => getPayslipDetail(payslipId),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleDownload = async () => {
    try {
      const downloadUrl = `${API_BASE_URL}${API_ENDPOINTS.PAYSLIP_DOWNLOAD(payslipId)}`;
      await Linking.openURL(downloadUrl);
    } catch (error) {
      Alert.alert('Error', 'Failed to download payslip');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const earnings = payslip?.earnings || {};
  const deductions = payslip?.deductions || {};

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="back-btn"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={iconSize.lg} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payslip</Text>
        <TouchableOpacity
          testID="download-btn"
          style={styles.downloadBtn}
          onPress={handleDownload}
        >
          <Ionicons name="download-outline" size={iconSize.lg} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Net Salary Card */}
        <View style={styles.netCard}>
          <LinearGradient
            colors={colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.netGradient}
          >
            <Text style={styles.netLabel}>
              {payslip?.month && payslip?.year 
                ? format(new Date(payslip.year, payslip.month - 1), 'MMMM yyyy')
                : 'Payslip'}
            </Text>
            <Text style={styles.netAmount}>{formatCurrency(payslip?.net_salary)}</Text>
            <Text style={styles.netSub}>Net Salary</Text>
          </LinearGradient>
        </View>

        {/* Summary Row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-up" size={18} color={colors.success} />
            <Text style={styles.summaryLabel}>Gross</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatCurrency(payslip?.gross_salary)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-down" size={18} color={colors.error} />
            <Text style={styles.summaryLabel}>Deductions</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              {formatCurrency(payslip?.total_deductions)}
            </Text>
          </View>
        </View>

        {/* Earnings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.successBg }]}>
              <Ionicons name="add" size={16} color={colors.success} />
            </View>
            <Text style={styles.sectionTitle}>Earnings</Text>
          </View>
          <View style={styles.sectionCard}>
            {Object.keys(earnings).length > 0 ? (
              Object.entries(earnings).map(([key, value]) => (
                <View key={key} style={styles.lineItem}>
                  <Text style={styles.lineLabel}>{formatLabel(key)}</Text>
                  <Text style={styles.lineValue}>{formatCurrency(value as number)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.lineItem}>
                <Text style={styles.lineLabel}>Basic Salary</Text>
                <Text style={styles.lineValue}>{formatCurrency(payslip?.gross_salary)}</Text>
              </View>
            )}
            <View style={[styles.lineItem, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Earnings</Text>
              <Text style={styles.totalValue}>{formatCurrency(payslip?.gross_salary)}</Text>
            </View>
          </View>
        </View>

        {/* Deductions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.errorBg }]}>
              <Ionicons name="remove" size={16} color={colors.error} />
            </View>
            <Text style={styles.sectionTitle}>Deductions</Text>
          </View>
          <View style={styles.sectionCard}>
            {Object.keys(deductions).length > 0 ? (
              Object.entries(deductions).map(([key, value]) => (
                <View key={key} style={styles.lineItem}>
                  <Text style={styles.lineLabel}>{formatLabel(key)}</Text>
                  <Text style={[styles.lineValue, { color: colors.error }]}>
                    -{formatCurrency(value as number)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.lineItem}>
                <Text style={styles.lineLabel}>No deductions</Text>
                <Text style={styles.lineValue}>₹0</Text>
              </View>
            )}
            <View style={[styles.lineItem, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Deductions</Text>
              <Text style={[styles.totalValue, { color: colors.error }]}>
                -{formatCurrency(payslip?.total_deductions)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const formatLabel = (key: string) => {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  downloadBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  netCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  netGradient: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  netLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.sm,
  },
  netAmount: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
  netSub: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  summaryValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  lineValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
});
