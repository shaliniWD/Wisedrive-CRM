import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';
import { 
  MANUFACTURERS, 
  MANUFACTURE_YEARS, 
  searchManufacturers,
  Manufacturer 
} from '../constants/manufacturers';

interface ManufacturerSelectorProps {
  selectedManufacturer: Manufacturer | null;
  selectedYear: number | null;
  onManufacturerChange: (manufacturer: Manufacturer | null) => void;
  onYearChange: (year: number | null) => void;
}

export function ManufacturerSelector({
  selectedManufacturer,
  selectedYear,
  onManufacturerChange,
  onYearChange,
}: ManufacturerSelectorProps) {
  const [showManufacturerModal, setShowManufacturerModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredManufacturers = useMemo(() => {
    return searchManufacturers(searchQuery);
  }, [searchQuery]);

  const handleSelectManufacturer = useCallback((manufacturer: Manufacturer) => {
    onManufacturerChange(manufacturer);
    setShowManufacturerModal(false);
    setSearchQuery('');
    Keyboard.dismiss();
  }, [onManufacturerChange]);

  const handleSelectYear = useCallback((year: number) => {
    onYearChange(year);
    setShowYearModal(false);
  }, [onYearChange]);

  const renderManufacturerItem = useCallback(({ item }: { item: Manufacturer }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleSelectManufacturer(item)}
      activeOpacity={0.7}
    >
      <View style={styles.listItemContent}>
        <Text style={styles.listItemTitle}>{item.name}</Text>
        <Text style={styles.listItemSubtitle}>{item.country} • {item.region}</Text>
      </View>
      {selectedManufacturer?.id === item.id && (
        <MaterialIcons name="check" size={24} color={Colors.success} />
      )}
    </TouchableOpacity>
  ), [handleSelectManufacturer, selectedManufacturer]);

  const renderYearItem = useCallback(({ item }: { item: number }) => (
    <TouchableOpacity
      style={styles.yearItem}
      onPress={() => handleSelectYear(item)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.yearItemText,
        selectedYear === item && styles.yearItemTextSelected
      ]}>
        {item}
      </Text>
      {selectedYear === item && (
        <MaterialIcons name="check" size={20} color={Colors.success} />
      )}
    </TouchableOpacity>
  ), [handleSelectYear, selectedYear]);

  return (
    <View style={styles.container}>
      {/* Manufacturer Selector */}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setShowManufacturerModal(true)}
        activeOpacity={0.7}
        testID="manufacturer-selector"
      >
        <View style={styles.selectorIcon}>
          <MaterialIcons name="directions-car" size={24} color={Colors.accent} />
        </View>
        <View style={styles.selectorContent}>
          <Text style={styles.selectorLabel}>Vehicle Manufacturer</Text>
          <Text style={[
            styles.selectorValue,
            !selectedManufacturer && styles.selectorPlaceholder
          ]}>
            {selectedManufacturer?.name || 'Select manufacturer'}
          </Text>
        </View>
        <MaterialIcons name="arrow-drop-down" size={24} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Year Selector */}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setShowYearModal(true)}
        activeOpacity={0.7}
        testID="year-selector"
      >
        <View style={styles.selectorIcon}>
          <MaterialIcons name="calendar-today" size={24} color={Colors.accent} />
        </View>
        <View style={styles.selectorContent}>
          <Text style={styles.selectorLabel}>Year of Manufacture</Text>
          <Text style={[
            styles.selectorValue,
            !selectedYear && styles.selectorPlaceholder
          ]}>
            {selectedYear?.toString() || 'Select year'}
          </Text>
        </View>
        <MaterialIcons name="arrow-drop-down" size={24} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Manufacturer Modal */}
      <Modal
        visible={showManufacturerModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowManufacturerModal(false);
          setSearchQuery('');
        }}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Manufacturer</Text>
            <TouchableOpacity
              onPress={() => {
                setShowManufacturerModal(false);
                setSearchQuery('');
              }}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search manufacturers..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID="manufacturer-search-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="clear" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.resultCount}>
            {filteredManufacturers.length} manufacturers found
          </Text>

          <FlatList
            data={filteredManufacturers}
            keyExtractor={(item) => item.id}
            renderItem={renderManufacturerItem}
            keyboardShouldPersistTaps="always"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            getItemLayout={(_, index) => ({
              length: 72,
              offset: 72 * index,
              index,
            })}
          />
        </SafeAreaView>
      </Modal>

      {/* Year Modal */}
      <Modal
        visible={showYearModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowYearModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Year</Text>
            <TouchableOpacity
              onPress={() => setShowYearModal(false)}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={MANUFACTURE_YEARS}
            keyExtractor={(item) => item.toString()}
            renderItem={renderYearItem}
            numColumns={4}
            columnWrapperStyle={styles.yearRow}
            contentContainerStyle={styles.yearListContent}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    minHeight: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectorIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  selectorContent: {
    flex: 1,
  },
  selectorLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginBottom: 2,
  },
  selectorValue: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  selectorPlaceholder: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  closeButton: {
    padding: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.base,
    marginLeft: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  resultCount: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 72,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  listItemSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  yearRow: {
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
  },
  yearListContent: {
    paddingVertical: Spacing.lg,
  },
  yearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    minWidth: 80,
    gap: Spacing.xs,
  },
  yearItemText: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  yearItemTextSelected: {
    color: Colors.success,
    fontWeight: '700',
  },
});
