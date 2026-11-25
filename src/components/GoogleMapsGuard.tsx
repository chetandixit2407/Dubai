import React, { useEffect } from 'react';
import {
  APILoadingStatus,
  useApiIsLoaded,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { Loader2 } from 'lucide-react';

export type MapsErrorReason = 'auth_failure' | 'failed' | 'quota_exceeded';

interface GoogleMapsGuardProps {
  onStatusError?: (reason: MapsErrorReason) => void;
  loadingLabel?: string;
  children: React.ReactNode;
}

let guardMountCount = 0;
let originalGmAuthFailure: (() => void) | undefined;
let gmAuthInstalled = false;

function installGlobalGmAuthFailure() {
  if (typeof window === 'undefined' || gmAuthInstalled) return;
  const win = window as unknown as { gm_authFailure?: () => void };
  originalGmAuthFailure = win.gm_authFailure;
  win.gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: 'AUTH_FAILURE' }));
    if (typeof originalGmAuthFailure === 'function') originalGmAuthFailure();
  };
  gmAuthInstalled = true;
}

function uninstallGlobalGmAuthFailureIfUnused() {
  if (typeof window === 'undefined' || guardMountCount > 0 || !gmAuthInstalled) return;
  const win = window as unknown as { gm_authFailure?: () => void };
  win.gm_authFailure = originalGmAuthFailure;
  originalGmAuthFailure = undefined;
  gmAuthInstalled = false;
}

/**
 * Monitors @vis.gl/react-google-maps loading status and global Google Maps auth/quota events
 * so UI maps show clear loading feedback and cleanly switch to coordinate & SVG map mode on failure.
 */
export const GoogleMapsGuard: React.FC<GoogleMapsGuardProps> = ({
  onStatusError,
  loadingLabel = 'Loading live Google Maps tiles...',
  children,
}) => {
  const status = useApiLoadingStatus();
  const isLoaded = useApiIsLoaded();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: 'AUTH_FAILURE' }));
      onStatusError?.('auth_failure');
    } else if (status === APILoadingStatus.FAILED) {
      onStatusError?.('failed');
    }
  }, [status, onStatusError]);

  useEffect(() => {
    guardMountCount += 1;
    installGlobalGmAuthFailure();
    const handleQuota = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      onStatusError?.(detail === 'AUTH_FAILURE' ? 'auth_failure' : 'quota_exceeded');
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
      guardMountCount = Math.max(0, guardMountCount - 1);
      uninstallGlobalGmAuthFailureIfUnused();
    };
  }, [onStatusError]);

  const showLoading =
    !isLoaded && status !== APILoadingStatus.FAILED && status !== APILoadingStatus.AUTH_FAILURE;

  return (
    <div className="relative w-full h-full">
      {children}
      {showLoading && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#080808]/75 backdrop-blur-[1px]"
        >
          <div className="flex items-center gap-2.5 border border-[#D4AF72]/40 bg-[#121212]/95 px-4 py-2.5 text-xs font-medium text-[#F5F1E8] shadow-xl">
            <Loader2 className="w-4 h-4 animate-spin text-[#D4AF72] shrink-0" />
            <span>{loadingLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};
