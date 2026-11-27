import { useEffect, useState } from 'react';
import {
  COMPANY_INFO,
  CompanyInformation,
  OfficeAddress,
} from './companyConstants.ts';

export type { CompanyInformation, OfficeAddress };
export { COMPANY_INFO };

const STORAGE_KEY = 'wcr_company_settings_override';

export function getEffectiveCompanyInfo(): CompanyInformation {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const mergedAddress: OfficeAddress = {
          ...COMPANY_INFO.address,
          ...(parsed.address || {}),
        };
        const primaryPhone = String(parsed.primaryPhone || parsed.phone || COMPANY_INFO.primaryPhone).trim();
        const primaryPhoneRaw = primaryPhone.replace(/\s+/g, '');
        const phoneHref = `tel:${primaryPhoneRaw}`;
        const whatsappNumber = String(parsed.whatsappNumber || primaryPhone).trim();
        const waDigits = whatsappNumber.replace(/[^0-9]/g, '') || '918810286629';
        const email = String(parsed.email || COMPANY_INFO.email).trim();
        const shortAddressParts = [
          mergedAddress.building,
          mergedAddress.area,
          mergedAddress.city,
          mergedAddress.state,
          mergedAddress.postalCode,
          mergedAddress.country,
        ]
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          ...COMPANY_INFO,
          ...parsed,
          address: mergedAddress,
          formattedAddress:
            mergedAddress.formatted || parsed.formattedAddress || COMPANY_INFO.formattedAddress,
          shortAddress:
            shortAddressParts.length > 0
              ? shortAddressParts.join(', ')
              : COMPANY_INFO.shortAddress,
          primaryPhone,
          phone: primaryPhone,
          primaryPhoneRaw,
          phoneHref,
          whatsappNumber,
          whatsappHref: `https://wa.me/${waDigits}`,
          email,
          emailHref: `mailto:${email}`,
          whatsappDeskUrl: (msg?: string) =>
            msg
              ? `https://wa.me/${waDigits}?text=${encodeURIComponent(msg)}`
              : `https://wa.me/${waDigits}`,
          officeCoordinates: {
            ...COMPANY_INFO.officeCoordinates,
            ...(parsed.officeCoordinates || {}),
          },
        };
      }
    } catch {
      // Fallback to default COMPANY_INFO
    }
  }
  return COMPANY_INFO;
}

export function saveCompanyInfoOverride(info: Partial<CompanyInformation>): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
      window.dispatchEvent(new CustomEvent('wcr-company-info-updated', { detail: info }));
    } catch {
      // Storage unavailable
    }
  }
}

export function useCompanyInfo(): CompanyInformation {
  const [info, setInfo] = useState<CompanyInformation>(() => getEffectiveCompanyInfo());

  useEffect(() => {
    const sync = () => setInfo(getEffectiveCompanyInfo());
    window.addEventListener('wcr-company-info-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('wcr-company-info-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return info;
}
