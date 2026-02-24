import React, { useState, useEffect } from 'react';
import { settingsApi, citiesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Settings, Key, RefreshCw, CheckCircle, XCircle, AlertCircle, 
  Eye, EyeOff, Copy, Loader2, Zap, Wallet, MessageSquare,
  CreditCard, Phone, ExternalLink, ShieldCheck, Clock,
  MapPin, Plus, Edit2, Trash2, Search, Globe, Tag, X
} from 'lucide-react';
import InspectionPackagesPage from './InspectionPackagesPage';

const TokenCard = ({ token, onUpdate, onTest }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-700 border-green-200';
      case 'invalid': return 'bg-red-100 text-red-700 border-red-200';
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      case 'configured': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'not_configured': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'valid': return <CheckCircle className="h-4 w-4" />;
      case 'invalid': 
      case 'error': return <XCircle className="h-4 w-4" />;
      case 'configured': return <ShieldCheck className="h-4 w-4" />;
      case 'not_configured': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTokenIcon = (id) => {
    switch (id) {
      case 'meta_ads': return <Zap className="h-6 w-6 text-blue-600" />;
      case 'fast2sms': return <MessageSquare className="h-6 w-6 text-green-600" />;
      case 'twilio': return <Phone className="h-6 w-6 text-red-500" />;
      case 'razorpay': return <CreditCard className="h-6 w-6 text-indigo-600" />;
      default: return <Key className="h-6 w-6 text-gray-600" />;
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await onTest(token.id);
      if (result.success) {
        toast.success(result.message || 'Token is valid!');
      } else {
        toast.error(result.message || 'Token validation failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleUpdate = async () => {
    if (!newToken.trim()) {
      toast.error('Please enter a token');
      return;
    }
    
    setIsUpdating(true);
    try {
      await onUpdate(token.id, newToken);
      toast.success('Token updated successfully!');
      setShowUpdateModal(false);
      setNewToken('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token.token_preview);
    toast.success('Token preview copied!');
  };

  return (
    <>
      <div className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center">
              {getTokenIcon(token.id)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{token.name}</h3>
              <p className="text-sm text-gray-500">{token.description}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border ${getStatusColor(token.status)}`}>
            {getStatusIcon(token.status)}
            <span className="capitalize">{token.status?.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Token Preview */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-gray-400" />
              <code className="text-sm text-gray-600 font-mono">
                {showToken ? token.token_preview : '••••••••••••••••••••'}
              </code>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={copyToken}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Extra Info (for Fast2SMS wallet balance) */}
        {token.extra && Object.keys(token.extra).length > 0 && (
          <div className="flex items-center gap-4 mb-4 text-sm">
            {token.extra.wallet_balance && (
              <div className="flex items-center gap-1.5 text-green-600">
                <Wallet className="h-4 w-4" />
                <span className="font-medium">₹{token.extra.wallet_balance}</span>
              </div>
            )}
            {token.extra.sms_count && (
              <div className="flex items-center gap-1.5 text-blue-600">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">{token.extra.sms_count} SMS</span>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {token.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{token.error}</p>
          </div>
        )}

        {/* Last Checked */}
        {token.last_checked && (
          <p className="text-xs text-gray-400 mb-4">
            Last checked: {new Date(token.last_checked).toLocaleString()}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || !token.is_configured}
            className="flex-1"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1.5" />
            )}
            Test Token
          </Button>
          {(token.id === 'meta_ads' || token.id === 'fast2sms') && (
            <Button
              size="sm"
              onClick={() => setShowUpdateModal(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Key className="h-4 w-4 mr-1.5" />
              Update Token
            </Button>
          )}
        </div>

        {/* Sync Now for Meta Ads */}
        {token.id === 'meta_ads' && token.status === 'valid' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={async () => {
              try {
                const res = await settingsApi.testToken('meta_ads_sync');
                if (res.data.success) {
                  toast.success('Meta Ads sync triggered!');
                } else {
                  toast.error(res.data.message);
                }
              } catch (e) {
                toast.error('Sync failed');
              }
            }}
          >
            <Zap className="h-4 w-4 mr-1.5" />
            Sync Ads Now
          </Button>
        )}
      </div>

      {/* Update Token Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getTokenIcon(token.id)}
              Update {token.name} Token
            </DialogTitle>
            <DialogDescription>
              Paste your new API token below. The token will be validated before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-token">New Token / API Key</Label>
              <Input
                id="new-token"
                type="password"
                placeholder="Paste your new token here..."
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {token.id === 'meta_ads' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>How to get a new token:</strong>
                </p>
                <ol className="text-sm text-blue-600 list-decimal ml-4 mt-2 space-y-1">
                  <li>Go to <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="underline">Meta Graph API Explorer</a></li>
                  <li>Select your app and get a User Access Token</li>
                  <li>Extend the token for longer validity</li>
                  <li>Copy and paste the token here</li>
                </ol>
              </div>
            )}

            {token.id === 'fast2sms' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  <strong>How to get your API key:</strong>
                </p>
                <ol className="text-sm text-green-600 list-decimal ml-4 mt-2 space-y-1">
                  <li>Login to <a href="https://www.fast2sms.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">Fast2SMS Dashboard</a></li>
                  <li>Go to Dev API section</li>
                  <li>Copy your API Authorization Key</li>
                </ol>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating || !newToken.trim()}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Update Token
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('tokens');
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const response = await settingsApi.getTokenStatus();
      setTokens(response.data.tokens || []);
    } catch (error) {
      console.error('Failed to fetch token status:', error);
      toast.error('Failed to load token status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateToken = async (tokenType, token) => {
    await settingsApi.updateToken(tokenType, token);
    await fetchTokens(); // Refresh token status
  };

  const handleTestToken = async (tokenType) => {
    const response = await settingsApi.testToken(tokenType);
    await fetchTokens(); // Refresh token status
    return response.data;
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="settings-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">Manage your integrations and configurations</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="tokens" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Tokens
            </TabsTrigger>
            <TabsTrigger value="packages" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Inspection Packages
            </TabsTrigger>
          </TabsList>

          {/* Tokens Tab */}
          <TabsContent value="tokens" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">API Token Management</h2>
                <p className="text-sm text-gray-500">View and update your third-party integration tokens</p>
              </div>
              <Button variant="outline" onClick={fetchTokens} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tokens.map((token) => (
                  <TokenCard
                    key={token.id}
                    token={token}
                    onUpdate={handleUpdateToken}
                    onTest={handleTestToken}
                  />
                ))}
              </div>
            )}

            {/* Info Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Token Management Tips</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Meta Ads:</strong> Tokens expire periodically. Generate a new one from the Graph API Explorer when needed.</li>
                <li>• <strong>Fast2SMS:</strong> Keep your wallet balance topped up for uninterrupted OTP delivery.</li>
                <li>• <strong>Twilio & Razorpay:</strong> These tokens are configured during deployment. Contact support to update.</li>
              </ul>
            </div>
          </TabsContent>

          {/* Packages Tab */}
          <TabsContent value="packages">
            <InspectionPackagesPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
