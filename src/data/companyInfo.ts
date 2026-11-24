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
        const mergedAddress = {
          ...COMPANY_INFO.address,
          ...(parsed.address || {}),
        };
        const primaryPhone = parsed.primaryPhone || parsed.phone || COMPANY_INFO.primaryPhone;
        const phoneHref = parsed.phoneHref || `tel:${primaryPhone.replace(/\s+/g, '')}`;
        return {
          ...COMPANY_INFO,
          ...parsed,
          address: mergedAddress,
          formattedAddress: mergedAddress.formatted || COMPANY_INFO.formattedAddress,
          primaryPhone,
          phone: primaryPhone,
          phoneHref,
          whatsappNumber: parsed.whatsappNumber || primaryPhone,
          whatsappHref:
            parsed.whatsappHref ||
            `https://wa.me/${(parsed.whatsappNumber || primaryPhone).replace(/[^0-9]/g, '')}`,
          whatsappDeskUrl: (msg?: string) => {
            const num = (parsed.whatsappNumber || primaryPhone).replace(/[^0-9]/g, '');
            return msg
              ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
              : `https://wa.me/${num}`;
          },
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
