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

// City Management Component
const CityManagement = () => {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const [formData, setFormData] = useState({ name: '', state: '', aliases: [] });
  const [aliasInput, setAliasInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchCities();
  }, [showInactive]);

  const fetchCities = async () => {
    setLoading(true);
    try {
      const response = await citiesApi.getAll(showInactive);
      setCities(response.data || []);
    } catch (error) {
      console.error('Failed to fetch cities:', error);
      toast.error('Failed to load cities');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCity = async () => {
    if (!formData.name.trim()) {
      toast.error('City name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await citiesApi.create({
        name: formData.name,
        state: formData.state || null,
        aliases: formData.aliases.length > 0 ? formData.aliases : null
      });
      toast.success('City added successfully!');
      setShowAddModal(false);
      setFormData({ name: '', state: '', aliases: [] });
      fetchCities();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add city');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCity = async () => {
    if (!selectedCity) return;

    setIsSubmitting(true);
    try {
      await citiesApi.update(selectedCity.id, {
        name: formData.name || null,
        state: formData.state || null,
        aliases: formData.aliases
      });
      toast.success('City updated successfully!');
      setShowEditModal(false);
      setSelectedCity(null);
      fetchCities();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update city');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (city) => {
    try {
      await citiesApi.update(city.id, { is_active: !city.is_active });
      toast.success(`City ${city.is_active ? 'deactivated' : 'activated'}!`);
      fetchCities();
    } catch (error) {
      toast.error('Failed to update city status');
    }
  };

  const openEditModal = (city) => {
    setSelectedCity(city);
    setFormData({
      name: city.name,
      state: city.state || '',
      aliases: city.aliases || []
    });
    setShowEditModal(true);
  };

  const addAlias = () => {
    if (aliasInput.trim() && !formData.aliases.includes(aliasInput.trim())) {
      setFormData({ ...formData, aliases: [...formData.aliases, aliasInput.trim()] });
      setAliasInput('');
    }
  };

  const removeAlias = (alias) => {
    setFormData({ ...formData, aliases: formData.aliases.filter(a => a !== alias) });
  };

  const filteredCities = cities.filter(city => 
    city.name.toLowerCase().includes(search.toLowerCase()) ||
    city.state?.toLowerCase().includes(search.toLowerCase()) ||
    city.aliases?.some(a => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">City Master Management</h2>
          <p className="text-sm text-gray-500">Manage cities and their aliases for consistent data across the platform</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm">Show Inactive</Label>
          </div>
          <Button onClick={() => { setFormData({ name: '', state: '', aliases: [] }); setShowAddModal(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add City
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search cities, states, or aliases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-blue-700">
            <MapPin className="h-5 w-5" />
            <span className="text-2xl font-bold">{cities.filter(c => c.is_active).length}</span>
          </div>
          <p className="text-sm text-blue-600 mt-1">Active Cities</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
          <div className="flex items-center gap-2 text-purple-700">
            <Tag className="h-5 w-5" />
            <span className="text-2xl font-bold">{cities.reduce((acc, c) => acc + (c.aliases?.length || 0), 0)}</span>
          </div>
          <p className="text-sm text-purple-600 mt-1">Total Aliases</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-700">
            <Globe className="h-5 w-5" />
            <span className="text-2xl font-bold">{new Set(cities.map(c => c.state).filter(Boolean)).size}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">States/Regions</p>
        </div>
      </div>

      {/* City List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aliases</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    {search ? 'No cities match your search' : 'No cities found. Add your first city!'}
                  </td>
                </tr>
              ) : (
                filteredCities.map((city) => (
                  <tr key={city.id} className={`hover:bg-gray-50 ${!city.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-gray-900">{city.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{city.state || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {city.aliases?.length > 0 ? (
                          city.aliases.map((alias, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {alias}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">No aliases</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={city.is_active ? 'default' : 'outline'} className={city.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                        {city.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(city)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(city)}
                          className={`h-8 w-8 p-0 ${city.is_active ? 'text-red-500 hover:text-red-600' : 'text-green-500 hover:text-green-600'}`}
                        >
                          {city.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
        <h3 className="font-semibold text-purple-900 mb-2">💡 City Management Tips</h3>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• <strong>Aliases</strong> help match different spellings (e.g., "Bengaluru" → "Bangalore")</li>
          <li>• <strong>Deactivating</strong> a city hides it from dropdowns but preserves existing data</li>
          <li>• Changes here affect lead assignment, mechanic assignments, and inspection filtering</li>
        </ul>
      </div>

      {/* Add City Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Add New City
            </DialogTitle>
            <DialogDescription>
              Add a new city to the master list. Aliases help match different name variations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="city-name">City Name *</Label>
              <Input
                id="city-name"
                placeholder="e.g., Bangalore"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State / Region</Label>
              <Input
                id="state"
                placeholder="e.g., Karnataka"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Aliases (Alternative Names)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Bengaluru"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                />
                <Button type="button" variant="outline" onClick={addAlias}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.aliases.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.aliases.map((alias, idx) => (
                    <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                      {alias}
                      <button onClick={() => removeAlias(alias)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddCity} disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Add City
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit City Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-600" />
              Edit City
            </DialogTitle>
            <DialogDescription>
              Update city details and manage aliases.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-city-name">City Name</Label>
              <Input
                id="edit-city-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-state">State / Region</Label>
              <Input
                id="edit-state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Aliases</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add new alias..."
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                />
                <Button type="button" variant="outline" onClick={addAlias}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.aliases.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.aliases.map((alias, idx) => (
                    <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                      {alias}
                      <button onClick={() => removeAlias(alias)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdateCity} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
