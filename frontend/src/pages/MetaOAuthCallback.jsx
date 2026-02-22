import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

/**
 * Meta OAuth Callback Page
 * This page handles the redirect from Meta's OAuth flow.
 * It displays a status message and then closes automatically.
 */
export default function MetaOAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Meta authorization...');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDescription || `Authorization failed: ${error}`);
      // Close popup after showing error
      setTimeout(() => {
        window.close();
      }, 3000);
    } else if (code) {
      setStatus('success');
      setMessage('Authorization successful! Closing...');
      // The parent window will detect the URL change and handle the code
      // Close after a brief moment
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      setStatus('error');
      setMessage('No authorization code received');
      setTimeout(() => {
        window.close();
      }, 3000);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
        {status === 'processing' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-800">Processing...</h1>
            <p className="text-gray-600 mt-2">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-green-800">Success!</h1>
            <p className="text-gray-600 mt-2">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-red-800">Authorization Failed</h1>
            <p className="text-gray-600 mt-2">{message}</p>
            <p className="text-sm text-gray-400 mt-4">This window will close automatically.</p>
          </>
        )}
      </div>
    </div>
  );
}
