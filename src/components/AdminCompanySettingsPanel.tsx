import React, { useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe,
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
import { OfficeLocationMap } from './OfficeLocationMap.tsx';

interface AdminCompanySettingsPanelProps {
  mapsApiKey?: string;
}

export const AdminCompanySettingsPanel: React.FC<AdminCompanySettingsPanelProps> = ({ mapsApiKey }) => {
  const [info, setInfo] = useState<CompanyInformation>(() => getEffectiveCompanyInfo());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
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
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111827] text-white p-6 border border-[#E5E2DC]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#E6C77A]">
              <ShieldCheck className="w-4 h-4" />
              <span>Official Corporate Registry & Contact Configuration</span>
            </div>
            <h3 className="font-display text-2xl font-semibold mt-1">
              White Collar Realty Institutional Master Profile
            </h3>
            <p className="text-xs text-white/70 mt-1 max-w-2xl leading-relaxed">
              Global source of truth for headquarters address, verified phone/WhatsApp numbers, institutional email, website URLs, and Google Maps integration across all public headers, footers, dossiers, and enquiry channels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 border border-white/20 text-white text-xs hover:border-[#E6C77A] flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Verified Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-4 text-xs text-[#047857] flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4" />
            <span>Company details successfully updated across all website components.</span>
          </div>
        </div>
      )}

      {/* Quick Verified Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white border border-[#E5E2DC] p-4 flex flex-col justify-between">
          <div>
            <span className="text-[#6B7280] block text-[11px] uppercase tracking-wider">Primary Phone</span>
            <span className="font-mono-tabular font-bold text-sm text-[#111827] block mt-1">
              {info.primaryPhone}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#E5E2DC] flex items-center justify-between">
            <a href={info.phoneHref} className="text-[#047857] font-medium hover:underline flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>Test Call (tel:)</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.primaryPhone, 'phone')}
              className="text-[#6B7280] hover:text-[#111827]"
            >
              {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-[#047857]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#E5E2DC] p-4 flex flex-col justify-between">
          <div>
            <span className="text-[#6B7280] block text-[11px] uppercase tracking-wider">WhatsApp Desk</span>
            <span className="font-mono-tabular font-bold text-sm text-[#047857] block mt-1">
              {info.whatsappNumber}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#E5E2DC] flex items-center justify-between">
            <a
              href={info.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#047857] font-medium hover:underline flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>Open Chat</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.whatsappHref, 'whatsapp')}
              className="text-[#6B7280] hover:text-[#111827]"
            >
              {copiedField === 'whatsapp' ? <Check className="w-3.5 h-3.5 text-[#047857]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#E5E2DC] p-4 flex flex-col justify-between">
          <div>
            <span className="text-[#6B7280] block text-[11px] uppercase tracking-wider">Official Email</span>
            <span className="font-mono-tabular font-bold text-sm text-[#111827] block mt-1 truncate">
              {info.email}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#E5E2DC] flex items-center justify-between">
            <a href={info.emailHref} className="text-[#9A7B3C] font-medium hover:underline flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <span>Compose (mailto:)</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.email, 'email')}
              className="text-[#6B7280] hover:text-[#111827]"
            >
              {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-[#047857]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#E5E2DC] p-4 flex flex-col justify-between">
          <div>
            <span className="text-[#6B7280] block text-[11px] uppercase tracking-wider">Official Website</span>
            <span className="font-mono-tabular font-bold text-sm text-[#111827] block mt-1 truncate">
              {info.website}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#E5E2DC] flex items-center justify-between">
            <a
              href={info.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9A7B3C] font-medium hover:underline flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              <span>Visit Site</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(info.website, 'web')}
              className="text-[#6B7280] hover:text-[#111827]"
            >
              {copiedField === 'web' ? <Check className="w-3.5 h-3.5 text-[#047857]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Address & Configuration Form */}
      <form onSubmit={handleSave} className="bg-white border border-[#E5E2DC] p-6 space-y-5">
        <h4 className="font-display text-xl font-semibold text-[#111827]">
          Corporate Identity & Registered Office
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[#6B7280] mb-1">Company Legal Trade Name</label>
            <input
              type="text"
              required
              value={info.name}
              onChange={(e) => setInfo({ ...info, name: e.target.value })}
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C] font-semibold"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] mb-1">Tagline / Business Category</label>
            <input
              type="text"
              value={info.brandTagline}
              onChange={(e) => setInfo({ ...info, brandTagline: e.target.value })}
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[#6B7280] mb-1">Complete Formatted Office Address</label>
            <textarea
              rows={2}
              required
              value={info.address.formatted}
              onChange={(e) =>
                setInfo({
                  ...info,
                  address: { ...info.address, formatted: e.target.value },
                })
              }
              className="w-full p-2.5 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C] font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] mb-1">Floor & Tower</label>
            <input
              type="text"
              value={info.address.street}
              onChange={(e) =>
                setInfo({
                  ...info,
                  address: { ...info.address, street: e.target.value },
                })
              }
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C]"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] mb-1">Building / Business Park</label>
            <input
              type="text"
              value={info.address.building}
              onChange={(e) =>
                setInfo({
                  ...info,
                  address: { ...info.address, building: e.target.value },
                })
              }
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C]"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] mb-1">Road & Sector</label>
            <input
              type="text"
              value={info.address.area}
              onChange={(e) =>
                setInfo({
                  ...info,
                  address: { ...info.address, area: e.target.value },
                })
              }
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C]"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] mb-1">City, State & Postal Code</label>
            <input
              type="text"
              value={`${info.address.city}, ${info.address.state} ${info.address.postalCode}`}
              onChange={(e) => {
                const parts = e.target.value.split(',');
                setInfo({
                  ...info,
                  address: {
                    ...info.address,
                    city: parts[0]?.trim() || info.address.city,
                  },
                });
              }}
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C]"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] mb-1">Primary Phone / WhatsApp String</label>
            <input
              type="text"
              required
              value={info.primaryPhone}
              onChange={(e) =>
                setInfo({
                  ...info,
                  primaryPhone: e.target.value,
                  whatsappNumber: e.target.value,
                  phoneHref: `tel:${e.target.value.replace(/\s+/g, '')}`,
                })
              }
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C] font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] mb-1">Email Address</label>
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
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C] font-mono-tabular"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[#6B7280] mb-1">Google Maps Directions URL</label>
            <input
              type="url"
              required
              value={info.mapsDirectionsUrl}
              onChange={(e) => setInfo({ ...info, mapsDirectionsUrl: e.target.value })}
              className="w-full h-9 px-3 border border-[#E5E2DC] focus:outline-none focus:border-[#9A7B3C] font-mono-tabular"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E2DC]">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#111827] text-white text-xs font-semibold hover:bg-[#9A7B3C] flex items-center gap-2 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Company Information</span>
          </button>
        </div>
      </form>

      {/* Live Interactive Office Map Preview */}
      <div className="space-y-2">
        <h4 className="font-display text-lg font-semibold text-[#111827]">
          Live Google Maps Integration Preview
        </h4>
        <OfficeLocationMap apiKey={mapsApiKey} />
      </div>
    </div>
  );
};
