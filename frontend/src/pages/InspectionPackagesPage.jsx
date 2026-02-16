import React, { useState, useEffect, useCallback } from 'react';
import { inspectionPackagesApi, hrApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, Search, Settings, Package,
  CheckCircle, X, ListChecks, Car, IndianRupee, Award, Layers,
  ChevronDown, ChevronUp, GripVertical, Copy, PauseCircle, PlayCircle
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
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onCopy(category)}
              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Copy & Create New"
              data-testid={`copy-category-${category.id}`}
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => onEdit(category)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              data-testid={`edit-category-${category.id}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onToggle(category)}
              className={`p-2 rounded-lg transition-colors ${category.is_active !== false ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
              title={category.is_active !== false ? 'Deactivate' : 'Activate'}
              data-testid={`toggle-category-${category.id}`}
            >
              {category.is_active !== false ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Main Inspection Items */}
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
            
            {/* Additional Benefits */}
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
const PackageCard = ({ pkg, categories, onEdit, onToggle, onDelete }) => {
  const includedCategories = categories.filter(c => pkg.categories?.includes(c.id));
  
  return (
    <div 
      className={`border rounded-xl overflow-hidden transition-all ${pkg.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'}`}
      data-testid={`package-card-${pkg.id}`}
    >
      {/* Package Header */}
      <div className={`p-4 ${pkg.is_recommended ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-slate-50 border-b'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${pkg.is_recommended ? 'bg-white/20' : 'bg-white border'}`}>
              <Package className={`h-5 w-5 ${pkg.is_recommended ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className={`font-semibold flex items-center gap-2 ${pkg.is_recommended ? 'text-white' : 'text-gray-900'}`}>
                {pkg.name}
                {pkg.is_recommended && (
                  <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-medium rounded-full flex items-center gap-1">
                    <Award className="h-3 w-3" /> Recommended
                  </span>
                )}
              </h3>
              <div className={`flex items-center gap-3 text-sm ${pkg.is_recommended ? 'text-blue-100' : 'text-gray-500'}`}>
                <span>{pkg.total_check_points}+ Check Points</span>
                <span>•</span>
                <span className="font-medium">{pkg.no_of_inspections || 1} Inspection{(pkg.no_of_inspections || 1) > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <div className={`text-right ${pkg.is_recommended ? 'text-white' : ''}`}>
            <p className="text-2xl font-bold">
              {pkg.currency_symbol}{pkg.price?.toLocaleString('en-IN')}
            </p>
            <p className={`text-xs ${pkg.is_recommended ? 'text-blue-100' : 'text-gray-500'}`}>Incl. all taxes</p>
          </div>
        </div>
      </div>
      
      {/* Included Categories */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">Includes:</p>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
            {pkg.no_of_inspections || 1} Inspection{(pkg.no_of_inspections || 1) > 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-2">
          {includedCategories.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No categories assigned</p>
          ) : includedCategories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: cat.color || '#3B82F6' }}
                />
                <span className="text-gray-700">{cat.name}</span>
                {cat.is_free && (
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">FREE</span>
                )}
              </div>
              <span className="text-gray-500">{cat.check_points} pts</span>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(pkg)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                pkg.is_active ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              data-testid={`toggle-package-${pkg.id}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                pkg.is_active ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className={`text-sm ${pkg.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
              {pkg.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(pkg)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              data-testid={`edit-package-${pkg.id}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(pkg)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              data-testid={`delete-package-${pkg.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
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
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  
  // Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    check_points: 0,
    icon: '',
    color: '#3B82F6',
    items: [],
    benefits: [],
    is_free: false,
    order: 0,
  });
  
  // Package form
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    price: 0,
    currency: 'INR',
    currency_symbol: '₹',
    categories: [],
    no_of_inspections: 1,
    is_recommended: false,
    order: 0,
    brands_covered: [],
  });
  
  // New item inputs
  const [newItem, setNewItem] = useState('');
  const [newBenefit, setNewBenefit] = useState('');

  const fetchCountries = useCallback(async () => {
    try {
      const response = await hrApi.getAllCountries();
      setCountries(response.data || []);
      // Auto-select user's country
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
      const [categoriesRes, packagesRes] = await Promise.all([
        inspectionPackagesApi.getCategories(selectedCountry),
        inspectionPackagesApi.getPackages(selectedCountry),
      ]);
      setCategories(categoriesRes.data || []);
      setPackages(packagesRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load inspection packages');
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
        name: category.name || '',
        description: category.description || '',
        check_points: category.check_points || 0,
        icon: category.icon || '',
        color: category.color || '#3B82F6',
        items: category.items || [],
        benefits: category.benefits || [],
        is_free: category.is_free || false,
        order: category.order || 0,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        check_points: 0,
        icon: '',
        color: '#3B82F6',
        items: [],
        benefits: [],
        is_free: false,
        order: categories.length,
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) {
      toast.error('Please enter category name');
      return;
    }
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

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    try {
      await inspectionPackagesApi.deleteCategory(category.id);
      toast.success('Category deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  // Package Modal Functions
  const openPackageModal = (pkg = null) => {
    if (pkg) {
      setEditingPackage(pkg);
      setPackageForm({
        name: pkg.name || '',
        description: pkg.description || '',
        price: pkg.price || 0,
        currency: pkg.currency || 'INR',
        currency_symbol: pkg.currency_symbol || '₹',
        categories: pkg.categories || [],
        no_of_inspections: pkg.no_of_inspections || 1,
        is_recommended: pkg.is_recommended || false,
        order: pkg.order || 0,
        brands_covered: pkg.brands_covered || [],
      });
    } else {
      setEditingPackage(null);
      setPackageForm({
        name: '',
        description: '',
        price: 0,
        currency: 'INR',
        currency_symbol: '₹',
        categories: [],
        no_of_inspections: 1,
        is_recommended: false,
        order: packages.length,
        brands_covered: [],
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

  const handleDeletePackage = async (pkg) => {
    if (!window.confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return;
    try {
      await inspectionPackagesApi.deletePackage(pkg.id);
      toast.success('Package deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete package');
    }
  };

  // Add/Remove items
  const addItem = () => {
    if (!newItem.trim()) return;
    setCategoryForm({
      ...categoryForm,
      items: [...categoryForm.items, { name: newItem.trim() }],
    });
    setNewItem('');
  };

  const removeItem = (index) => {
    setCategoryForm({
      ...categoryForm,
      items: categoryForm.items.filter((_, i) => i !== index),
    });
  };

  const addBenefit = () => {
    if (!newBenefit.trim()) return;
    setCategoryForm({
      ...categoryForm,
      benefits: [...categoryForm.benefits, { name: newBenefit.trim() }],
    });
    setNewBenefit('');
  };

  const removeBenefit = (index) => {
    setCategoryForm({
      ...categoryForm,
      benefits: categoryForm.benefits.filter((_, i) => i !== index),
    });
  };

  // Toggle category selection in package
  const toggleCategoryInPackage = (categoryId) => {
    const current = packageForm.categories || [];
    if (current.includes(categoryId)) {
      setPackageForm({ ...packageForm, categories: current.filter(id => id !== categoryId) });
    } else {
      setPackageForm({ ...packageForm, categories: [...current, categoryId] });
    }
  };

  const selectedCountryData = countries.find(c => c.id === selectedCountry);

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="inspection-packages-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspection Packages</h1>
          <p className="text-gray-500 mt-1">Configure inspection categories and packages</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Country Selector */}
          <Select value={selectedCountry || 'select'} onValueChange={(v) => setSelectedCountry(v === 'select' ? '' : v)}>
            <SelectTrigger className="w-48" data-testid="country-selector">
              <SelectValue placeholder="Select Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="select">-- Select Country --</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex border-b bg-slate-50">
          <button
            onClick={() => setActiveTab('packages')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
              activeTab === 'packages' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="packages-tab"
          >
            <Package className="h-4 w-4" /> Packages
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
              activeTab === 'categories' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="categories-tab"
          >
            <Layers className="h-4 w-4" /> Categories
          </button>
        </div>

        {/* Packages Tab */}
        {activeTab === 'packages' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">
                Create and manage inspection packages for {selectedCountryData?.name || 'your organization'}
              </p>
              <button 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                onClick={() => openPackageModal()}
                data-testid="create-package-btn"
              >
                <Plus className="h-4 w-4" /> Create Package
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-gray-500 mt-2">Loading packages...</p>
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-gray-50">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No packages found</p>
                <button 
                  onClick={() => openPackageModal()}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create your first package
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    categories={categories}
                    onEdit={openPackageModal}
                    onToggle={handleTogglePackage}
                    onDelete={handleDeletePackage}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">
                Define inspection categories and their check points
              </p>
              <button 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                onClick={() => openCategoryModal()}
                data-testid="create-category-btn"
              >
                <Plus className="h-4 w-4" /> Create Category
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-gray-500 mt-2">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-gray-50">
                <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No categories found</p>
                <button 
                  onClick={() => openCategoryModal()}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create your first category
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={openCategoryModal}
                    onDelete={handleDeleteCategory}
                  />
                ))}
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
                <Input 
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g., Physical/Manual Inspection"
                  data-testid="category-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Check Points</Label>
                <Input 
                  type="number"
                  value={categoryForm.check_points}
                  onChange={(e) => setCategoryForm({ ...categoryForm, check_points: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 135"
                  data-testid="category-checkpoints-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Brief description of this category"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="h-10 w-14 rounded cursor-pointer"
                  />
                  <Input 
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input 
                  type="number"
                  value={categoryForm.order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                checked={categoryForm.is_free}
                onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_free: checked })}
                data-testid="category-is-free-checkbox"
              />
              <Label className="cursor-pointer">Mark as FREE (e.g., Additional Technical Support)</Label>
            </div>

            {/* Inspection Items */}
            <div className="space-y-2">
              <Label>Inspection Items</Label>
              <div className="flex gap-2">
                <Input 
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="e.g., Engine & Transmission Check"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
                  data-testid="new-item-input"
                />
                <Button type="button" onClick={addItem} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1 mt-2">
                {categoryForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="flex-1 text-sm">{item.name}</span>
                    <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Benefits */}
            <div className="space-y-2">
              <Label>Additional Benefits</Label>
              <div className="flex gap-2">
                <Input 
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  placeholder="e.g., Flood Vehicle Check"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                  data-testid="new-benefit-input"
                />
                <Button type="button" onClick={addBenefit} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1 mt-2">
                {categoryForm.benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                    <Plus className="h-4 w-4 text-blue-500" />
                    <span className="flex-1 text-sm">{benefit.name}</span>
                    <button onClick={() => removeBenefit(idx)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCategory} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700" data-testid="save-category-btn">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Package Modal */}
      <Dialog open={isPackageModalOpen} onOpenChange={setIsPackageModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="package-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {editingPackage ? 'Edit Package' : 'Create Package'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Package Name *</Label>
                <Input 
                  value={packageForm.name}
                  onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                  placeholder="e.g., Standard, Luxury"
                  data-testid="package-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Price *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-gray-500">{packageForm.currency_symbol}</span>
                  <Input 
                    type="number"
                    value={packageForm.price}
                    onChange={(e) => setPackageForm({ ...packageForm, price: parseFloat(e.target.value) || 0 })}
                    placeholder="1300"
                    data-testid="package-price-input"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. of Inspections *</Label>
                <Input 
                  type="number"
                  min="1"
                  value={packageForm.no_of_inspections}
                  onChange={(e) => setPackageForm({ ...packageForm, no_of_inspections: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  data-testid="package-inspections-input"
                />
                <p className="text-xs text-gray-500">Number of inspections customer can avail</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  value={packageForm.description}
                  onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                checked={packageForm.is_recommended}
                onCheckedChange={(checked) => setPackageForm({ ...packageForm, is_recommended: checked })}
                data-testid="package-is-recommended-checkbox"
              />
              <Label className="cursor-pointer">Mark as Recommended</Label>
            </div>

            {/* Select Categories - IMPORTANT SECTION */}
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                Assign Categories to Package *
              </Label>
              <p className="text-xs text-gray-500 mb-2">Select which inspection categories are included in this package</p>
              {categories.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800 font-medium">⚠️ No categories available</p>
                  <p className="text-xs text-amber-600 mt-1">Please create inspection categories first in the "Categories" tab, then come back to create packages.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border-2 border-blue-200 rounded-lg p-3 bg-blue-50/30">
                  {categories.map((cat) => (
                    <label 
                      key={cat.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        packageForm.categories?.includes(cat.id) 
                          ? 'bg-blue-100 border-2 border-blue-400 shadow-sm' 
                          : 'bg-white hover:bg-gray-50 border-2 border-gray-200'
                      }`}
                      data-testid={`category-option-${cat.id}`}
                    >
                      <Checkbox 
                        checked={packageForm.categories?.includes(cat.id)}
                        onCheckedChange={() => toggleCategoryInPackage(cat.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                          {cat.name}
                          {cat.is_free && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">FREE</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{cat.check_points} check points • {cat.items?.length || 0} items</p>
                      </div>
                      <div 
                        className="h-4 w-4 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: cat.color || '#3B82F6' }}
                      />
                    </label>
                  ))}
                </div>
              )}
              {packageForm.categories?.length > 0 && (
                <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-sm font-medium text-emerald-700">
                    {packageForm.categories.length} categories selected
                  </span>
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
    </div>
  );
}
