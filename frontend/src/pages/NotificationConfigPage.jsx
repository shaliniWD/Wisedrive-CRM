// Notification Configuration Page - HR can manage push notification settings
import React, { useState, useEffect } from 'react';
import { Bell, Send, Settings, Users, Globe, RefreshCw, CheckCircle, X, Edit2, Save, TestTube, Smartphone, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NotificationConfigPage = () => {
  const [triggers, setTriggers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('triggers');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [countries, setCountries] = useState([]);
  const [expandedTrigger, setExpandedTrigger] = useState(null);

  useEffect(() => {
    fetchData();
    fetchCountries();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [triggersRes, templatesRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/notification-config/triggers`),
        axios.get(`${API_URL}/api/notification-config/templates`),
        axios.get(`${API_URL}/api/notification-config/stats`),
      ]);
      setTriggers(triggersRes.data);
      setTemplates(templatesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching notification config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCountries = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/countries`);
      setCountries(response.data);
    } catch (error) {
      console.error('Error fetching countries:', error);
    }
  };

  const updateTrigger = async (triggerId, updates) => {
    try {
      await axios.put(`${API_URL}/api/notification-config/triggers/${triggerId}`, updates);
      fetchData();
    } catch (error) {
      console.error('Error updating trigger:', error);
    }
  };

  const updateTemplate = async (templateId, updates) => {
    try {
      await axios.put(`${API_URL}/api/notification-config/templates/${templateId}`, updates);
      setEditingTemplate(null);
      fetchData();
    } catch (error) {
      console.error('Error updating template:', error);
    }
  };

  const TriggerCard = ({ trigger }) => {
    const isExpanded = expandedTrigger === trigger.id;
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden">
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpandedTrigger(isExpanded ? null : trigger.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                trigger.is_enabled ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <Bell className={`w-5 h-5 ${trigger.is_enabled ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{trigger.display_name}</h4>
                <p className="text-sm text-gray-500">{trigger.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={trigger.is_enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateTrigger(trigger.id, { is_enabled: e.target.checked });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </div>
        </div>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`push-${trigger.id}`}
                  checked={trigger.send_push}
                  onChange={(e) => updateTrigger(trigger.id, { send_push: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor={`push-${trigger.id}`} className="text-sm text-gray-700">
                  <Smartphone className="w-4 h-4 inline mr-1" />
                  Push Notification
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`inapp-${trigger.id}`}
                  checked={trigger.send_in_app}
                  onChange={(e) => updateTrigger(trigger.id, { send_in_app: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor={`inapp-${trigger.id}`} className="text-sm text-gray-700">
                  <Bell className="w-4 h-4 inline mr-1" />
                  In-App Notification
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`email-${trigger.id}`}
                  checked={trigger.send_email}
                  onChange={(e) => updateTrigger(trigger.id, { send_email: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor={`email-${trigger.id}`} className="text-sm text-gray-700">
                  <Send className="w-4 h-4 inline mr-1" />
                  Email
                </label>
              </div>
            </div>
            
            {trigger.target_roles && trigger.target_roles.length > 0 && (
              <div className="mt-4">
                <label className="text-sm text-gray-600">Target Roles:</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {trigger.target_roles.map((role, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {role.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const TemplateCard = ({ template }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(template.title_template);
    const [editBody, setEditBody] = useState(template.body_template);

    const handleSave = () => {
      updateTemplate(template.id, {
        title_template: editTitle,
        body_template: editBody,
      });
      setIsEditing(false);
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded font-medium">
              {template.event_type}
            </span>
            {template.country_id && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {countries.find(c => c.id === template.country_id)?.name || template.country_id}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Title Template</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Body Template</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2">
              <span className="text-xs text-gray-500">Title:</span>
              <p className="font-medium text-gray-900">{template.title_template}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Body:</span>
              <p className="text-gray-600">{template.body_template}</p>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Available placeholders: {'{employee_name}'}, {'{leave_type}'}, {'{start_date}'}, {'{end_date}'}, {'{month}'}, {'{year}'}, etc.
            </div>
          </div>
        )}
      </div>
    );
  };

  const TestNotificationModal = () => {
    const [userId, setUserId] = useState('');
    const [eventType, setEventType] = useState('leave_approved');
    const [previewData, setPreviewData] = useState({
      employee_name: 'John Doe',
      leave_type: 'casual',
      start_date: '2025-12-20',
      end_date: '2025-12-22',
    });
    const [result, setResult] = useState(null);

    const sendTest = async () => {
      try {
        const response = await axios.post(`${API_URL}/api/notification-config/test`, {
          user_id: userId,
          event_type: eventType,
          preview_data: previewData,
        });
        setResult(response.data);
      } catch (error) {
        setResult({ error: error.response?.data?.detail || 'Failed to send test' });
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-lg mx-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TestTube className="w-5 h-5 text-blue-600" />
              Send Test Notification
            </h3>
            <button onClick={() => setTestModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID to send test to"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.event_type}>{t.event_type}</option>
                ))}
              </select>
            </div>

            <button
              onClick={sendTest}
              disabled={!userId}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Send Test Notification
            </button>

            {result && (
              <div className={`p-3 rounded-lg ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {result.error ? result.error : (
                  <>
                    <p className="font-medium">Test sent successfully!</p>
                    <p className="text-sm mt-1">Title: {result.preview?.title}</p>
                    <p className="text-sm">Body: {result.preview?.body}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const AnnouncementModal = () => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [countryId, setCountryId] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    const sendAnnouncement = async () => {
      setSending(true);
      try {
        const params = new URLSearchParams();
        params.append('title', title);
        params.append('message', message);
        if (countryId) params.append('country_id', countryId);

        const response = await api.post(`/api/notification-config/send-announcement?${params}`);
        setResult(response.data);
      } catch (error) {
        setResult({ error: error.response?.data?.detail || 'Failed to send announcement' });
      } finally {
        setSending(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-lg mx-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              Send Announcement
            </h3>
            <button onClick={() => setAnnouncementModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">Message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement..."
                rows={4}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">Target Country (optional)</label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={sendAnnouncement}
              disabled={!title || !message || sending}
              className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Announcement
            </button>

            {result && (
              <div className={`p-3 rounded-lg ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {result.error ? result.error : (
                  <>
                    <p className="font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Announcement sent successfully!
                    </p>
                    <p className="text-sm mt-1">Sent to {result.recipients_count} employees</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notification Configuration
          </h1>
          <p className="text-gray-500 mt-1">Manage push notification triggers, templates, and announcements</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setTestModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <TestTube className="w-4 h-4" />
            Test
          </button>
          <button
            onClick={() => setAnnouncementModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
            Send Announcement
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.registered_devices}</p>
                <p className="text-sm text-gray-500">Registered Devices</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.fcm_delivery_status?.sent || stats.fcm_delivery_status?.mock_sent || 0}</p>
                <p className="text-sm text-gray-500">Sent ({stats.period_days}d)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Object.values(stats.notifications_by_type || {}).reduce((a: any, b: any) => a + b, 0)}
                </p>
                <p className="text-sm text-gray-500">Total Notifications</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.notifications_by_type?.announcement || 0}</p>
                <p className="text-sm text-gray-500">Announcements</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('triggers')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'triggers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Triggers
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Edit2 className="w-4 h-4 inline mr-2" />
            Templates
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'triggers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">Configure when notifications should be sent</p>
          </div>
          {triggers.map((trigger) => (
            <TriggerCard key={trigger.id} trigger={trigger} />
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">Customize notification message content</p>
          </div>
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {/* Modals */}
      {testModalOpen && <TestNotificationModal />}
      {announcementModalOpen && <AnnouncementModal />}
    </div>
  );
};

export default NotificationConfigPage;
