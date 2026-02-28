import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';
import { getScanSession } from '../../src/services/database';
import { ScanSession, DTCResult, RawECUResponse, DTCCategoryColors } from '../../src/types';
import { formatDateTime } from '../../src/utils/dateFormat';

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (id) {
      getScanSession(id).then((data) => {
        setSession(data);
        setLoading(false);
      });
    }
  }, [id]);

  const copySessionData = async () => {
    if (!session) return;
    const data = JSON.stringify(session, null, 2);
    await Clipboard.setStringAsync(data);
    Alert.alert('Copied', 'Session data copied to clipboard');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialIcons name="error-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  const totalDTCs =
    session.storedDTCs.length +
    session.pendingDTCs.length +
    session.permanentDTCs.length;

  const renderDTCList = (title: string, dtcs: DTCResult[]) => (
    <View style={styles.dtcSection}>
      <Text style={styles.dtcSectionTitle}>
        {title} ({dtcs.length})
      </Text>
      {dtcs.length === 0 ? (
        <View style={styles.noDtc}>
          <MaterialIcons name="check" size={16} color={Colors.success} />
          <Text style={styles.noDtcText}>None found</Text>
        </View>
      ) : (
        dtcs.map((dtc) => (
          <View key={dtc.code} style={styles.dtcItem} testID={`detail-dtc-${dtc.code}`}>
            <View style={styles.dtcRow}>
              <View
                style={[
                  styles.dtcBadge,
                  {
                    backgroundColor: DTCCategoryColors[dtc.category] + '20',
                    borderColor: DTCCategoryColors[dtc.category],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dtcCode,
                    { color: DTCCategoryColors[dtc.category] },
                  ]}
                >
                  {dtc.code}
                </Text>
              </View>
              <Text style={styles.dtcCategory}>{dtc.categoryName}</Text>
            </View>
            <Text style={styles.dtcDesc}>{dtc.description}</Text>
            <Text style={styles.dtcHex}>
              RAW: 0x{dtc.rawHex} | Mode: {dtc.mode}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  const renderECUResponse = (resp: RawECUResponse) => (
    <View key={resp.id} style={styles.ecuItem}>
      <View style={styles.ecuHeader}>
        <Text style={styles.ecuCommand}>CMD: {resp.command}</Text>
        <Text style={styles.ecuLatency}>{resp.latencyMs}ms</Text>
      </View>
      <Text style={styles.ecuDetail}>TX ASCII: {resp.txAscii}</Text>
      <Text style={styles.ecuDetail}>TX HEX: {resp.txHex}</Text>
      <Text style={styles.ecuDetail}>RX ASCII: {resp.rxAscii}</Text>
      <Text style={styles.ecuDetail}>RX HEX: {resp.rxHex}</Text>
      <Text style={styles.ecuDetail}>
        RX RAW: {resp.rxRaw?.replace(/[\r\n]/g, '\\n')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Details</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialIcons
              name={session.status === 'completed' ? 'check-circle' : 'error'}
              size={24}
              color={session.status === 'completed' ? Colors.success : Colors.error}
            />
            <Text style={styles.summaryStatus}>
              {session.status.toUpperCase()}
            </Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>
                {new Date(session.timestamp).toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{session.duration}s</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Protocol</Text>
              <Text style={styles.summaryValue}>{session.protocol}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total DTCs</Text>
              <Text
                style={[
                  styles.summaryValue,
                  totalDTCs > 0 && { color: Colors.error },
                ]}
              >
                {totalDTCs}
              </Text>
            </View>
          </View>
          {session.errorSummary && (
            <View style={styles.errorSummary}>
              <MaterialIcons name="warning" size={16} color={Colors.error} />
              <Text style={styles.errorSummaryText}>{session.errorSummary}</Text>
            </View>
          )}
        </View>

        {renderDTCList('Stored DTCs (Mode 03)', session.storedDTCs)}
        {renderDTCList('Pending DTCs (Mode 07)', session.pendingDTCs)}
        {renderDTCList('Permanent DTCs (Mode 0A)', session.permanentDTCs)}

        <View style={styles.rawSection}>
          <TouchableOpacity
            testID="toggle-raw-btn"
            style={styles.rawToggle}
            onPress={() => setShowRaw(!showRaw)}
          >
            <Text style={styles.rawToggleText}>
              Raw ECU Responses ({session.rawECUResponses.length})
            </Text>
            <MaterialIcons
              name={showRaw ? 'expand-less' : 'expand-more'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
          {showRaw &&
            session.rawECUResponses.map((resp) => renderECUResponse(resp))}
        </View>

        <TouchableOpacity
          testID="copy-session-btn"
          style={styles.copyButton}
          onPress={copySessionData}
        >
          <MaterialIcons name="content-copy" size={18} color={Colors.accent} />
          <Text style={styles.copyButtonText}>Copy Session Data (JSON)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: Spacing.sm },
  headerTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: { color: Colors.textMuted, fontSize: FontSize.base },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryStatus: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  summaryItem: { width: '46%' },
  summaryLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  summaryValue: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '600',
    marginTop: 2,
  },
  errorSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: Colors.error + '10',
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  errorSummaryText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  dtcSection: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  dtcSectionTitle: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  noDtc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  noDtcText: { color: Colors.success, fontSize: FontSize.sm },
  dtcItem: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dtcRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dtcBadge: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  dtcCode: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  dtcCategory: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  dtcDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  dtcHex: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: 'monospace',
    marginTop: Spacing.xs,
  },
  rawSection: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  rawToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rawToggleText: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  ecuItem: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  ecuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  ecuCommand: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  ecuLatency: { color: Colors.textMuted, fontSize: FontSize.xs },
  ecuDetail: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  copyButtonText: {
    color: Colors.accent,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
