import React, { useEffect } from 'react';
import { APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps';

interface GoogleMapsGuardProps {
  onStatusError?: (reason: 'auth_failure' | 'failed' | 'quota_exceeded') => void;
  children: React.ReactNode;
}

/**
 * Monitors @vis.gl/react-google-maps loading status and global Google Maps auth/quota events
 * so UI maps cleanly switch to coordinate & geocoding fallback instead of showing a blank tile box.
 */
export const GoogleMapsGuard: React.FC<GoogleMapsGuardProps> = ({ onStatusError, children }) => {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: 'AUTH_FAILURE' }));
      onStatusError?.('auth_failure');
    } else if (status === APILoadingStatus.FAILED) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: 'FAILED' }));
      onStatusError?.('failed');
    }
  }, [status, onStatusError]);

  useEffect(() => {
    const handleQuota = () => onStatusError?.('quota_exceeded');
    const prevAuthFailure = (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: 'AUTH_FAILURE' }));
      onStatusError?.('auth_failure');
      if (typeof prevAuthFailure === 'function') prevAuthFailure();
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = prevAuthFailure;
    };
  }, [onStatusError]);

  return <>{children}</>;
};
