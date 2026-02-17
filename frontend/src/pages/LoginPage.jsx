import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, Shield, ArrowRight, Globe } from 'lucide-react';
import axios from 'axios';

// Company Logos - Blue version for white backgrounds, White version for blue backgrounds
const COMPANY_LOGO_BLUE = "https://customer-assets.emergentagent.com/job_leadfix-deploy/artifacts/ar0dmd4y_Wisedrive%20New%20Logo%20Horizontal%20Blue%20Trans%20BG.png";
const COMPANY_LOGO_WHITE = "https://customer-assets.emergentagent.com/job_leadfix-deploy/artifacts/hwa244n6_Wisedrive%20new%20logo%20CRM%20.png";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ipCountryDetected, setIpCountryDetected] = useState(false);
  const { login, isAuthenticated, visibleTabs } = useAuth();
  const navigate = useNavigate();

  // Fetch countries and detect IP-based country
  useEffect(() => {
    const fetchCountriesAndDetectIP = async () => {
      try {
        // Fetch available countries from backend
        const countriesResponse = await axios.get(`${API_URL}/api/auth/countries`);
        const availableCountries = countriesResponse.data;
        setCountries(availableCountries);
        
        // Try to detect country from IP using free IP geolocation API
        try {
          const ipResponse = await axios.get('https://ipapi.co/json/', { timeout: 3000 });
          const detectedCountryCode = ipResponse.data?.country_code;
          
          if (detectedCountryCode) {
            // Find matching country in available countries
            const matchingCountry = availableCountries.find(
              c => c.code === detectedCountryCode || c.id === detectedCountryCode
            );
            
            if (matchingCountry) {
              setSelectedCountry(matchingCountry.id);
              setIpCountryDetected(true);
              console.log(`Country auto-detected from IP: ${matchingCountry.name}`);
            }
          }
        } catch (ipError) {
          console.log('IP detection failed, using default country selection');
        }
        
        // If no IP detection or no match, don't auto-select (let user choose)
      } catch (error) {
        console.error('Failed to load countries:', error);
        // Fallback countries if API fails
        setCountries([
          { id: 'IN', name: 'India', code: 'IN' },
          { id: 'MY', name: 'Malaysia', code: 'MY' },
          { id: 'TH', name: 'Thailand', code: 'TH' },
          { id: 'PH', name: 'Philippines', code: 'PH' },
        ]);
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountriesAndDetectIP();
  }, []);

  if (isAuthenticated) {
    // Redirect to first visible tab instead of dashboard
    const tabRouteMap = {
      leads: '/leads',
      customers: '/customers',
      inspections: '/inspections',
      hr: '/hr',
      finance: '/finance',
      settings: '/settings',
      dashboard: '/dashboard',
    };
    const firstTab = visibleTabs?.[0];
    const redirectPath = tabRouteMap[firstTab] || '/leads';
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!selectedCountry) {
      toast.error('Please select a country');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, selectedCountry);
      toast.success('Welcome back!');
      // Navigate to / which will use SmartRedirect to go to the correct tab
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10">
          <img src={COMPANY_LOGO_WHITE} alt="WiseDrive" className="h-12" crossOrigin="anonymous" />
        </div>
        
        <div className="relative z-10 space-y-8">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Manage your leads,<br />
            customers & inspections<br />
            <span className="text-blue-300">with ease.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-md">
            A modern CRM built for automotive warranty and inspection services. Streamline your operations and grow your business.
          </p>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3 pt-4">
            {['Lead Management', 'HR & Payroll', 'Finance', 'Inspections'].map((feature) => (
              <span key={feature} className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white border border-white/20">
                {feature}
              </span>
            ))}
          </div>
        </div>
        
        <p className="relative z-10 text-blue-300 text-sm">
          © 2026 WiseDrive Technologies Private Limited
        </p>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={COMPANY_LOGO_BLUE} alt="WiseDrive" className="h-10" crossOrigin="anonymous" />
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8" data-testid="login-card">
            <div className="text-center mb-8">
              <img src={COMPANY_LOGO_BLUE} alt="WiseDrive" className="h-10 mx-auto mb-6" crossOrigin="anonymous" />
              <h2 className="text-2xl font-bold text-slate-900">
                Welcome back
              </h2>
              <p className="text-slate-500 mt-2">
                Sign in to access your dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Country Selection */}
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium text-slate-700">
                  Select Country
                </Label>
                <Select 
                  value={selectedCountry} 
                  onValueChange={setSelectedCountry}
                  disabled={loadingCountries}
                >
                  <SelectTrigger className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-xl" data-testid="country-select">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-slate-400" />
                      <SelectValue placeholder={loadingCountries ? "Loading..." : "Select a country"} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{country.name}</span>
                          <span className="text-slate-400">({country.code})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-xl"
                    data-testid="email-input"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-xl"
                    data-testid="password-input"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    data-testid="toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    data-testid="remember-checkbox"
                  />
                  <span className="text-sm text-slate-600">Remember me</span>
                </label>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 transition-all"
                disabled={isLoading || !selectedCountry}
                data-testid="login-button"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Need access? Contact your administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
