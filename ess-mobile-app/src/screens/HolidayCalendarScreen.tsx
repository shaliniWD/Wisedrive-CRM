// Modern Holiday Calendar Screen
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
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import { getHolidays } from '../services/api';
import { colors, spacing, borderRadius, shadows } from '../theme';

const HOLIDAY_COLORS: Record<string, { bg: string; text: string }> = {
  public: { bg: '#D1FAE5', text: '#059669' },
  national: { bg: '#DBEAFE', text: '#2563EB' },
  regional: { bg: '#FEF3C7', text: '#D97706' },
  optional: { bg: '#F3E8FF', text: '#9333EA' },
  restricted: { bg: '#F3F4F6', text: '#6B7280' },
};

export default function HolidayCalendarScreen() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['holidays', selectedYear],
    queryFn: () => getHolidays(selectedYear),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const holidays = data?.holidays || [];

  const getHolidayStatus = (dateStr: string) => {
    const holidayDate = parseISO(dateStr);
    const today = new Date();
    
    if (isToday(holidayDate)) return 'today';
    if (isBefore(holidayDate, today)) return 'past';
    return 'upcoming';
  };

  const upcomingHolidays = holidays.filter((h: any) => {
    const status = getHolidayStatus(h.date);
    return status === 'upcoming' || status === 'today';
  });

  const renderHoliday = ({ item }: { item: any }) => {
    const status = getHolidayStatus(item.date);
    const holidayDate = parseISO(item.date);
    const typeColor = HOLIDAY_COLORS[item.type] || HOLIDAY_COLORS.public;
    const isPast = status === 'past';
    const isCurrentDay = status === 'today';

    return (
      <View style={[
        styles.holidayCard,
        isPast && styles.holidayCardPast,
        isCurrentDay && styles.holidayCardToday,
      ]}>
        {/* Date Section */}
        <View style={[styles.dateSection, { backgroundColor: isPast ? colors.background.subtle : colors.primary.light }]}>
          <Text style={[styles.dateDay, isPast && styles.textPast]}>
            {format(holidayDate, 'd')}
          </Text>
          <Text style={[styles.dateMonth, isPast && styles.textPast]}>
            {format(holidayDate, 'MMM')}
          </Text>
          <Text style={[styles.dateWeekday, isPast && styles.textPast]}>
            {format(holidayDate, 'EEE')}
          </Text>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Text style={[styles.holidayName, isPast && styles.textPast]}>
              {item.name}
            </Text>
            {isCurrentDay && (
              <View style={styles.todayBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.todayText}>Today</Text>
              </View>
            )}
          </View>

          <View style={styles.infoFooter}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
              <Text style={[styles.typeText, { color: typeColor.text }]}>
                {item.type?.charAt(0).toUpperCase() + item.type?.slice(1)}
              </Text>
            </View>
            {item.is_optional && (
              <View style={styles.optionalBadge}>
                <Text style={styles.optionalText}>Optional</Text>
              </View>
            )}
          </View>

          {item.description && (
            <Text style={[styles.description, isPast && styles.textPast]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary.default, colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Holiday Calendar</Text>
        
        {/* Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{holidays.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#4ADE80' }]}>{upcomingHolidays.length}</Text>
            <Text style={styles.summaryLabel}>Upcoming</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Year Selector */}
      <View style={styles.yearSelectorContainer}>
        <View style={styles.yearSelector}>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(selectedYear - 1)}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary.default} />
          </TouchableOpacity>

          <View style={styles.yearDisplay}>
            <Ionicons name="calendar" size={18} color={colors.primary.default} />
            <Text style={styles.yearDisplayText}>{selectedYear}</Text>
          </View>

          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(selectedYear + 1)}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.primary.default} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Holidays List */}
      <FlatList
        data={holidays}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={renderHoliday}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={64} color={colors.text.muted} />
            <Text style={styles.emptyText}>No holidays found</Text>
            <Text style={styles.emptySubtext}>No holidays configured for {selectedYear}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.lg,
  },
  yearSelectorContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    ...shadows.md,
  },
  yearButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  yearDisplayText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  holidayCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  holidayCardPast: {
    opacity: 0.6,
  },
  holidayCardToday: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  dateSection: {
    width: 72,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary.default,
  },
  dateMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.default,
    marginTop: 2,
  },
  dateWeekday: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 4,
  },
  textPast: {
    color: colors.text.muted,
  },
  infoSection: {
    flex: 1,
    padding: spacing.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  todayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  optionalBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  optionalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
});
