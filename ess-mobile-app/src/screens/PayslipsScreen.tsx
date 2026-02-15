// Modern Payslips Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPayslips, getPayslipYears } from '../services/api';
import { colors, spacing, fontSize, radius, iconSize } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PayslipsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [refreshing, setRefreshing] = useState(false);

  const { data: payslipsData, refetch } = useQuery({
    queryKey: ['payslips', selectedYear],
    queryFn: () => getPayslips(selectedYear),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const payslips = payslipsData?.payslips || [];

  const formatCurrency = (amount: number, symbol: string = '₹') => {
    return `${symbol}${amount?.toLocaleString('en-IN') || 0}`;
  };

  const renderPayslip = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.payslipCard}
      onPress={() => navigation.navigate('PayslipDetail', { payslipId: item.id })}
    >
      <View style={styles.monthBadge}>
        <Text style={styles.monthText}>{MONTHS[item.month - 1]}</Text>
      </View>
      <View style={styles.payslipInfo}>
        <Text style={styles.netSalary}>{formatCurrency(item.net_salary, item.currency_symbol)}</Text>
        <Text style={styles.payslipMeta}>
          Gross: {formatCurrency(item.gross_salary, item.currency_symbol)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={iconSize.md} color={colors.text.tertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payslips</Text>
      </View>

      {/* Year Selector */}
      <View style={styles.yearSelector}>
        <TouchableOpacity onPress={() => setSelectedYear(selectedYear - 1)} style={styles.yearBtn}>
          <Ionicons name="chevron-back" size={iconSize.md} color={colors.primary.default} />
        </TouchableOpacity>
        <Text style={styles.yearText}>{selectedYear}</Text>
        <TouchableOpacity onPress={() => setSelectedYear(selectedYear + 1)} style={styles.yearBtn}>
          <Ionicons name="chevron-forward" size={iconSize.md} color={colors.primary.default} />
        </TouchableOpacity>
      </View>

      {/* Payslips List */}
      <FlatList
        data={payslips}
        keyExtractor={(item) => item.id}
        renderItem={renderPayslip}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={40} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No payslips for {selectedYear}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  yearBtn: {
    padding: spacing.sm,
  },
  yearText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginHorizontal: spacing.xl,
  },
  listContent: {
    padding: spacing.lg,
  },
  payslipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  monthBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary.default,
  },
  payslipInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  netSalary: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  payslipMeta: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});
