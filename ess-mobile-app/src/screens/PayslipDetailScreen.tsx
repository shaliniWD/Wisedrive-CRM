// Payslip Detail Screen
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { getPayslipDetail } from '../services/api';

export default function PayslipDetailScreen() {
  const route = useRoute<any>();
  const { payslipId } = route.params;

  const { data: payslip, isLoading } = useQuery({
    queryKey: ['payslipDetail', payslipId],
    queryFn: () => getPayslipDetail(payslipId),
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!payslip) {
    return (
      <View style={styles.loading}>
        <Text>Payslip not found</Text>
      </View>
    );
  }

  const handleDownload = () => {
    if (payslip.pdf_url) {
      Linking.openURL(payslip.pdf_url);
    } else {
      Alert.alert('Not Available', 'Payslip PDF is not available yet');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.period}>{payslip.period}</Text>
        <Text style={styles.companyName}>{payslip.company_name}</Text>
        <View style={styles.netSalaryContainer}>
          <Text style={styles.netSalaryLabel}>Net Salary</Text>
          <Text style={styles.netSalary}>
            {payslip.currency_symbol}{payslip.net_salary.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Employee Info */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Employee</Text>
          <Text style={styles.infoValue}>{payslip.employee_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Employee Code</Text>
          <Text style={styles.infoValue}>{payslip.employee_code}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Working Days</Text>
          <Text style={styles.infoValue}>{payslip.days_worked} / {payslip.working_days}</Text>
        </View>
        {payslip.lop_days > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>LOP Days</Text>
            <Text style={[styles.infoValue, { color: '#F44336' }]}>{payslip.lop_days}</Text>
          </View>
        )}
      </View>

      {/* Earnings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earnings</Text>
        {payslip.earnings.map((earning: any, index: number) => (
          <View key={index} style={styles.lineItem}>
            <Text style={styles.lineItemLabel}>{earning.name}</Text>
            <Text style={styles.lineItemValue}>
              {payslip.currency_symbol}{earning.amount.toLocaleString()}
            </Text>
          </View>
        ))}
        <View style={[styles.lineItem, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Earnings</Text>
          <Text style={styles.totalValue}>
            {payslip.currency_symbol}{payslip.total_earnings.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Deductions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deductions</Text>
        {payslip.deductions.map((deduction: any, index: number) => (
          <View key={index} style={styles.lineItem}>
            <Text style={styles.lineItemLabel}>{deduction.name}</Text>
            <Text style={[styles.lineItemValue, { color: '#F44336' }]}>
              -{payslip.currency_symbol}{deduction.amount.toLocaleString()}
            </Text>
          </View>
        ))}
        <View style={[styles.lineItem, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Deductions</Text>
          <Text style={[styles.totalValue, { color: '#F44336' }]}>
            -{payslip.currency_symbol}{payslip.total_deductions.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Summary */}
      <View style={[styles.section, styles.summarySection]}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Net Salary</Text>
          <Text style={styles.summaryValue}>
            {payslip.currency_symbol}{payslip.net_salary.toLocaleString()}
          </Text>
        </View>
        {payslip.payment_date && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Date</Text>
            <Text style={styles.summarySubValue}>{payslip.payment_date}</Text>
          </View>
        )}
      </View>

      {/* Download Button */}
      <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
        <Ionicons name="download" size={20} color="#fff" />
        <Text style={styles.downloadButtonText}>Download PDF</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 24,
    alignItems: 'center',
  },
  period: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  companyName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  netSalaryContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  netSalaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  netSalary: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  lineItemLabel: {
    color: '#666',
    fontSize: 14,
  },
  lineItemValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  totalValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summarySection: {
    backgroundColor: '#E3F2FD',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#1976D2',
    fontSize: 24,
    fontWeight: 'bold',
  },
  summarySubValue: {
    color: '#1976D2',
    fontSize: 14,
  },
  downloadButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
