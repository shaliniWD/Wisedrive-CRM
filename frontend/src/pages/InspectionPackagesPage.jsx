import React, { useState, useEffect, useCallback } from 'react';
import { inspectionPackagesApi, hrApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, Package, CheckCircle, X, ListChecks,
  IndianRupee, Award, Layers, ChevronDown, ChevronUp, Copy, PauseCircle,
  PlayCircle, Gift, Percent, Calendar, Tag, CreditCard, BadgePercent,
  ToggleLeft, ToggleRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Category Card Component
const CategoryCard = ({ category, onEdit, onCopy, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`border rounded-xl overflow-hidden ${category.is_active !== false ? 'bg-white' : 'bg-gray-50'}`} data-testid={`category-card-${category.id}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className={`h-12 w-12 rounded-xl flex items-center justify-center ${category.is_active !== false ? '' : 'opacity-50'}`}
              style={{ backgroundColor: category.color ? `${category.color}20` : '#EFF6FF' }}
            >
              <ListChecks className="h-6 w-6" style={{ color: category.color || '#3B82F6' }} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {category.name}
                {category.is_free && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">FREE</span>
                )}
                {category.is_active === false && (
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">Inactive</span>
                )}
              </h3>
              <p className="text-sm text-gray-500">{category.check_points} Check Points</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded(!expanded)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button onClick={() => onCopy(category)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Copy & Create New">
              <Copy className="h-4 w-4" />
            </button>
            <button onClick={() => onEdit(category)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => onToggle(category)} className={`p-2 rounded-lg transition-colors ${category.is_active !== false ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
              {category.is_active !== false ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {category.items && category.items.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Inspection Items</h4>
                <div className="space-y-1.5">
                  {category.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-700">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {category.benefits && category.benefits.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Benefits</h4>
                <div className="space-y-1.5">
                  {category.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Plus className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-gray-600">{benefit.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Package Card Component
const PackageCard = ({ pkg, categories, offers, onEdit, onCopy, onToggle }) => {
  const includedCategories = categories.filter(c => pkg.categories?.includes(c.id));
  const applicableOffers = offers.filter(o => pkg.applicable_offer_ids?.includes(o.id));
  const isActive = pkg.is_active !== false;
  const isRecommended = pkg.is_recommended && isActive;
  
  return (
    <div className={`border rounded-xl transition-all h-full flex flex-col relative ${isActive ? 'bg-white shadow-sm hover:shadow-md' : 'bg-gray-50 border-gray-200'}`} data-testid={`package-card-${pkg.id}`}>
      {/* Package Header */}
      <div className={`p-4 ${isRecommended ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-slate-50 border-b'} rounded-t-xl`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isRecommended && (
              <span className="px-2 py-1 bg-amber-400 text-amber-900 text-xs font-semibold rounded-full inline-flex items-center gap-1">
                <Award className="h-3 w-3" /> Recommended
              </span>
            )}
            {!isActive && <span className="px-2 py-1 bg-gray-400 text-white text-xs font-semibold rounded-full">Inactive</span>}
            {pkg.allow_partial_payment && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full inline-flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Partial Pay
              </span>
            )}
          </div>
          <div className={`text-right flex-shrink-0 ${isRecommended ? 'text-white' : 'text-gray-900'}`}>
            <p className="text-xl font-bold whitespace-nowrap">{pkg.currency_symbol || '₹'}{(pkg.price || 0).toLocaleString('en-IN')}</p>
            <p className={`text-xs ${isRecommended ? 'text-blue-100' : 'text-gray-500'}`}>Incl. taxes</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isRecommended ? 'bg-white/20' : 'bg-white border'}`}>
            <Package className={`h-5 w-5 ${isRecommended ? 'text-white' : 'text-blue-600'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold truncate ${isRecommended ? 'text-white' : 'text-gray-900'}`}>{pkg.name}</h3>
            <div className={`flex items-center gap-2 text-xs ${isRecommended ? 'text-blue-100' : 'text-gray-500'}`}>
              <span className="font-medium">{pkg.total_check_points || 0}+ pts</span>
              <span>•</span>
              <span className="font-medium">{pkg.no_of_inspections || 1} inspection{(pkg.no_of_inspections || 1) > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Package Details */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Payment & Discount Info */}
        {(pkg.allow_partial_payment || pkg.allow_discount || pkg.allow_offers) && (
          <div className="mb-3 space-y-2">
            {pkg.allow_partial_payment && (
              <div className="flex items-center gap-2 text-xs bg-purple-50 text-purple-700 px-2 py-1.5 rounded-lg">
                <CreditCard className="h-3.5 w-3.5" />
                <span>Partial: {pkg.partial_payment_type === 'percentage' ? `${pkg.partial_payment_value}%` : `₹${pkg.partial_payment_value}`} upfront</span>
              </div>
            )}
            {pkg.allow_discount && (
              <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg">
                <BadgePercent className="h-3.5 w-3.5" />
                <span>Discount: {pkg.discount_type === 'percentage' ? `${pkg.discount_value}%` : `₹${pkg.discount_value}`} off</span>
              </div>
            )}
            {pkg.allow_offers && applicableOffers.length > 0 && (
              <div className="flex items-center gap-2 text-xs bg-orange-50 text-orange-700 px-2 py-1.5 rounded-lg">
                <Gift className="h-3.5 w-3.5" />
                <span>{applicableOffers.length} offer{applicableOffers.length > 1 ? 's' : ''} available</span>
              </div>
            )}
          </div>
        )}
        
        {/* Categories */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Includes</p>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded">{includedCategories.length} categories</span>
        </div>
        
        <div className="space-y-2 flex-1">
          {includedCategories.length === 0 ? (
            <div className="py-3 px-2 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
              <p className="text-xs text-gray-400">No categories assigned</p>
            </div>
          ) : (
            includedCategories.slice(0, 3).map((cat) => (
              <div key={cat.id} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#3B82F6' }} />
                  <span className="text-gray-700 truncate">{cat.name}</span>
                </div>
                <span className="text-gray-500 text-xs font-medium flex-shrink-0 ml-2">{cat.check_points} pts</span>
              </div>
            ))
          )}
          {includedCategories.length > 3 && (
            <p className="text-xs text-gray-400 text-center">+{includedCategories.length - 3} more</p>
          )}
        </div>
      </div>
      
      {/* Actions Footer */}
      <div className="px-4 py-3 border-t bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => onToggle(pkg)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-gray-500'}`}>{isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onCopy(pkg)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Copy">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={() => onEdit(pkg)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Offer Card Component
const OfferCard = ({ offer, onEdit, onToggle, onDelete }) => {
  const now = new Date();
  const validFrom = new Date(offer.valid_from);
  const validUntil = new Date(offer.valid_until);
  const isExpired = validUntil < now;
  const isUpcoming = validFrom > now;
  const isCurrentlyValid = !isExpired && !isUpcoming && offer.is_active;
  
  return (
    <div className={`border rounded-xl overflow-hidden ${offer.is_active && !isExpired ? 'bg-white' : 'bg-gray-50'}`} data-testid={`offer-card-${offer.id}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isCurrentlyValid ? 'bg-gradient-to-br from-orange-400 to-red-500' : 'bg-gray-200'}`}>
              <Gift className={`h-6 w-6 ${isCurrentlyValid ? 'text-white' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {offer.name}
                {isExpired && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">Expired</span>}
                {isUpcoming && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Upcoming</span>}
                {isCurrentlyValid && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">Active</span>}
                {!offer.is_active && !isExpired && <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">Disabled</span>}
              </h3>
              <p className="text-sm text-gray-500">
                {offer.discount_type === 'percentage' ? `${offer.discount_value}% off` : `₹${offer.discount_value} off`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(offer)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => onToggle(offer)} className={`p-2 rounded-lg transition-colors ${offer.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
              {offer.is_active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            </button>
            <button onClick={() => onDelete(offer)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Validity */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>From: {validFrom.toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Until: {validUntil.toLocaleDateString()}</span>
          </div>
        </div>
        
        {offer.description && (
          <p className="mt-2 text-sm text-gray-600">{offer.description}</p>
        )}
      </div>
    </div>
  );
};

export default function InspectionPackagesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('packages');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [packages, setPackages] = useState([]);
  const [offers, setOffers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  
  // Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingOffer, setEditingOffer] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '', description: '', check_points: 0, icon: '', color: '#3B82F6',
    items: [], benefits: [], is_free: false, order: 0,
  });
  
  // Package form with new fields
  const [packageForm, setPackageForm] = useState({
    name: '', description: '', price: 0, currency: 'INR', currency_symbol: '₹',
    categories: [], no_of_inspections: 1, is_recommended: false, order: 0, brands_covered: [],
    allow_partial_payment: false, partial_payment_type: 'percentage', partial_payment_value: 0,
    allow_discount: false, discount_type: 'percentage', discount_value: 0,
    allow_offers: false, applicable_offer_ids: [],
  });
  
  // Offer form
  const [offerForm, setOfferForm] = useState({
    name: '', description: '', discount_type: 'percentage', discount_value: 0,
    valid_from: '', valid_until: '', is_active: true,
  });
  
  // New item inputs
  const [newItem, setNewItem] = useState('');
  const [newBenefit, setNewBenefit] = useState('');

  const fetchCountries = useCallback(async () => {
    try {
      const response = await hrApi.getAllCountries();
      setCountries(response.data || []);
      if (user?.country_id) {
        setSelectedCountry(user.country_id);
      } else if (response.data?.length > 0) {
        setSelectedCountry(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load countries:', error);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!selectedCountry) return;
    setLoading(true);
    try {
      const [categoriesRes, packagesRes, offersRes] = await Promise.all([
        inspectionPackagesApi.getCategories(selectedCountry),
        inspectionPackagesApi.getPackages(selectedCountry),
        inspectionPackagesApi.getOffers(selectedCountry),
      ]);
      setCategories(categoriesRes.data || []);
      setPackages(packagesRes.data || []);
      setOffers(offersRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedCountry]);

  useEffect(() => { fetchCountries(); }, [fetchCountries]);
  useEffect(() => { if (selectedCountry) fetchData(); }, [selectedCountry, fetchData]);

  // Category Modal Functions
  const openCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name || '', description: category.description || '',
        check_points: category.check_points || 0, icon: category.icon || '',
        color: category.color || '#3B82F6', items: category.items || [],
        benefits: category.benefits || [], is_free: category.is_free || false,
        order: category.order || 0,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '', description: '', check_points: 0, icon: '', color: '#3B82F6',
        items: [], benefits: [], is_free: false, order: categories.length,
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) { toast.error('Please enter category name'); return; }
    setSaving(true);
    try {
      if (editingCategory) {
        await inspectionPackagesApi.updateCategory(editingCategory.id, categoryForm);
        toast.success('Category updated');
      } else {
        await inspectionPackagesApi.createCategory(categoryForm, selectedCountry);
        toast.success('Category created');
      }
      setIsCategoryModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCategory = (category) => {
    setEditingCategory(null);
    setCategoryForm({
      name: `${category.name} (Copy)`, description: category.description || '',
      check_points: category.check_points || 0, icon: category.icon || '',
      color: category.color || '#3B82F6', items: category.items || [],
      benefits: category.benefits || [], is_free: category.is_free || false,
      order: categories.length,
    });
    setIsCategoryModalOpen(true);
  };

  const handleToggleCategory = async (category) => {
    try {
      await inspectionPackagesApi.toggleCategoryStatus(category.id);
      toast.success(category.is_active !== false ? 'Category deactivated' : 'Category activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle category status');
    }
  };

  // Package Modal Functions
  const openPackageModal = (pkg = null) => {
    if (pkg) {
      setEditingPackage(pkg);
      setPackageForm({
        name: pkg.name || '', description: pkg.description || '',
        price: pkg.price || 0, currency: pkg.currency || 'INR',
        currency_symbol: pkg.currency_symbol || '₹', categories: pkg.categories || [],
        no_of_inspections: pkg.no_of_inspections || 1, is_recommended: pkg.is_recommended || false,
        order: pkg.order || 0, brands_covered: pkg.brands_covered || [],
        allow_partial_payment: pkg.allow_partial_payment || false,
        partial_payment_type: pkg.partial_payment_type || 'percentage',
        partial_payment_value: pkg.partial_payment_value || 0,
        allow_discount: pkg.allow_discount || false,
        discount_type: pkg.discount_type || 'percentage',
        discount_value: pkg.discount_value || 0,
        allow_offers: pkg.allow_offers || false,
        applicable_offer_ids: pkg.applicable_offer_ids || [],
      });
    } else {
      setEditingPackage(null);
      setPackageForm({
        name: '', description: '', price: 0, currency: 'INR', currency_symbol: '₹',
        categories: [], no_of_inspections: 1, is_recommended: false, order: packages.length,
        brands_covered: [], allow_partial_payment: false, partial_payment_type: 'percentage',
        partial_payment_value: 0, allow_discount: false, discount_type: 'percentage',
        discount_value: 0, allow_offers: false, applicable_offer_ids: [],
      });
    }
    setIsPackageModalOpen(true);
  };

  const handleSavePackage = async () => {
    if (!packageForm.name || packageForm.price <= 0) {
      toast.error('Please enter package name and price');
      return;
    }
    setSaving(true);
    try {
      const data = { ...packageForm, country_id: selectedCountry };
      if (editingPackage) {
        await inspectionPackagesApi.updatePackage(editingPackage.id, data);
        toast.success('Package updated');
      } else {
        await inspectionPackagesApi.createPackage(data);
        toast.success('Package created');
      }
      setIsPackageModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePackage = async (pkg) => {
    try {
      await inspectionPackagesApi.togglePackageStatus(pkg.id);
      toast.success(pkg.is_active ? 'Package deactivated' : 'Package activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle package status');
    }
  };

  const handleCopyPackage = (pkg) => {
    setEditingPackage(null);
    setPackageForm({
      name: `${pkg.name} (Copy)`, description: pkg.description || '',
      price: pkg.price || 0, currency: pkg.currency || 'INR',
      currency_symbol: pkg.currency_symbol || '₹', categories: pkg.categories || [],
      no_of_inspections: pkg.no_of_inspections || 1, is_recommended: false,
      order: packages.length, brands_covered: pkg.brands_covered || [],
      allow_partial_payment: pkg.allow_partial_payment || false,
      partial_payment_type: pkg.partial_payment_type || 'percentage',
      partial_payment_value: pkg.partial_payment_value || 0,
      allow_discount: pkg.allow_discount || false,
      discount_type: pkg.discount_type || 'percentage',
      discount_value: pkg.discount_value || 0,
      allow_offers: pkg.allow_offers || false,
      applicable_offer_ids: pkg.applicable_offer_ids || [],
    });
    setIsPackageModalOpen(true);
  };

  // Offer Modal Functions
  const openOfferModal = (offer = null) => {
    if (offer) {
      setEditingOffer(offer);
      setOfferForm({
        name: offer.name || '', description: offer.description || '',
        discount_type: offer.discount_type || 'percentage',
        discount_value: offer.discount_value || 0,
        valid_from: offer.valid_from ? offer.valid_from.split('T')[0] : '',
        valid_until: offer.valid_until ? offer.valid_until.split('T')[0] : '',
        is_active: offer.is_active !== false,
      });
    } else {
      setEditingOffer(null);
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setOfferForm({
        name: '', description: '', discount_type: 'percentage', discount_value: 0,
        valid_from: today, valid_until: nextMonth, is_active: true,
      });
    }
    setIsOfferModalOpen(true);
  };

  const handleSaveOffer = async () => {
    if (!offerForm.name || !offerForm.valid_from || !offerForm.valid_until) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...offerForm,
        country_id: selectedCountry,
        valid_from: new Date(offerForm.valid_from).toISOString(),
        valid_until: new Date(offerForm.valid_until + 'T23:59:59').toISOString(),
      };
      if (editingOffer) {
        await inspectionPackagesApi.updateOffer(editingOffer.id, data);
        toast.success('Offer updated');
      } else {
        await inspectionPackagesApi.createOffer(data);
        toast.success('Offer created');
      }
      setIsOfferModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOffer = async (offer) => {
    try {
      await inspectionPackagesApi.toggleOfferStatus(offer.id);
      toast.success(offer.is_active ? 'Offer disabled' : 'Offer enabled');
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle offer status');
    }
  };

  const handleDeleteOffer = async (offer) => {
    if (!window.confirm(`Delete "${offer.name}"? This cannot be undone.`)) return;
    try {
      await inspectionPackagesApi.deleteOffer(offer.id);
      toast.success('Offer deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete offer');
    }
  };

  // Item management
  const addItem = () => {
    if (!newItem.trim()) return;
    setCategoryForm({ ...categoryForm, items: [...categoryForm.items, { name: newItem.trim() }] });
    setNewItem('');
  };

  const removeItem = (index) => {
    setCategoryForm({ ...categoryForm, items: categoryForm.items.filter((_, i) => i !== index) });
  };

  const addBenefit = () => {
    if (!newBenefit.trim()) return;
    setCategoryForm({ ...categoryForm, benefits: [...categoryForm.benefits, { name: newBenefit.trim() }] });
    setNewBenefit('');
  };

  const removeBenefit = (index) => {
    setCategoryForm({ ...categoryForm, benefits: categoryForm.benefits.filter((_, i) => i !== index) });
  };

  const toggleCategoryInPackage = (categoryId) => {
    const current = packageForm.categories || [];
    if (current.includes(categoryId)) {
      setPackageForm({ ...packageForm, categories: current.filter(id => id !== categoryId) });
    } else {
      setPackageForm({ ...packageForm, categories: [...current, categoryId] });
    }
  };

  const toggleOfferInPackage = (offerId) => {
    const current = packageForm.applicable_offer_ids || [];
    if (current.includes(offerId)) {
      setPackageForm({ ...packageForm, applicable_offer_ids: current.filter(id => id !== offerId) });
    } else {
      setPackageForm({ ...packageForm, applicable_offer_ids: [...current, offerId] });
    }
  };

  // Get active offers for selection
  const activeOffers = offers.filter(o => {
    const now = new Date();
    const validUntil = new Date(o.valid_until);
    return o.is_active && validUntil >= now;
  });

  const selectedCountryData = countries.find(c => c.id === selectedCountry);

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="inspection-packages-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspection Packages</h1>
          <p className="text-gray-500 mt-1">Configure packages, categories, and promotional offers</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCountry || 'select'} onValueChange={(v) => setSelectedCountry(v === 'select' ? '' : v)}>
            <SelectTrigger className="w-48" data-testid="country-selector">
              <SelectValue placeholder="Select Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="select">-- Select Country --</SelectItem>
              {countries.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex border-b bg-slate-50">
          <button onClick={() => setActiveTab('packages')} className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${activeTab === 'packages' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`} data-testid="packages-tab">
            <Package className="h-4 w-4" /> Packages
          </button>
          <button onClick={() => setActiveTab('categories')} className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${activeTab === 'categories' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`} data-testid="categories-tab">
            <Layers className="h-4 w-4" /> Categories
          </button>
          <button onClick={() => setActiveTab('offers')} className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${activeTab === 'offers' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`} data-testid="offers-tab">
            <Gift className="h-4 w-4" /> Offers
          </button>
        </div>

        {/* Packages Tab */}
        {activeTab === 'packages' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">Create and manage inspection packages for {selectedCountryData?.name || 'your organization'}</p>
              <button className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all" onClick={() => openPackageModal()} data-testid="create-package-btn">
                <Plus className="h-4 w-4" /> Create Package
              </button>
            </div>
            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" /><p className="text-gray-500 mt-2">Loading...</p></div>
            ) : packages.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-gray-50">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No packages found</p>
                <button onClick={() => openPackageModal()} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">Create your first package</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => (<PackageCard key={pkg.id} pkg={pkg} categories={categories} offers={offers} onEdit={openPackageModal} onCopy={handleCopyPackage} onToggle={handleTogglePackage} />))}
              </div>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">Define inspection categories and their check points</p>
              <button className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all" onClick={() => openCategoryModal()} data-testid="create-category-btn">
                <Plus className="h-4 w-4" /> Create Category
              </button>
            </div>
            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" /></div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-gray-50">
                <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No categories found</p>
                <button onClick={() => openCategoryModal()} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">Create your first category</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((category) => (<CategoryCard key={category.id} category={category} onEdit={openCategoryModal} onCopy={handleCopyCategory} onToggle={handleToggleCategory} />))}
              </div>
            )}
          </div>
        )}

        {/* Offers Tab */}
        {activeTab === 'offers' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">Create promotional offers like Christmas specials, New Year discounts</p>
              <button className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 flex items-center gap-2 font-medium shadow-lg shadow-orange-500/25 transition-all" onClick={() => openOfferModal()} data-testid="create-offer-btn">
                <Plus className="h-4 w-4" /> Create Offer
              </button>
            </div>
            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto" /></div>
            ) : offers.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-gray-50">
                <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No offers created yet</p>
                <button onClick={() => openOfferModal()} className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium">Create your first offer</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {offers.map((offer) => (<OfferCard key={offer.id} offer={offer} onEdit={openOfferModal} onToggle={handleToggleOffer} onDelete={handleDeleteOffer} />))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="category-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category Name *</Label>
                <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="e.g., Physical/Manual Inspection" data-testid="category-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Check Points</Label>
                <Input type="number" value={categoryForm.check_points} onChange={(e) => setCategoryForm({ ...categoryForm, check_points: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} className="h-10 w-14 rounded cursor-pointer" />
                  <Input value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input type="number" value={categoryForm.order} onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={categoryForm.is_free} onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_free: checked })} />
              <Label className="cursor-pointer">Mark as FREE</Label>
            </div>
            {/* Items */}
            <div className="space-y-2">
              <Label>Inspection Items</Label>
              <div className="flex gap-2">
                <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="e.g., Engine Check" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())} />
                <Button type="button" onClick={addItem} variant="outline"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1 mt-2">
                {categoryForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="flex-1 text-sm">{item.name}</span>
                    <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            {/* Benefits */}
            <div className="space-y-2">
              <Label>Additional Benefits</Label>
              <div className="flex gap-2">
                <Input value={newBenefit} onChange={(e) => setNewBenefit(e.target.value)} placeholder="e.g., Flood Check" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())} />
                <Button type="button" onClick={addBenefit} variant="outline"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1 mt-2">
                {categoryForm.benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                    <Plus className="h-4 w-4 text-blue-500" />
                    <span className="flex-1 text-sm">{benefit.name}</span>
                    <button onClick={() => removeBenefit(idx)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCategory} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Package Modal */}
      <Dialog open={isPackageModalOpen} onOpenChange={setIsPackageModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="package-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {editingPackage ? 'Edit Package' : 'Create Package'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Package Name *</Label>
                <Input value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="e.g., Standard" data-testid="package-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Price *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-gray-500">{packageForm.currency_symbol}</span>
                  <Input type="number" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: parseFloat(e.target.value) || 0 })} data-testid="package-price-input" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. of Inspections</Label>
                <Input type="number" min="1" value={packageForm.no_of_inspections} onChange={(e) => setPackageForm({ ...packageForm, no_of_inspections: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox checked={packageForm.is_recommended} onCheckedChange={(checked) => setPackageForm({ ...packageForm, is_recommended: checked })} />
                <Label className="cursor-pointer">Mark as Recommended</Label>
              </div>
            </div>

            {/* Partial Payment Section */}
            <div className="border rounded-lg p-4 bg-purple-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                  <Label className="font-semibold text-purple-900">Allow Partial Payments</Label>
                </div>
                <Switch checked={packageForm.allow_partial_payment} onCheckedChange={(checked) => setPackageForm({ ...packageForm, allow_partial_payment: checked })} data-testid="allow-partial-payment-switch" />
              </div>
              {packageForm.allow_partial_payment && (
                <div className="mt-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Partial Payment Amount (₹)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium text-purple-600">₹</span>
                      <Input 
                        type="number" 
                        value={packageForm.partial_payment_value} 
                        onChange={(e) => setPackageForm({ ...packageForm, partial_payment_value: parseFloat(e.target.value) || 0, partial_payment_type: 'fixed' })} 
                        placeholder="e.g., 500"
                        className="max-w-[200px]"
                        data-testid="partial-payment-value"
                      />
                    </div>
                    <p className="text-xs text-purple-500">This fixed amount will be collected immediately. Example: If package is ₹1,499 and partial payment is ₹500, customer pays ₹500 now, remaining ₹999 later.</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-purple-600 mt-2">Customer pays partial amount upfront, balance collected via "Collect Balance" button before report delivery</p>
            </div>

            {/* Discount Section */}
            <div className="border rounded-lg p-4 bg-emerald-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BadgePercent className="h-5 w-5 text-emerald-600" />
                  <Label className="font-semibold text-emerald-900">Allow Discounts</Label>
                </div>
                <Switch checked={packageForm.allow_discount} onCheckedChange={(checked) => setPackageForm({ ...packageForm, allow_discount: checked })} data-testid="allow-discount-switch" />
              </div>
              {packageForm.allow_discount && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Type</Label>
                    <Select value={packageForm.discount_type} onValueChange={(v) => setPackageForm({ ...packageForm, discount_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Value</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={packageForm.discount_value} onChange={(e) => setPackageForm({ ...packageForm, discount_value: parseFloat(e.target.value) || 0 })} placeholder={packageForm.discount_type === 'percentage' ? '10' : '100'} />
                      <span className="text-gray-500">{packageForm.discount_type === 'percentage' ? '%' : '₹'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Offers Section */}
            <div className="border rounded-lg p-4 bg-orange-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-orange-600" />
                  <Label className="font-semibold text-orange-900">Allow Offers</Label>
                </div>
                <Switch checked={packageForm.allow_offers} onCheckedChange={(checked) => setPackageForm({ ...packageForm, allow_offers: checked })} data-testid="allow-offers-switch" />
              </div>
              {packageForm.allow_offers && (
                <div className="mt-3">
                  {activeOffers.length === 0 ? (
                    <p className="text-sm text-orange-600">No active offers available. Create offers in the "Offers" tab first.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activeOffers.map((offer) => (
                        <label key={offer.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${packageForm.applicable_offer_ids?.includes(offer.id) ? 'bg-orange-100 border border-orange-300' : 'bg-white border hover:bg-gray-50'}`}>
                          <Checkbox checked={packageForm.applicable_offer_ids?.includes(offer.id)} onCheckedChange={() => toggleOfferInPackage(offer.id)} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{offer.name}</p>
                            <p className="text-xs text-gray-500">
                              {offer.discount_type === 'percentage' ? `${offer.discount_value}% off` : `₹${offer.discount_value} off`}
                              {' • '}Valid until {new Date(offer.valid_until).toLocaleDateString()}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-orange-600 mt-2">Sales Head can manually apply these offers during payment</p>
            </div>

            {/* Categories Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                Assign Categories *
              </Label>
              {categories.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800 font-medium">No categories available</p>
                  <p className="text-xs text-amber-600">Create categories first in the "Categories" tab</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-blue-200 rounded-lg p-3 bg-blue-50/30">
                  {categories.map((cat) => (
                    <label key={cat.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${packageForm.categories?.includes(cat.id) ? 'bg-blue-100 border-2 border-blue-400' : 'bg-white hover:bg-gray-50 border-2 border-gray-200'}`}>
                      <Checkbox checked={packageForm.categories?.includes(cat.id)} onCheckedChange={() => toggleCategoryInPackage(cat.id)} />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                          {cat.name}
                          {cat.is_free && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">FREE</span>}
                        </p>
                        <p className="text-xs text-gray-500">{cat.check_points} check points</p>
                      </div>
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color || '#3B82F6' }} />
                    </label>
                  ))}
                </div>
              )}
              {packageForm.categories?.length > 0 && (
                <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-sm font-medium text-emerald-700">{packageForm.categories.length} categories selected</span>
                  <span className="text-sm font-bold text-emerald-800">
                    Total: {categories.filter(c => packageForm.categories?.includes(c.id)).reduce((sum, c) => sum + (c.check_points || 0), 0)} check points
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsPackageModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePackage} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700" data-testid="save-package-btn">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingPackage ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offer Modal */}
      <Dialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="offer-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-orange-500" />
              {editingOffer ? 'Edit Offer' : 'Create Offer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Offer Name *</Label>
              <Input value={offerForm.name} onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })} placeholder="e.g., Christmas Special 2026" data-testid="offer-name-input" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={offerForm.description} onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })} placeholder="e.g., Get 20% off on all inspections" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={offerForm.discount_type} onValueChange={(v) => setOfferForm({ ...offerForm, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value *</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" value={offerForm.discount_value} onChange={(e) => setOfferForm({ ...offerForm, discount_value: parseFloat(e.target.value) || 0 })} placeholder={offerForm.discount_type === 'percentage' ? '20' : '200'} data-testid="offer-discount-input" />
                  <span className="text-gray-500">{offerForm.discount_type === 'percentage' ? '%' : '₹'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From *</Label>
                <Input type="date" value={offerForm.valid_from} onChange={(e) => setOfferForm({ ...offerForm, valid_from: e.target.value })} data-testid="offer-valid-from-input" />
              </div>
              <div className="space-y-2">
                <Label>Valid Until *</Label>
                <Input type="date" value={offerForm.valid_until} onChange={(e) => setOfferForm({ ...offerForm, valid_until: e.target.value })} data-testid="offer-valid-until-input" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={offerForm.is_active} onCheckedChange={(checked) => setOfferForm({ ...offerForm, is_active: checked })} />
              <Label className="cursor-pointer">Active</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsOfferModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveOffer} disabled={saving} className="bg-gradient-to-r from-orange-500 to-red-500" data-testid="save-offer-btn">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingOffer ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
