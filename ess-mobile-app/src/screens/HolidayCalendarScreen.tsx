// Premium Holiday Calendar Screen - Dark Theme
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isSameMonth, parseISO, isAfter } from 'date-fns';
import { getHolidays } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';

export default function HolidayCalendarScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holidays', selectedYear],
    queryFn: () => getHolidays(selectedYear),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['holidays'] });
    setRefreshing(false);
  };

  // Group holidays by month
  const groupedHolidays = React.useMemo(() => {
    if (!holidays?.length) return {};
    
    const groups: { [key: string]: any[] } = {};
    holidays.forEach((holiday: any) => {
      const date = parseISO(holiday.date);
      const monthKey = format(date, 'MMMM');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(holiday);
    });
    return groups;
  }, [holidays]);

  const today = new Date();
  const upcomingCount = holidays?.filter((h: any) => isAfter(parseISO(h.date), today)).length || 0;

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
        <Text style={styles.headerTitle}>Holidays</Text>
        <View style={styles.yearSelector}>
          <TouchableOpacity
            testID="prev-year"
            onPress={() => setSelectedYear(y => y - 1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}</Text>
          <TouchableOpacity
            testID="next-year"
            onPress={() => setSelectedYear(y => y + 1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Card */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="sunny" size={20} color={colors.warning} />
            <Text style={styles.statValue}>{holidays?.length || 0}</Text>
            <Text style={styles.statLabel}>Total Holidays</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={20} color={colors.accent} />
            <Text style={styles.statValue}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : Object.keys(groupedHolidays).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No holidays found for {selectedYear}</Text>
          </View>
        ) : (
          Object.entries(groupedHolidays).map(([month, monthHolidays]) => (
            <View key={month} style={styles.monthSection}>
              <Text style={styles.monthTitle}>{month}</Text>
              {monthHolidays.map((holiday: any) => {
                const holidayDate = parseISO(holiday.date);
                const isPast = !isAfter(holidayDate, today) && !isSameMonth(holidayDate, today);
                
                return (
                  <View 
                    key={holiday.id} 
                    style={[styles.holidayCard, isPast && styles.holidayCardPast]}
                  >
                    <View style={styles.dateBox}>
                      <Text style={[styles.dateDay, isPast && styles.textPast]}>
                        {format(holidayDate, 'd')}
                      </Text>
                      <Text style={[styles.dateWeekday, isPast && styles.textPast]}>
                        {format(holidayDate, 'EEE')}
                      </Text>
                    </View>
                    <View style={styles.holidayInfo}>
                      <Text style={[styles.holidayName, isPast && styles.textPast]} numberOfLines={1}>
                        {holiday.name}
                      </Text>
                      {holiday.type && (
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeText}>{holiday.type}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
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
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  yearText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    minWidth: 40,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingTop: 0,
    paddingBottom: spacing.xxxxl,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    paddingVertical: spacing.xxxxl,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxxl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  // Month Section
  monthSection: {
    marginBottom: spacing.xl,
  },
  monthTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Holiday Card
  holidayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  holidayCardPast: {
    opacity: 0.5,
  },
  dateBox: {
    width: 48,
    height: 48,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  dateWeekday: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  textPast: {
    color: colors.text.tertiary,
  },
  holidayInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  holidayName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  typeText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
});
