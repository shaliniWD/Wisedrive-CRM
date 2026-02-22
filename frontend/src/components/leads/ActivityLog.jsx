/**
 * Lead Activity Log Component
 * Displays the activity history for a lead
 */
import React from 'react';
import { formatDateTime } from '@/utils/dateFormat';
import { 
  Activity, Phone, MessageCircle, Users, CheckCircle, 
  AlertCircle, Clock, StickyNote, CreditCard, Bell
} from 'lucide-react';

// Get icon and color for activity type
const getActivityConfig = (action) => {
  const configs = {
    'lead_created': { icon: Users, color: 'text-blue-600 bg-blue-100' },
    'status_changed': { icon: Activity, color: 'text-purple-600 bg-purple-100' },
    'note_added': { icon: StickyNote, color: 'text-yellow-600 bg-yellow-100' },
    'assigned': { icon: Users, color: 'text-green-600 bg-green-100' },
    'reassigned': { icon: Users, color: 'text-orange-600 bg-orange-100' },
    'customer_message': { icon: MessageCircle, color: 'text-green-600 bg-green-100' },
    'chatbot_response': { icon: MessageCircle, color: 'text-blue-600 bg-blue-100' },
    'call_made': { icon: Phone, color: 'text-indigo-600 bg-indigo-100' },
    'payment_link_sent': { icon: CreditCard, color: 'text-purple-600 bg-purple-100' },
    'payment_received': { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-100' },
    'reminder_set': { icon: Bell, color: 'text-amber-600 bg-amber-100' },
    'assignment_failed': { icon: AlertCircle, color: 'text-red-600 bg-red-100' },
  };
  return configs[action] || { icon: Activity, color: 'text-gray-600 bg-gray-100' };
};

// Format activity for display
const formatActivityText = (activity) => {
  switch(activity.action) {
    case 'lead_created':
      return 'Lead created';
    case 'status_changed':
      return `Status changed from "${activity.old_value || 'None'}" to "${activity.new_value}"`;
    case 'note_added':
      return 'Note added';
    case 'assigned':
      return `Assigned to ${activity.new_value || 'a team member'}`;
    case 'reassigned':
      return `Reassigned from ${activity.old_value || 'unassigned'} to ${activity.new_value}`;
    case 'customer_message':
      return 'Customer message received';
    case 'chatbot_response':
      return 'Chatbot response sent';
    case 'payment_link_sent':
      return 'Payment link sent';
    case 'payment_received':
      return 'Payment received';
    case 'reminder_set':
      return `Reminder set for ${activity.new_value}`;
    case 'assignment_failed':
      return activity.details || 'Assignment failed';
    default:
      return activity.action.replace(/_/g, ' ');
  }
};

export const ActivityItem = ({ activity }) => {
  const config = getActivityConfig(activity.action);
  const Icon = config.icon;

  return (
    <div className="flex gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {formatActivityText(activity)}
          </p>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formatDateTime(activity.created_at)}
          </span>
        </div>
        {activity.details && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {activity.details}
          </p>
        )}
        {activity.new_value && activity.action === 'customer_message' && (
          <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded line-clamp-3">
            "{activity.new_value}"
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          by {activity.user_name || 'System'}
        </p>
      </div>
    </div>
  );
};

export const ActivityLog = ({ activities = [], loading = false }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="h-10 w-10 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No activities recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
};

export default ActivityLog;
