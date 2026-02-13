import React, { useState, useEffect, useCallback } from 'react';
import { employeesApi, utilityApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Loader2, MapPin } from 'lucide-react';

export default function AdminPage() {
  const [employees, setEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('employee');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    assigned_cities: [],
    is_active: true,
  });

  const fetchData = useCallback(async () => {
    try {
      const [employeesRes, citiesRes] = await Promise.all([
        employeesApi.getAll(),
        utilityApi.getCities(),
      ]);

      setEmployees(employeesRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      await employeesApi.create(formData);
      toast.success('Employee created successfully');
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save employee:', error);
      toast.error(error.response?.data?.detail || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      assigned_cities: [],
      is_active: true,
    });
  };

  const handleToggleStatus = async (employeeId) => {
    try {
      await employeesApi.toggleStatus(employeeId);
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update status');
    }
  };

  const openCityModal = (employee) => {
    setSelectedEmployee(employee);
    setSelectedCity('');
    setIsCityModalOpen(true);
  };

  const handleAssignCity = async () => {
    if (!selectedCity) {
      toast.error('Please select a city');
      return;
    }

    try {
      await employeesApi.assignCity(selectedEmployee.id, selectedCity);
      toast.success('City assigned successfully');
      setIsCityModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to assign city:', error);
      toast.error('Failed to assign city');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-page">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b">
            <TabsList className="h-auto p-0 bg-transparent">
              <TabsTrigger 
                value="employee" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#4F46E5] data-[state=active]:bg-transparent px-6 py-4"
                data-testid="employee-tab"
              >
                Employee
              </TabsTrigger>
              <TabsTrigger 
                value="digital-ad" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#4F46E5] data-[state=active]:bg-transparent px-6 py-4"
                data-testid="digital-ad-tab"
              >
                Digital Ad Meta Data
              </TabsTrigger>
              <TabsTrigger 
                value="garage" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#4F46E5] data-[state=active]:bg-transparent px-6 py-4"
                data-testid="garage-tab"
              >
                Garage Employee
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Employee Tab Content */}
          <TabsContent value="employee" className="p-0 m-0">
            <div className="p-6">
              <div className="flex justify-end mb-4">
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-[#4F46E5] hover:bg-[#4338CA]"
                  data-testid="add-employee-button"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Employee
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Assigned Cities</TableHead>
                    <TableHead className="font-semibold">City</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No employees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((employee) => (
                      <TableRow key={employee.id} className="table-row-hover" data-testid={`employee-row-${employee.id}`}>
                        <TableCell className="font-medium">{employee.name}</TableCell>
                        <TableCell>
                          {employee.assigned_cities && employee.assigned_cities.length > 0 
                            ? employee.assigned_cities.join(', ') 
                            : 'No Cities Assigned'}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            className="bg-[#10B981] hover:bg-[#059669]"
                            onClick={() => openCityModal(employee)}
                            data-testid={`assign-city-${employee.id}`}
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            Assign City
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={employee.is_active}
                              onCheckedChange={() => handleToggleStatus(employee.id)}
                              data-testid={`toggle-status-${employee.id}`}
                            />
                            <span className={employee.is_active ? 'text-[#10B981]' : 'text-muted-foreground'}>
                              {employee.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            className="bg-[#6366F1] hover:bg-[#4F46E5]"
                            data-testid={`edit-employee-${employee.id}`}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Digital Ad Tab Content */}
          <TabsContent value="digital-ad" className="p-6">
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-lg">Digital Ad Meta Data Management</p>
              <p className="text-sm mt-2">Configure your digital advertising metadata here</p>
            </div>
          </TabsContent>

          {/* Garage Tab Content */}
          <TabsContent value="garage" className="p-6">
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-lg">Garage Employee Management</p>
              <p className="text-sm mt-2">Manage garage employees and mechanics here</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Employee Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="employee-modal">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Add Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                  data-testid="employee-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                  data-testid="employee-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  data-testid="employee-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger data-testid="employee-role-select">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#4F46E5] hover:bg-[#4338CA]" disabled={saving} data-testid="save-employee-button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign City Modal */}
      <Dialog open={isCityModalOpen} onOpenChange={setIsCityModalOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="assign-city-modal">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Assign City</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>Employee: <span className="font-semibold">{selectedEmployee?.name}</span></Label>
            </div>
            <div className="space-y-2 mt-4">
              <Label htmlFor="city">Select City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger data-testid="city-select">
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCityModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignCity} className="bg-[#4F46E5] hover:bg-[#4338CA]" data-testid="confirm-assign-city">
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
