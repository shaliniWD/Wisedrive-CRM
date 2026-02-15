// Leave Apply Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format, addDays, differenceInDays } from 'date-fns';
import { applyLeave } from '../services/api';

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual Leave', icon: 'sunny', color: '#4CAF50' },
  { value: 'sick', label: 'Sick Leave', icon: 'medkit', color: '#FF9800' },
  { value: 'earned', label: 'Earned Leave', icon: 'star', color: '#2196F3' },
  { value: 'unpaid', label: 'Unpaid Leave', icon: 'remove-circle', color: '#9E9E9E' },
];

export default function LeaveApplyScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [leaveType, setLeaveType] = useState('casual');
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<'first_half' | 'second_half'>('first_half');

  const mutation = useMutation({
    mutationFn: applyLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveHistory'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalance'] });
      Alert.alert('Success', 'Leave request submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit leave request');
    },
  });

  const calculateDays = () => {
    if (isHalfDay) return 0.5;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return differenceInDays(end, start) + 1;
  };

  const handleSubmit = () => {
    if (!reason || reason.length < 10) {
      Alert.alert('Error', 'Please provide a reason (at least 10 characters)');
      return;
    }

    mutation.mutate({
      leave_type: leaveType,
      start_date: startDate,
      end_date: isHalfDay ? startDate : endDate,
      reason,
      is_half_day: isHalfDay,
      half_day_type: isHalfDay ? halfDayType : undefined,
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Leave Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leave Type</Text>
        <View style={styles.leaveTypesGrid}>
          {LEAVE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.leaveTypeCard,
                leaveType === type.value && styles.leaveTypeCardActive,
              ]}
              onPress={() => setLeaveType(type.value)}
            >
              <Ionicons
                name={type.icon as any}
                size={24}
                color={leaveType === type.value ? '#fff' : type.color}
              />
              <Text
                style={[
                  styles.leaveTypeLabel,
                  leaveType === type.value && styles.leaveTypeLabelActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Half Day Toggle */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setIsHalfDay(!isHalfDay)}
        >
          <View style={[styles.checkbox, isHalfDay && styles.checkboxChecked]}>
            {isHalfDay && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>Half Day Leave</Text>
        </TouchableOpacity>

        {isHalfDay && (
          <View style={styles.halfDayOptions}>
            <TouchableOpacity
              style={[
                styles.halfDayOption,
                halfDayType === 'first_half' && styles.halfDayOptionActive,
              ]}
              onPress={() => setHalfDayType('first_half')}
            >
              <Text style={halfDayType === 'first_half' ? styles.halfDayTextActive : styles.halfDayText}>
                First Half
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.halfDayOption,
                halfDayType === 'second_half' && styles.halfDayOptionActive,
              ]}
              onPress={() => setHalfDayType('second_half')}
            >
              <Text style={halfDayType === 'second_half' ? styles.halfDayTextActive : styles.halfDayText}>
                Second Half
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Date Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dates</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Start Date</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        {!isHalfDay && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>End Date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
        )}

        <View style={styles.daysCounter}>
          <Text style={styles.daysCounterText}>
            Total Days: <Text style={styles.daysCounterValue}>{calculateDays()}</Text>
          </Text>
        </View>
      </View>

      {/* Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Please provide a reason for your leave request..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{reason.length}/500</Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, mutation.isPending && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Submit Request</Text>
          </>
        )}
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
    marginBottom: 16,
  },
  leaveTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  leaveTypeCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  leaveTypeCardActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  leaveTypeLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  leaveTypeLabelActive: {
    color: '#fff',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  halfDayOptions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  halfDayOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  halfDayOptionActive: {
    backgroundColor: '#2196F3',
  },
  halfDayText: {
    color: '#666',
  },
  halfDayTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 120,
  },
  charCount: {
    textAlign: 'right',
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  daysCounter: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  daysCounterText: {
    fontSize: 16,
    color: '#1976D2',
  },
  daysCounterValue: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
