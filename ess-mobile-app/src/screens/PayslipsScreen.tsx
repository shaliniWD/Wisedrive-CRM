// Payslips Screen
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getPayslips, getPayslipYears } from '../services/api';

export default function PayslipsScreen() {
  const navigation = useNavigation<any>();
  const [selectedYear, setSelectedYear] = useState<number | undefined>();

  const { data: yearsData } = useQuery({
    queryKey: ['payslipYears'],
    queryFn: getPayslipYears,
  });

  const { data: payslipsData, isLoading, refetch } = useQuery({
    queryKey: ['payslips', selectedYear],
    queryFn: () => getPayslips(1, 24, selectedYear),
  });

  const PayslipCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('PayslipDetail', { payslipId: item.id })}
    >
      <View style={styles.cardLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name="document-text" size={24} color="#2196F3" />
        </View>
        <View>
          <Text style={styles.period}>{item.period}</Text>
          <Text style={styles.status}>
            {item.status === 'paid' ? '✓ Paid' : 'Confirmed'}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardRight}>
        <Text style={styles.amount}>
          {item.currency_symbol}{item.net_salary.toLocaleString()}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Year Filter */}
      <View style={styles.yearFilterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ year: undefined, label: 'All' }, ...(yearsData?.years || []).map((y: number) => ({ year: y, label: y.toString() }))]}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.yearChip, selectedYear === item.year && styles.yearChipActive]}
              onPress={() => setSelectedYear(item.year)}
            >
              <Text style={[styles.yearChipText, selectedYear === item.year && styles.yearChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.yearFilterContent}
        />
      </View>

      {/* Payslips List */}
      <FlatList
        data={payslipsData?.payslips || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PayslipCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No payslips found</Text>
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
  yearFilterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  yearFilterContent: {
    padding: 12,
  },
  yearChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  yearChipActive: {
    backgroundColor: '#2196F3',
  },
  yearChipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  yearChipTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  period: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  status: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
});
