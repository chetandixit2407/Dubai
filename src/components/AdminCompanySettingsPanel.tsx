import React, { useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  COMPANY_INFO,
  CompanyInformation,
  getEffectiveCompanyInfo,
  saveCompanyInfoOverride,
} from '../data/companyInfo.ts';
import { geocodeAddressOnServer } from '../services/apiClient.ts';
import { isValidCoordinate } from '../utils/coordinates.ts';
import { OfficeLocationMap } from './OfficeLocationMap.tsx';

interface AdminCompanySettingsPanelProps {
  mapsApiKey?: string;
  onReplayIntro?: () => void;
}

export const AdminCompanySettingsPanel: React.FC<AdminCompanySettingsPanelProps> = ({
  mapsApiKey,
  onReplayIntro,
}) => {
  const [info, setInfo] = useState<CompanyInformation>(() => getEffectiveCompanyInfo());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [geocodingOffice, setGeocodingOffice] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleGeocodeOffice = async () => {
    const query = info.address.formatted.trim();
    if (!query) return;
    setGeocodingOffice(true);
    setGeocodeMsg(null);
    try {
      const res = await geocodeAddressOnServer(query, 'any');
      setInfo((prev) => ({
        ...prev,
        officeCoordinates: { lat: res.primary.lat, lng: res.primary.lng },
        mapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${res.primary.lat},${res.primary.lng}`,
      }));
      setGeocodeMsg(`Located: ${res.primary.formattedAddress}`);
    } catch (err) {
      setGeocodeMsg(err instanceof Error ? err.message : 'Unable to geocode office address.');
    } finally {
      setGeocodingOffice(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveCompanyInfoOverride(info);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wcr_company_settings_override');
    }
    setInfo(COMPANY_INFO);
    saveCompanyInfoOverride(COMPANY_INFO);
    setGeocodeMsg(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header Banner */}
      <div className="bg-[#121212] text-[#F5F1E8] p-4 sm:p-6 border border-[#D4AF72]/25 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#D4AF72]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Official Corporate Registry & Contact Configuration</span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-semibold mt-1 text-[#F5F1E8]">
              White Collar Realty Institutional Master Profile
            </h3>
            <p className="text-xs text-[#A5A19A] mt-1 max-w-2xl leading-relaxed">
              Global source of truth for headquarters address, verified phone/WhatsApp numbers, institutional email, website URLs, and Google Maps integration across all public headers, footers, dossiers, and enquiry channels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onReplayIntro && (
              <button
                type="button"
                onClick={onReplayIntro}
                className="px-3.5 py-2 border border-[#D4AF72]/40 bg-[#1B1B1B] text-[#D4AF72] text-xs font-medium hover:bg-[#D4AF72] hover:text-[#080808] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Replay Intro</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 border border-[#D4AF72]/25 text-[#F5F1E8] text-xs hover:border-[#D4AF72] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-[#064E3B]/45 border border-[#34D399]/35 p-4 text-xs text-[#6EE7B7] flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4" />
            <span>Company details successfully updated across all website components.</span>
          </div>
        </div>
      )}

      {/* Quick Verified Reference Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 text-xs">
        <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[#A5A19A] block text-[11px] uppercase tracking-wider">Primary Phone</span>
            <span className="font-mono-tabular font-bold text-sm text-[#F5F1E8] block mt-1 break-all">
              {info.primaryPhone}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#D4AF72]/15 flex items-center justify-between">
            <a href={info.phoneHref} className="text-[#6EE7B7] font-medium hover:underline flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>Test Call (tel:)</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.primaryPhone, 'phone')}
              className="text-[#A5A19A] hover:text-[#D4AF72]"
            >
              {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-[#6EE7B7]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[#A5A19A] block text-[11px] uppercase tracking-wider">WhatsApp Desk</span>
            <span className="font-mono-tabular font-bold text-sm text-[#6EE7B7] block mt-1 break-all">
              {info.whatsappNumber}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#D4AF72]/15 flex items-center justify-between">
            <a
              href={info.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6EE7B7] font-medium hover:underline flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>Open Chat</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.whatsappHref, 'whatsapp')}
              className="text-[#A5A19A] hover:text-[#D4AF72]"
            >
              {copiedField === 'whatsapp' ? <Check className="w-3.5 h-3.5 text-[#6EE7B7]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[#A5A19A] block text-[11px] uppercase tracking-wider">Official Email</span>
            <span className="font-mono-tabular font-bold text-sm text-[#F5F1E8] block mt-1 break-all">
              {info.email}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#D4AF72]/15 flex items-center justify-between">
            <a href={info.emailHref} className="text-[#D4AF72] font-medium hover:underline flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <span>Compose (mailto:)</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.email, 'email')}
              className="text-[#A5A19A] hover:text-[#D4AF72]"
            >
              {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-[#6EE7B7]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <span className="text-[#A5A19A] block text-[11px] uppercase tracking-wider">Official Website</span>
            <span className="font-mono-tabular font-bold text-sm text-[#F5F1E8] block mt-1 break-all">
              {info.website}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#D4AF72]/15 flex items-center justify-between">
            <a
              href={info.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4AF72] font-medium hover:underline flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              <span>Visit Site</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.website, 'web')}
              className="text-[#A5A19A] hover:text-[#D4AF72]"
            >
              {copiedField === 'web' ? <Check className="w-3.5 h-3.5 text-[#6EE7B7]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Address & Configuration Form */}
      <form onSubmit={handleSave} className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-5 min-w-0">
        <h4 className="font-display text-lg sm:text-xl font-semibold text-[#F5F1E8]">
          Corporate Identity & Registered Office
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[#A5A19A] mb-1">Company Legal Trade Name</label>
            <input
              type="text"
              required
              value={info.name}
              onChange={(e) => setInfo({ ...info, name: e.target.value })}
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72] font-semibold"
            />
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Tagline / Business Category</label>
            <input
              type="text"
              value={info.brandTagline}
              onChange={(e) => setInfo({ ...info, brandTagline: e.target.value })}
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[#A5A19A] mb-1">Complete Formatted Office Address</label>
            <textarea
              rows={2}
              required
              value={info.address.formatted}
              onChange={(e) =>
                setInfo({
                  ...info,
                  formattedAddress: e.target.value,
                  address: { ...info.address, formatted: e.target.value },
                })
              }
              className="w-full p-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            />
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Floor &amp; Tower</label>
            <input
              type="text"
              value={info.address.street}
              onChange={(e) =>
                setInfo({
                  ...info,
                  address: { ...info.address, street: e.target.value },
                })
              }
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            />
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Building / Business Park</label>
            <input
              type="text"
              value={info.address.building}
              onChange={(e) =>
                setInfo({
                  ...info,
                  address: { ...info.address, building: e.target.value },
                })
              }
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            />
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Road &amp; Sector</label>
            <input
              type="text"
              value={info.address.area}
              onChange={(e) =>
                setInfo({
                  ...info,
                  address: { ...info.address, area: e.target.value },
                })
              }
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            />
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
            <div>
              <label className="block text-[#A5A19A] mb-1">City</label>
              <input
                type="text"
                value={info.address.city}
                onChange={(e) =>
                  setInfo({
                    ...info,
                    address: { ...info.address, city: e.target.value },
                  })
                }
                className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div>
              <label className="block text-[#A5A19A] mb-1">State / Emirate</label>
              <input
                type="text"
                value={info.address.state}
                onChange={(e) =>
                  setInfo({
                    ...info,
                    address: { ...info.address, state: e.target.value },
                  })
                }
                className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div>
              <label className="block text-[#A5A19A] mb-1">Postal Code</label>
              <input
                type="text"
                value={info.address.postalCode}
                onChange={(e) =>
                  setInfo({
                    ...info,
                    address: { ...info.address, postalCode: e.target.value },
                  })
                }
                className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Primary Phone / WhatsApp Number</label>
            <input
              type="text"
              required
              value={info.primaryPhone}
              onChange={(e) => {
                const nextPhone = e.target.value;
                const digits = nextPhone.replace(/[^0-9]/g, '');
                setInfo({
                  ...info,
                  primaryPhone: nextPhone,
                  phone: nextPhone,
                  primaryPhoneRaw: nextPhone.replace(/\s+/g, ''),
                  whatsappNumber: nextPhone,
                  whatsappHref: digits ? `https://wa.me/${digits}` : info.whatsappHref,
                  phoneHref: `tel:${nextPhone.replace(/\s+/g, '')}`,
                });
              }}
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72] font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Email Address</label>
            <input
              type="email"
              required
              value={info.email}
              onChange={(e) =>
                setInfo({
                  ...info,
                  email: e.target.value,
                  emailHref: `mailto:${e.target.value.trim()}`,
                })
              }
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72] font-mono-tabular"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[#A5A19A] mb-1">Google Maps Directions URL</label>
            <input
              type="url"
              required
              value={info.mapsDirectionsUrl}
              onChange={(e) => setInfo({ ...info, mapsDirectionsUrl: e.target.value })}
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72] font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Office Latitude</label>
            <input
              type="number"
              step="0.00001"
              value={info.officeCoordinates.lat}
              onChange={(e) =>
                setInfo({
                  ...info,
                  officeCoordinates: {
                    ...info.officeCoordinates,
                    lat: Number(e.target.value),
                  },
                })
              }
              className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72] font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-[#A5A19A] mb-1">Office Longitude</label>
            <div className="flex flex-col xs:flex-row gap-2">
              <input
                type="number"
                step="0.00001"
                value={info.officeCoordinates.lng}
                onChange={(e) =>
                  setInfo({
                    ...info,
                    officeCoordinates: {
                      ...info.officeCoordinates,
                      lng: Number(e.target.value),
                    },
                  })
                }
                className="flex-1 min-w-0 h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72] font-mono-tabular"
              />
              <button
                type="button"
                onClick={handleGeocodeOffice}
                disabled={geocodingOffice}
                className="h-9 px-3 bg-[#121212] border border-[#D4AF72]/35 text-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808] text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
              >
                {geocodingOffice ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5" />
                )}
                <span>Geocode Address</span>
              </button>
            </div>
          </div>
          {geocodeMsg && (
            <p className="md:col-span-2 text-xs text-[#6EE7B7] font-medium">{geocodeMsg}</p>
          )}
          {!isValidCoordinate(info.officeCoordinates) && (
            <p className="md:col-span-2 text-xs text-[#FCA5A5]">
              Warning: Enter valid latitude/longitude coordinates for the map pin.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4AF72]/15">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Company Information</span>
          </button>
        </div>
      </form>

      {/* Live Interactive Office Map Preview */}
      <div className="space-y-2">
        <h4 className="font-display text-lg font-semibold text-[#F5F1E8]">
          Live Google Maps Integration Preview
        </h4>
        <OfficeLocationMap apiKey={mapsApiKey} overrideCompanyInfo={info} />
      </div>
    </div>
  );
};
