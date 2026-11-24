import React, { useState } from 'react';
import { AdvancedMarker, APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps';
import { Building2, ExternalLink, Mail, MapPin, Navigation, Phone, Send } from 'lucide-react';
import { COMPANY_INFO, getEffectiveCompanyInfo } from '../data/companyInfo.ts';

interface OfficeLocationMapProps {
  apiKey?: string;
  className?: string;
}

export const OfficeLocationMap: React.FC<OfficeLocationMapProps> = ({ apiKey, className = '' }) => {
  const company = getEffectiveCompanyInfo();
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  return (
    <div className={`bg-white border border-[#E5E2DC] overflow-hidden ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Office Details & Action Strip */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9A7B3C] mb-2">
              <Building2 className="w-4 h-4" />
              <span>Corporate Headquarters</span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[#111827]">
              {company.name}
            </h3>
            <p className="text-xs text-[#6B7280] mt-1 font-mono-tabular">
              Institutional Advisory & International Client Desk
            </p>

            {/* Address */}
            <div className="mt-5 p-4 border border-[#E5E2DC] bg-[#FAF9F6] space-y-1">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#9A7B3C] shrink-0 mt-0.5" />
                <div className="text-xs text-[#111827] leading-relaxed">
                  <p className="font-semibold">{company.address.street}, {company.address.building}</p>
                  <p>{company.address.area}</p>
                  <p>{company.address.city}, {company.address.state} {company.address.postalCode}, {company.address.country}</p>
                </div>
              </div>
            </div>

            {/* Direct Contact Links */}
            <div className="mt-5 space-y-2.5 text-xs">
              <a
                href={company.phoneHref}
                className="flex items-center gap-2.5 p-2.5 border border-[#E5E2DC] hover:border-[#9A7B3C] hover:bg-[#FAF9F6] text-[#111827] font-medium transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#047857]" />
                <span className="font-mono-tabular">{company.primaryPhone}</span>
                <span className="ml-auto text-[11px] text-[#6B7280]">Direct Line</span>
              </a>

              <a
                href={company.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2.5 border border-[#E5E2DC] hover:border-[#047857] hover:bg-[#FAF9F6] text-[#111827] font-medium transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-[#047857]" />
                <span className="font-mono-tabular">{company.whatsappNumber}</span>
                <span className="ml-auto text-[11px] text-[#047857] font-semibold">WhatsApp Desk</span>
              </a>

              <a
                href={company.emailHref}
                className="flex items-center gap-2.5 p-2.5 border border-[#E5E2DC] hover:border-[#9A7B3C] hover:bg-[#FAF9F6] text-[#111827] font-medium transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#9A7B3C]" />
                <span className="font-mono-tabular">{company.email}</span>
                <span className="ml-auto text-[11px] text-[#6B7280]">Official Email</span>
              </a>
            </div>
          </div>

          {/* Prominent Get Directions CTA */}
          <div>
            <a
              href={company.mapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 bg-[#111827] text-white hover:bg-[#9A7B3C] text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-colors"
            >
              <Navigation className="w-4 h-4 text-[#E6C77A]" />
              <span>GET DIRECTIONS TO WHITE COLLAR REALTY</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 text-white/70" />
            </a>
            <p className="text-[11px] text-[#6B7280] text-center mt-2">
              Opens Google Maps with turn-by-turn navigation to M3M Urbana Business Park
            </p>
          </div>
        </div>

        {/* Interactive Google Map */}
        <div className="lg:col-span-7 h-[360px] lg:h-auto min-h-[360px] relative border-t lg:border-t-0 lg:border-l border-[#E5E2DC] bg-[#EFECE6]">
          {apiKey && !quotaExceeded ? (
            <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="IN">
              <GoogleMap
                defaultCenter={company.officeCoordinates}
                defaultZoom={15}
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                <AdvancedMarker position={company.officeCoordinates} title={company.name}>
                  <div className="bg-[#111827] text-white text-xs font-semibold px-3 py-1.5 border border-[#E6C77A] shadow-md flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-[#E6C77A] animate-pulse" />
                    <span>{company.name} HQ</span>
                  </div>
                </AdvancedMarker>
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#FAF9F6]">
              <MapPin className="w-8 h-8 text-[#9A7B3C] mb-2" />
              <p className="font-semibold text-sm text-[#111827]">{company.name}</p>
              <p className="text-xs text-[#6B7280] mt-1 max-w-sm">
                {company.address.formatted}
              </p>
              <p className="text-xs font-mono-tabular text-[#9A7B3C] mt-2">
                Coordinates: {company.officeCoordinates.lat.toFixed(4)}° N, {company.officeCoordinates.lng.toFixed(4)}° E
              </p>
              <a
                href={company.mapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 px-4 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] flex items-center gap-1.5"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
