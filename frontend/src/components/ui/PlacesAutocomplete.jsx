import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './input';
import { MapPin, Loader2, X } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

/**
 * Google Places Autocomplete Component
 * Shows address suggestions as user types
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
  const autocompleteService = useRef(null);
  const placesService = useRef(null);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // Load Google Maps Script
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
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps script');
    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount as other components might need it
    };
  }, []);

  // Initialize services when script loads
  useEffect(() => {
    if (scriptLoaded && window.google?.maps?.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      // Create a dummy div for PlacesService (required but not displayed)
      const dummyDiv = document.createElement('div');
      placesService.current = new window.google.maps.places.PlacesService(dummyDiv);
    }
  }, [scriptLoaded]);

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

  // Debounced search function
  const searchPlaces = useCallback((inputValue) => {
    if (!inputValue || inputValue.length < 3 || !autocompleteService.current) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    
    autocompleteService.current.getPlacePredictions(
      {
        input: inputValue,
        componentRestrictions: { country: country },
        types: ['address', 'establishment']
      },
      (predictions, status) => {
        setLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.slice(0, 5)); // Limit to 5 suggestions
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      }
    );
  }, [country]);

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value) {
        searchPlaces(value);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, searchPlaces]);

  // Handle suggestion selection
  const handleSelect = (suggestion) => {
    // Get place details for lat/lng
    if (placesService.current && suggestion.place_id) {
      placesService.current.getDetails(
        { placeId: suggestion.place_id, fields: ['formatted_address', 'geometry'] },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            const address = place.formatted_address || suggestion.description;
            const lat = place.geometry?.location?.lat();
            const lng = place.geometry?.location?.lng();
            
            onChange(address);
            if (onSelect) {
              onSelect({
                address,
                latitude: lat,
                longitude: lng,
                placeId: suggestion.place_id
              });
            }
          } else {
            // Fallback to just the description
            onChange(suggestion.description);
            if (onSelect) {
              onSelect({ address: suggestion.description });
            }
          }
        }
      );
    } else {
      onChange(suggestion.description);
      if (onSelect) {
        onSelect({ address: suggestion.description });
      }
    }
    
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Clear input
  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (onSelect) {
      onSelect({ address: '', latitude: null, longitude: null });
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className={`pl-10 pr-10 ${className}`}
          disabled={disabled}
          data-testid="places-autocomplete-input"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
        {!loading && value && (
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
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b last:border-b-0 flex items-start gap-3 transition-colors"
              data-testid={`place-suggestion-${suggestion.place_id}`}
            >
              <MapPin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {suggestion.structured_formatting?.main_text || suggestion.description.split(',')[0]}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {suggestion.structured_formatting?.secondary_text || suggestion.description}
                </p>
              </div>
            </button>
          ))}
          <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 flex items-center gap-1">
            <span>Powered by</span>
            <img 
              src="https://developers.google.com/static/maps/images/google_on_white.png" 
              alt="Google" 
              className="h-3"
            />
          </div>
        </div>
      )}

      {/* No API key fallback message */}
      {!GOOGLE_MAPS_API_KEY && (
        <p className="text-xs text-amber-600 mt-1">
          Address autocomplete unavailable - API key not configured
        </p>
      )}
    </div>
  );
}

export default PlacesAutocomplete;
