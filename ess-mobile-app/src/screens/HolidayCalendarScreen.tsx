// Holiday Calendar Screen
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
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import { getHolidays } from '../services/api';

const HOLIDAY_COLORS: Record<string, string> = {
  public: '#4CAF50',
  national: '#2196F3',
  regional: '#FF9800',
  optional: '#9C27B0',
  restricted: '#607D8B',
};

export default function HolidayCalendarScreen() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['holidays', selectedYear],
    queryFn: () => getHolidays(selectedYear),
  });

  const holidays = data?.holidays || [];

  const getHolidayStatus = (dateStr: string) => {
    const holidayDate = parseISO(dateStr);
    const today = new Date();
    
    if (isToday(holidayDate)) return 'today';
    if (isBefore(holidayDate, today)) return 'past';
    return 'upcoming';
  };

  const renderHoliday = ({ item }: { item: any }) => {
    const status = getHolidayStatus(item.date);
    const holidayDate = parseISO(item.date);
    const color = HOLIDAY_COLORS[item.type] || HOLIDAY_COLORS.public;

    return (
      <View style={[
        styles.holidayCard,
        status === 'past' && styles.pastHoliday,
        status === 'today' && styles.todayHoliday,
      ]}>
        <View style={[styles.dateContainer, { backgroundColor: color + '20' }]}>
          <Text style={[styles.dateDay, { color }]}>
            {format(holidayDate, 'd')}
          </Text>
          <Text style={[styles.dateMonth, { color }]}>
            {format(holidayDate, 'MMM')}
          </Text>
          <Text style={styles.dateWeekday}>
            {format(holidayDate, 'EEE')}
          </Text>
        </View>
        
        <View style={styles.holidayInfo}>
          <View style={styles.holidayHeader}>
            <Text style={[
              styles.holidayName,
              status === 'past' && styles.pastText
            ]}>
              {item.name}
            </Text>
            {item.is_optional && (
              <View style={styles.optionalBadge}>
                <Text style={styles.optionalText}>Optional</Text>
              </View>
            )}
          </View>
          
          <View style={styles.holidayMeta}>
            <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.typeText, { color }]}>
                {item.type?.charAt(0).toUpperCase() + item.type?.slice(1)}
              </Text>
            </View>
            
            {status === 'today' && (
              <View style={styles.todayBadge}>
                <Ionicons name="star" size={12} color="#FF9800" />
                <Text style={styles.todayText}>Today</Text>
              </View>
            )}
          </View>
          
          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const upcomingHolidays = holidays.filter((h: any) => 
    getHolidayStatus(h.date) === 'upcoming' || getHolidayStatus(h.date) === 'today'
  );
  
  const pastHolidays = holidays.filter((h: any) => 
    getHolidayStatus(h.date) === 'past'
  );

  return (
    <View style={styles.container}>
      {/* Year Selector */}
      <View style={styles.yearSelector}>
        <TouchableOpacity 
          style={styles.yearButton}
          onPress={() => setSelectedYear(selectedYear - 1)}
        >
          <Ionicons name="chevron-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <Text style={styles.yearText}>{selectedYear}</Text>
        
        <TouchableOpacity 
          style={styles.yearButton}
          onPress={() => setSelectedYear(selectedYear + 1)}
        >
          <Ionicons name="chevron-forward" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{holidays.length}</Text>
          <Text style={styles.summaryLabel}>Total Holidays</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
            {upcomingHolidays.length}
          </Text>
          <Text style={styles.summaryLabel}>Upcoming</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#9E9E9E' }]}>
            {pastHolidays.length}
          </Text>
          <Text style={styles.summaryLabel}>Past</Text>
        </View>
      </View>

      {/* Holiday List */}
      <FlatList
        data={holidays}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={renderHoliday}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No holidays found for {selectedYear}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  yearButton: {
    padding: 8,
  },
  yearText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 24,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#eee',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  holidayCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  pastHoliday: {
    opacity: 0.6,
  },
  todayHoliday: {
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  dateContainer: {
    width: 70,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  dateMonth: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateWeekday: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  holidayInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  holidayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  pastText: {
    color: '#999',
  },
  optionalBadge: {
    backgroundColor: '#FF980020',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '600',
  },
  holidayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  todayText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 4,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});
