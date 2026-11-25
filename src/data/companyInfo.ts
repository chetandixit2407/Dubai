import { useEffect, useState } from 'react';

export interface OfficeAddress {
  street: string;
  building: string;
  area: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  formatted: string;
}

export interface CompanyInformation {
  name: string;
  brandTagline: string;
  address: OfficeAddress;
  formattedAddress: string;
  shortAddress: string;
  primaryPhone: string;
  phone: string;
  primaryPhoneRaw: string;
  phoneHref: string;
  whatsappNumber: string;
  whatsappHref: string;
  email: string;
  emailHref: string;
  website: string;
  mapsDirectionsUrl: string;
  googleMapsSearchUrl: string;
  whatsappDeskUrl: (customMessage?: string) => string;
  officeCoordinates: {
    lat: number;
    lng: number;
  };
}

export const COMPANY_INFO: CompanyInformation = {
  name: 'WHITE COLLAR REALTY',
  brandTagline: 'UAE Real Estate Intelligence & Institutional Project Discovery',
  address: {
    street: '6th Floor, Tower A',
    building: 'M3M Urbana Business Park',
    area: 'Golf Course Extension Road, Sector 67',
    city: 'Gurugram',
    state: 'Haryana',
    postalCode: '122101',
    country: 'India',
    formatted:
      '6th Floor, Tower A, M3M Urbana Business Park, Golf Course Extension Road, Sector 67, Gurugram, Haryana 122101, India.',
  },
  formattedAddress:
    '6th Floor, Tower A, M3M Urbana Business Park, Golf Course Extension Road, Sector 67, Gurugram, Haryana 122101, India.',
  shortAddress: 'M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101, India',
  primaryPhone: '+91 88102 86629',
  phone: '+91 88102 86629',
  primaryPhoneRaw: '+918810286629',
  phoneHref: 'tel:+918810286629',
  whatsappNumber: '+91 88102 86629',
  whatsappHref: 'https://wa.me/918810286629',
  email: 'info@whitecollarrealty.com',
  emailHref: 'mailto:info@whitecollarrealty.com',
  website: 'https://whitecollarrealty.com',
  mapsDirectionsUrl:
    'https://www.google.com/maps/search/?api=1&query=White+Collar+Realty+M3M+Urbana+Business+Park+Sector+67+Gurugram',
  googleMapsSearchUrl:
    'https://www.google.com/maps/search/?api=1&query=White+Collar+Realty+M3M+Urbana+Business+Park+Sector+67+Gurugram',
  whatsappDeskUrl: (msg?: string) =>
    msg
      ? `https://wa.me/918810286629?text=${encodeURIComponent(msg)}`
      : 'https://wa.me/918810286629',
  officeCoordinates: {
    lat: 28.3913,
    lng: 77.0668,
  },
};

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
