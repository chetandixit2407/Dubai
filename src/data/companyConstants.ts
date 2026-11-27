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
