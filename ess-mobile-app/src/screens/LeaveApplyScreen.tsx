// Professional Leave Apply Screen - Light Theme
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInDays, addDays } from 'date-fns';
import { applyLeave } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';

const LEAVE_TYPES = [
  { id: 'casual', label: 'Casual Leave', color: colors.success },
  { id: 'sick', label: 'Sick Leave', color: colors.warning },
  { id: 'earned', label: 'Earned Leave', color: colors.primary },
];

export default function LeaveApplyScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [leaveType, setLeaveType] = useState('casual');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');

  const days = differenceInDays(endDate, startDate) + 1;

  const mutation = useMutation({
    mutationFn: applyLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveHistory'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalance'] });
      Alert.alert('Success', 'Leave request submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to submit leave request');
    },
  });

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (!reason.trim()) {
      Alert.alert('Error', 'Please enter a reason for leave');
      return;
    }
    if (days <= 0) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    mutation.mutate({
      leave_type: leaveType,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      reason: reason.trim(),
    });
  };

  const adjustDate = (type: 'start' | 'end', direction: 'prev' | 'next') => {
    const delta = direction === 'next' ? 1 : -1;
    if (type === 'start') {
      const newDate = addDays(startDate, delta);
      setStartDate(newDate);
      if (newDate > endDate) setEndDate(newDate);
    } else {
      const newDate = addDays(endDate, delta);
      if (newDate >= startDate) setEndDate(newDate);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
          <Text style={styles.headerTitle}>Apply Leave</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Leave Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Leave Type</Text>
            <View style={styles.typeGrid}>
              {LEAVE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  testID={`leave-type-${type.id}`}
                  style={[
                    styles.typeCard,
                    leaveType === type.id && styles.typeCardActive,
                    leaveType === type.id && { borderColor: type.color },
                  ]}
                  onPress={() => setLeaveType(type.id)}
                >
                  <View style={[styles.typeIndicator, { backgroundColor: type.color }]} />
                  <Text style={[
                    styles.typeLabel,
                    leaveType === type.id && { color: colors.text.primary },
                  ]}>
                    {type.label}
                  </Text>
                  {leaveType === type.id && (
                    <Ionicons name="checkmark-circle" size={18} color={type.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateCard}>
                <Text style={styles.dateLabel}>From</Text>
                <View style={styles.dateSelector}>
                  <TouchableOpacity onPress={() => adjustDate('start', 'prev')}>
                    <Ionicons name="chevron-back" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                  <Text style={styles.dateValue}>{format(startDate, 'MMM d, yyyy')}</Text>
                  <TouchableOpacity onPress={() => adjustDate('start', 'next')}>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.dateCard}>
                <Text style={styles.dateLabel}>To</Text>
                <View style={styles.dateSelector}>
                  <TouchableOpacity onPress={() => adjustDate('end', 'prev')}>
                    <Ionicons name="chevron-back" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                  <Text style={styles.dateValue}>{format(endDate, 'MMM d, yyyy')}</Text>
                  <TouchableOpacity onPress={() => adjustDate('end', 'next')}>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.daysCard}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.daysText}>
                {days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Invalid duration'}
              </Text>
            </View>
          </View>

          {/* Reason */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Reason</Text>
            <TextInput
              testID="reason-input"
              style={styles.reasonInput}
              placeholder="Enter reason for leave..."
              placeholderTextColor={colors.text.tertiary}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <TouchableOpacity
            testID="submit-btn"
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={mutation.isPending}
          >
            <LinearGradient
              colors={colors.gradients.primary}
              style={styles.submitBtnGradient}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeGrid: {
    gap: spacing.md,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  typeCardActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
  },
  typeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeLabel: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dateCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  daysCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  daysText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  reasonInput: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    fontSize: fontSize.base,
    color: colors.text.primary,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  submitBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
