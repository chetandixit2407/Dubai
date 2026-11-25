import React, { useState } from 'react';
import { AdvancedMarker, APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps';
import { Building2, ExternalLink, Mail, MapPin, Navigation, Phone, Send } from 'lucide-react';
import { getEffectiveCompanyInfo } from '../data/companyInfo.ts';

interface OfficeLocationMapProps {
  apiKey?: string;
  className?: string;
}

export const OfficeLocationMap: React.FC<OfficeLocationMapProps> = ({
  apiKey,
  className = '',
}) => {
  const company = getEffectiveCompanyInfo();
  const [quotaExceeded] = useState(false);

  return (
    <div className={`bg-[#121212] border border-[#D4AF72]/25 overflow-hidden ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Office Details & Action Strip */}
        <div className="lg:col-span-5 min-w-0 p-5 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72] mb-2">
              <Building2 className="w-4 h-4" />
              <span>Corporate Headquarters</span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-medium text-[#F5F1E8]">
              {company.name}
            </h3>
            <p className="text-xs text-[#A5A19A] mt-1 font-mono-tabular">
              Private Advisory &amp; International Client Desk
            </p>

            {/* Address */}
            <div className="mt-5 p-4 border border-[#D4AF72]/20 bg-[#1B1B1B] space-y-1">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#D4AF72] shrink-0 mt-0.5" />
                <div className="text-xs text-[#F5F1E8] leading-relaxed">
                  <p className="font-semibold">
                    {company.address.street}, {company.address.building}
                  </p>
                  <p className="text-[#A5A19A]">{company.address.area}</p>
                  <p className="text-[#A5A19A]">
                    {company.address.city}, {company.address.state} {company.address.postalCode},{' '}
                    {company.address.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Contact Links */}
            <div className="mt-5 space-y-2.5 text-xs">
              <a
                href={company.phoneHref}
                className="flex items-center gap-2.5 p-2.5 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] text-[#F5F1E8] font-medium transition-colors min-w-0"
              >
                <Phone className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                <span className="font-mono-tabular truncate">{company.primaryPhone}</span>
                <span className="ml-auto text-[11px] text-[#A5A19A] shrink-0 hidden xs:inline">
                  Direct Line
                </span>
              </a>

              <a
                href={company.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2.5 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#34D399] text-[#F5F1E8] font-medium transition-colors min-w-0"
              >
                <Send className="w-3.5 h-3.5 text-[#6EE7B7] shrink-0" />
                <span className="font-mono-tabular truncate">{company.whatsappNumber}</span>
                <span className="ml-auto text-[11px] text-[#6EE7B7] font-semibold shrink-0 hidden xs:inline">
                  WhatsApp Desk
                </span>
              </a>

              <a
                href={company.emailHref}
                className="flex items-center gap-2.5 p-2.5 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] text-[#F5F1E8] font-medium transition-colors min-w-0"
              >
                <Mail className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                <span className="font-mono-tabular truncate min-w-0 flex-1">{company.email}</span>
                <span className="ml-auto text-[11px] text-[#A5A19A] shrink-0 hidden sm:inline">
                  Official Email
                </span>
              </a>
            </div>
          </div>

          {/* Prominent Get Directions CTA */}
          <div>
            <a
              href={company.mapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 bg-[#D4AF72] text-[#080808] hover:bg-[#E6C77A] text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-colors text-center"
            >
              <Navigation className="w-4 h-4 shrink-0" />
              <span className="truncate">GET DIRECTIONS TO WHITE COLLAR REALTY</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 shrink-0" />
            </a>
            <p className="text-[11px] text-[#A5A19A] text-center mt-2">
              Opens Google Maps with turn-by-turn navigation to M3M Urbana Business Park
            </p>
          </div>
        </div>

        {/* Interactive Google Map */}
        <div className="lg:col-span-7 min-w-0 h-[280px] sm:h-[360px] lg:h-auto lg:min-h-[360px] relative border-t lg:border-t-0 lg:border-l border-[#D4AF72]/20 bg-[#080808]">
          {apiKey && !quotaExceeded ? (
            <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="IN">
              <GoogleMap
                defaultCenter={company.officeCoordinates}
                defaultZoom={15}
                mapId="DEMO_MAP_ID"
                colorScheme="DARK"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                <AdvancedMarker position={company.officeCoordinates} title={company.name}>
                  <div className="bg-[#080808] text-[#F5F1E8] text-xs font-semibold px-3 py-1.5 border border-[#D4AF72] shadow-md flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF72]" />
                    <span>{company.name} HQ</span>
                  </div>
                </AdvancedMarker>
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#121212]">
              <MapPin className="w-8 h-8 text-[#D4AF72] mb-2" />
              <p className="font-semibold text-sm text-[#F5F1E8]">{company.name}</p>
              <p className="text-xs text-[#A5A19A] mt-1 max-w-sm">{company.address.formatted}</p>
              <p className="text-xs font-mono-tabular text-[#D4AF72] mt-2">
                Coordinates: {company.officeCoordinates.lat.toFixed(4)}° N,{' '}
                {company.officeCoordinates.lng.toFixed(4)}° E
              </p>
              <a
                href={company.mapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] flex items-center gap-1.5"
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
