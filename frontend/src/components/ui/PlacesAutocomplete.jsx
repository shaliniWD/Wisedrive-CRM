import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './input';
import { MapPin, Loader2, X } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

/**
 * Google Places Autocomplete Component
 * Uses the new Places API (gmp-place-autocomplete) for 2025+
 * Falls back to manual fetch if the web component isn't available
 */
export function PlacesAutocomplete({ 
  value, 
  onChange, 
  onSelect,
  placeholder = "Enter address...",
  className = "",
  disabled = false,
  country = "in" // Default to India
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const wrapperRef = useRef(null);
  const debounceTimer = useRef(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Load Google Maps Script with new Places API
  useEffect(() => {
    if (window.google?.maps?.places) {
      setScriptLoaded(true);
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured');
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places) {
          setScriptLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Wait a bit for the places library to fully initialize
      setTimeout(() => setScriptLoaded(true), 500);
    };
    script.onerror = () => console.error('Failed to load Google Maps script');
    document.head.appendChild(script);
  }, []);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch place suggestions using the new Places API
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3 || !scriptLoaded) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);

    try {
      // Try using the new AutocompleteSuggestion API (2025+)
      if (window.google?.maps?.places?.AutocompleteSuggestion) {
        const { AutocompleteSuggestion } = window.google.maps.places;
        
        const request = {
          input: query,
          includedRegionCodes: [country.toUpperCase()],
          language: 'en', // Request English language responses
        };

        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        
        const formattedSuggestions = results.slice(0, 5).map((suggestion, index) => ({
          id: `suggestion-${index}`,
          placePrediction: suggestion.placePrediction,
          description: suggestion.placePrediction?.text?.text || '',
          mainText: suggestion.placePrediction?.mainText?.text || '',
          secondaryText: suggestion.placePrediction?.secondaryText?.text || '',
        }));

        setSuggestions(formattedSuggestions);
        setShowSuggestions(formattedSuggestions.length > 0);
      } 
      // Fallback to legacy AutocompleteService if still available
      else if (window.google?.maps?.places?.AutocompleteService) {
        const service = new window.google.maps.places.AutocompleteService();
        
        service.getPlacePredictions(
          {
            input: query,
            componentRestrictions: { country: country },
            types: ['address', 'establishment'],
            language: 'en' // Request English language responses
          },
          (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              const formattedSuggestions = predictions.slice(0, 5).map((prediction) => ({
                id: prediction.place_id,
                placeId: prediction.place_id,
                description: prediction.description,
                mainText: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
                secondaryText: prediction.structured_formatting?.secondary_text || prediction.description,
              }));
              setSuggestions(formattedSuggestions);
              setShowSuggestions(formattedSuggestions.length > 0);
            } else {
              setSuggestions([]);
              setShowSuggestions(false);
            }
          }
        );
      } else {
        console.warn('Google Places API not available');
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [scriptLoaded, country]);

  // Debounced input handler
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the API call
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Map of common Indian city names in Devanagari to English
  const cityNameMap = {
    'पुणे': 'Pune',
    'मुंबई': 'Mumbai',
    'बेंगलुरु': 'Bengaluru',
    'बेंगळूरु': 'Bengaluru',
    'बेंगलूरू': 'Bengaluru',
    'दिल्ली': 'Delhi',
    'नई दिल्ली': 'New Delhi',
    'चेन्नई': 'Chennai',
    'हैदराबाद': 'Hyderabad',
    'कोलकाता': 'Kolkata',
    'अहमदाबाद': 'Ahmedabad',
    'जयपुर': 'Jaipur',
    'लखनऊ': 'Lucknow',
    'कानपुर': 'Kanpur',
    'नागपुर': 'Nagpur',
    'इंदौर': 'Indore',
    'थाने': 'Thane',
    'भोपाल': 'Bhopal',
    'विशाखापट्टनम': 'Visakhapatnam',
    'पटना': 'Patna',
    'वडोदरा': 'Vadodara',
    'गाज़ियाबाद': 'Ghaziabad',
    'लुधियाना': 'Ludhiana',
    'आगरा': 'Agra',
    'नाशिक': 'Nashik',
    'फ़रीदाबाद': 'Faridabad',
    'मेरठ': 'Meerut',
    'राजकोट': 'Rajkot',
    'वाराणसी': 'Varanasi',
    'श्रीनगर': 'Srinagar',
    'औरंगाबाद': 'Aurangabad',
    'धनबाद': 'Dhanbad',
    'अमृतसर': 'Amritsar',
    'नवी मुंबई': 'Navi Mumbai',
    'इलाहाबाद': 'Allahabad',
    'प्रयागराज': 'Prayagraj',
    'हावड़ा': 'Howrah',
    'रांची': 'Ranchi',
    'कोयंबटूर': 'Coimbatore',
    'जबलपुर': 'Jabalpur',
    'ग्वालियर': 'Gwalior',
    'विजयवाड़ा': 'Vijayawada',
    'जोधपुर': 'Jodhpur',
    'मदुरै': 'Madurai',
    'रायपुर': 'Raipur',
    'कोटा': 'Kota',
    'गुवाहाटी': 'Guwahati',
    'चंडीगढ़': 'Chandigarh',
    'सोलापुर': 'Solapur',
    'हुबली': 'Hubli',
    'महाराष्ट्र': 'Maharashtra',
    'कर्नाटक': 'Karnataka',
    'तमिलनाडु': 'Tamil Nadu',
    'उत्तर प्रदेश': 'Uttar Pradesh',
    'गुजरात': 'Gujarat',
    'राजस्थान': 'Rajasthan',
  };
  
  // Helper function to normalize city name to English
  const normalizeCityName = (cityName) => {
    if (!cityName) return null;
    
    // Check if it's in the mapping
    if (cityNameMap[cityName]) {
      return cityNameMap[cityName];
    }
    
    // Check if it's already in English (ASCII characters)
    if (/^[A-Za-z\s]+$/.test(cityName)) {
      return cityName;
    }
    
    // Try to find a partial match
    for (const [devanagari, english] of Object.entries(cityNameMap)) {
      if (cityName.includes(devanagari) || devanagari.includes(cityName)) {
        return english;
      }
    }
    
    // Return original if no match found
    return cityName;
  };

  // Handle suggestion selection
  const handleSelect = async (suggestion) => {
    setLoading(true);
    
    try {
      let address = suggestion.description;
      let lat = null;
      let lng = null;
      let city = null;

      // Try to get place details for coordinates and city
      if (suggestion.placePrediction?.toPlace) {
        // New API - fetch place details
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'] });
        
        address = place.formattedAddress || suggestion.description;
        lat = place.location?.lat();
        lng = place.location?.lng();
        
        // Extract city from address components - try multiple types
        if (place.addressComponents) {
          for (const component of place.addressComponents) {
            // Try locality first (most specific city)
            if (component.types?.includes('locality')) {
              city = component.longText || component.shortText;
              break;
            }
          }
          // If no locality, try administrative_area_level_2 (district/county)
          if (!city) {
            for (const component of place.addressComponents) {
              if (component.types?.includes('administrative_area_level_2')) {
                city = component.longText || component.shortText;
                break;
              }
            }
          }
          // If still no city, try administrative_area_level_1 (state - for places directly in state)
          if (!city) {
            for (const component of place.addressComponents) {
              if (component.types?.includes('administrative_area_level_1')) {
                city = component.longText || component.shortText;
                break;
              }
            }
          }
        }
        
        // Normalize city name to English
        city = normalizeCityName(city);
      } else if (suggestion.placeId && window.google?.maps?.places?.PlacesService) {
        // Legacy API - use PlacesService
        const dummyDiv = document.createElement('div');
        const service = new window.google.maps.places.PlacesService(dummyDiv);
        
        await new Promise((resolve) => {
          service.getDetails(
            { placeId: suggestion.placeId, fields: ['formatted_address', 'geometry', 'address_components'], language: 'en' },
            (place, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                address = place.formatted_address || suggestion.description;
                lat = place.geometry?.location?.lat();
                lng = place.geometry?.location?.lng();
                
                // Extract city from address components - try multiple types
                if (place.address_components) {
                  // Try locality first
                  for (const component of place.address_components) {
                    if (component.types?.includes('locality')) {
                      city = component.long_name || component.short_name;
                      break;
                    }
                  }
                  // If no locality, try administrative_area_level_2
                  if (!city) {
                    for (const component of place.address_components) {
                      if (component.types?.includes('administrative_area_level_2')) {
                        city = component.long_name || component.short_name;
                        break;
                      }
                    }
                  }
                  // If still no city, try administrative_area_level_1
                  if (!city) {
                    for (const component of place.address_components) {
                      if (component.types?.includes('administrative_area_level_1')) {
                        city = component.long_name || component.short_name;
                        break;
                      }
                    }
                  }
                }
                
                // Normalize city name to English
                city = normalizeCityName(city);
              }
              resolve();
            }
          );
        });
      }

      setInputValue(address);
      onChange(address);
      
      if (onSelect) {
        onSelect({
          address,
          latitude: lat,
          longitude: lng,
          city,
        });
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      // Fallback to just using the description
      setInputValue(suggestion.description);
      onChange(suggestion.description);
      if (onSelect) {
        onSelect({ address: suggestion.description });
      }
    } finally {
      setLoading(false);
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Clear input
  const handleClear = () => {
    setInputValue('');
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (onSelect) {
      onSelect({ address: '', latitude: null, longitude: null, city: null });
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className={`pl-10 pr-10 ${className}`}
          disabled={disabled}
          data-testid="places-autocomplete-input"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
        {!loading && inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b last:border-b-0 flex items-start gap-3 transition-colors"
              data-testid={`place-suggestion-${suggestion.id}`}
            >
              <MapPin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {suggestion.mainText}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {suggestion.secondaryText}
                </p>
              </div>
            </button>
          ))}
          <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 flex items-center gap-1">
            <span>Powered by Google</span>
          </div>
        </div>
      )}

      {/* Debug info - only in development */}
      {!scriptLoaded && !GOOGLE_MAPS_API_KEY && (
        <p className="text-xs text-amber-600 mt-1">
          Address autocomplete unavailable - API key not configured
        </p>
      )}
    </div>
  );
}

export default PlacesAutocomplete;
