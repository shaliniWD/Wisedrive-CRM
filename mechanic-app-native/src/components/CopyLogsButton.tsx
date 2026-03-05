import React, { useState } from 'react';
import { TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { diagLogger } from '../lib/diagLogger';

interface CopyLogsButtonProps {
  style?: any;
  iconSize?: number;
  iconColor?: string;
}

export const CopyLogsButton: React.FC<CopyLogsButtonProps> = ({ 
  style, 
  iconSize = 24, 
  iconColor = '#666' 
}) => {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyLogs = async () => {
    try {
      setIsCopying(true);
      const logsText = await diagLogger.getLogsAsText();
      
      if (!logsText || logsText.trim() === '') {
        Alert.alert('No Logs', 'No diagnostic logs available to copy.');
        return;
      }
      
      await Clipboard.setStringAsync(logsText);
      Alert.alert('Copied!', 'Diagnostic logs copied to clipboard. You can now paste them to share.');
    } catch (error: any) {
      console.error('Failed to copy logs:', error);
      Alert.alert('Error', 'Failed to copy logs: ' + error.message);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={handleCopyLogs}
      disabled={isCopying}
    >
      {isCopying ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name="copy-outline" size={iconSize} color={iconColor} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});

export default CopyLogsButton;
