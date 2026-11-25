import React, { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  Crosshair,
  ExternalLink,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Send,
} from 'lucide-react';
import { CompanyInformation, getEffectiveCompanyInfo } from '../data/companyInfo.ts';
import { isValidCoordinate } from '../utils/coordinates.ts';
import { GoogleMapsGuard } from './GoogleMapsGuard.tsx';

interface OfficeLocationMapProps {
  apiKey?: string;
  className?: string;
  overrideCompanyInfo?: CompanyInformation;
}

const OfficeMapController: React.FC<{
  target: { lat: number; lng: number };
}> = ({ target }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(target);
  }, [map, target.lat, target.lng]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!map) return;
        map.panTo(target);
        map.setZoom(15);
      }}
      className="absolute bottom-3 left-3 z-10 h-9 px-3 bg-[#080808]/90 border border-[#D4AF72]/45 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 shadow-lg cursor-pointer"
    >
      <Crosshair className="w-3.5 h-3.5 text-[#D4AF72]" />
      <span>Recenter Office</span>
    </button>
  );
};

const OfficeMarkerWithPopup: React.FC<{
  company: CompanyInformation;
  position: { lat: number; lng: number };
}> = ({ company, position }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={company.name}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <div className="bg-[#080808] text-[#F5F1E8] text-xs font-semibold px-3 py-1.5 border border-[#D4AF72] shadow-md flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
          <span className="w-2 h-2 rounded-full bg-[#D4AF72]" />
          <span>{company.name} HQ</span>
        </div>
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-3 bg-[#121212] text-[#F5F1E8] max-w-[260px] space-y-1.5 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF72]">
              Corporate Headquarters
            </p>
            <p className="font-display text-sm font-medium text-[#F5F1E8]">{company.name}</p>
            <p className="text-[11px] text-[#A5A19A] leading-snug">{company.address.formatted}</p>
            <p className="font-mono-tabular text-[11px] text-[#D4AF72]">
              {position.lat.toFixed(5)}° N, {position.lng.toFixed(5)}° E
            </p>
            <a
              href={
                company.mapsDirectionsUrl ||
                `https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1.5 bg-[#D4AF72] text-[#080808] text-[11px] font-semibold hover:bg-[#E6C77A]"
            >
              <Navigation className="w-3 h-3" />
              <span>Directions</span>
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const OfficeLocationMap: React.FC<OfficeLocationMapProps> = ({
  apiKey,
  className = '',
  overrideCompanyInfo,
}) => {
  const [storedCompany, setStoredCompany] = useState<CompanyInformation>(() =>
    getEffectiveCompanyInfo()
  );
  const [mapUnavailable, setMapUnavailable] = useState(false);

  useEffect(() => {
    const syncHandler = () => setStoredCompany(getEffectiveCompanyInfo());
    window.addEventListener('wcr-company-info-updated', syncHandler);
    return () => window.removeEventListener('wcr-company-info-updated', syncHandler);
  }, []);

  const company = overrideCompanyInfo || storedCompany;
  const coords = company.officeCoordinates;
  const hasValidCoords = isValidCoordinate(coords);

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
              href={
                company.mapsDirectionsUrl ||
                (hasValidCoords
                  ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
                  : company.googleMapsSearchUrl)
              }
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 bg-[#D4AF72] text-[#080808] hover:bg-[#E6C77A] text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-colors text-center"
            >
              <Navigation className="w-4 h-4 shrink-0" />
              <span className="truncate">GET DIRECTIONS TO WHITE COLLAR REALTY</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 shrink-0" />
            </a>
            <p className="text-[11px] text-[#A5A19A] text-center mt-2">
              Opens Google Maps with turn-by-turn navigation to {company.address.building}
            </p>
          </div>
        </div>

        {/* Interactive Google Map with explicit responsive height */}
        <div className="lg:col-span-7 min-w-0 h-[300px] sm:h-[360px] lg:h-[460px] relative border-t lg:border-t-0 lg:border-l border-[#D4AF72]/20 bg-[#080808]">
          {apiKey && !mapUnavailable && hasValidCoords ? (
            <APIProvider apiKey={apiKey} libraries={['marker']} language="en">
              <GoogleMapsGuard onStatusError={() => setMapUnavailable(true)}>
                <div className="w-full h-full relative">
                  <GoogleMap
                    defaultCenter={coords}
                    defaultZoom={15}
                    mapId="DEMO_MAP_ID"
                    colorScheme="DARK"
                    zoomControl={true}
                    mapTypeControl={true}
                    streetViewControl={true}
                    fullscreenControl={true}
                    gestureHandling="cooperative"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <OfficeMapController target={coords} />
                    <OfficeMarkerWithPopup company={company} position={coords} />
                  </GoogleMap>
                </div>
              </GoogleMapsGuard>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#121212]">
              <MapPin className="w-8 h-8 text-[#D4AF72] mb-2" />
              <p className="font-semibold text-sm text-[#F5F1E8]">{company.name}</p>
              <p className="text-xs text-[#A5A19A] mt-1 max-w-sm">{company.address.formatted}</p>
              {hasValidCoords ? (
                <p className="text-xs font-mono-tabular text-[#D4AF72] mt-2">
                  Coordinates: {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                </p>
              ) : (
                <p className="text-xs text-[#FCA5A5] mt-2">
                  Office GPS coordinates pending update in Company Settings.
                </p>
              )}
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
