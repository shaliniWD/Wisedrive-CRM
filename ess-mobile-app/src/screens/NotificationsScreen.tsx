// Notifications Screen
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useNotifications } from '../context/NotificationContext';
import { getNotifications, markNotificationsRead } from '../services/api';

const NOTIFICATION_ICONS: Record<string, { name: string; color: string }> = {
  leave_approved: { name: 'checkmark-circle', color: '#4CAF50' },
  leave_rejected: { name: 'close-circle', color: '#F44336' },
  leave_request: { name: 'calendar', color: '#FF9800' },
  payslip_available: { name: 'wallet', color: '#2196F3' },
  document_verified: { name: 'document-text', color: '#4CAF50' },
  document_rejected: { name: 'document-text', color: '#F44336' },
  announcement: { name: 'megaphone', color: '#9C27B0' },
  holiday: { name: 'sunny', color: '#FF9800' },
  system: { name: 'information-circle', color: '#607D8B' },
};

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const { refreshUnreadCount } = useNotifications();

  const { data: notificationsData, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
  });

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refreshUnreadCount();
    },
  });

  const handleMarkAllRead = () => {
    markNotificationsRead(undefined, true).then(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refreshUnreadCount();
    });
  };

  const handleNotificationPress = (item: any) => {
    if (!item.is_read) {
      markReadMutation.mutate([item.id]);
    }
    // Navigate based on action_url or type
  };

  const NotificationCard = ({ item }: { item: any }) => {
    const icon = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.system;
    
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
          <Ionicons name={icon.name as any} size={24} color={icon.color} />
        </View>
        
        <View style={styles.content}>
          <Text style={[styles.title, !item.is_read && styles.titleUnread]}>
            {item.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.time}>
            {format(new Date(item.created_at), 'MMM d, h:mm a')}
          </Text>
        </View>
        
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Mark All Read */}
      {notificationsData?.unread_count > 0 && (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {notificationsData.unread_count} unread notification(s)
          </Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notificationsData?.notifications || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 14,
    color: '#666',
  },
  markAllRead: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
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
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: '#E3F2FD',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
});
