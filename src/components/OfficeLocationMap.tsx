import React, { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  CollisionBehavior,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Building2,
  Crosshair,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Send,
} from 'lucide-react';
import { CompanyInformation, getEffectiveCompanyInfo } from '../data/companyInfo.ts';
import { getGoogleMapsDirectionsUrl, isValidCoordinate } from '../utils/coordinates.ts';
import { GoogleMapsGuard, MapsErrorReason } from './GoogleMapsGuard.tsx';

interface OfficeLocationMapProps {
  apiKey?: string;
  mapsLoading?: boolean;
  className?: string;
  overrideCompanyInfo?: CompanyInformation;
  onRetryMapsConfig?: () => void;
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
      className="absolute bottom-7 left-2.5 z-10 h-8 sm:h-9 px-2.5 sm:px-3 bg-[#080808]/95 border border-[#D4AF72]/45 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 shadow-lg cursor-pointer"
    >
      <Crosshair className="w-3.5 h-3.5 text-[#D4AF72]" />
      <span>Recenter Office</span>
    </button>
  );
};

const OfficeMarkerWithPopup: React.FC<{
  company: CompanyInformation;
  position: { lat: number; lng: number };
  directionsUrl: string;
}> = ({ company, position, directionsUrl }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={company.name}
        collisionBehavior={CollisionBehavior.REQUIRED}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <div className="bg-[#080808] text-[#F5F1E8] text-xs font-semibold px-3 py-1.5 border border-[#D4AF72] shadow-md flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
          <span className="w-2 h-2 rounded-full bg-[#D4AF72]" />
          <span>{company.name} HQ</span>
        </div>
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-2.5 sm:p-3 bg-[#121212] text-[#F5F1E8] w-[min(250px,calc(100vw-64px))] space-y-1.5 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF72]">
              Corporate Headquarters
            </p>
            <p className="font-display text-sm font-medium text-[#F5F1E8]">{company.name}</p>
            <p className="text-[11px] text-[#A5A19A] leading-snug">{company.address.formatted}</p>
            <p className="font-mono-tabular text-[11px] text-[#D4AF72] ltr-isolate">
              {position.lat.toFixed(5)}° N, {position.lng.toFixed(5)}° E
            </p>
            <a
              href={directionsUrl}
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
  mapsLoading = false,
  className = '',
  overrideCompanyInfo,
  onRetryMapsConfig,
}) => {
  const [storedCompany, setStoredCompany] = useState<CompanyInformation>(() =>
    getEffectiveCompanyInfo()
  );
  const [mapErrorReason, setMapErrorReason] = useState<MapsErrorReason | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const syncHandler = () => setStoredCompany(getEffectiveCompanyInfo());
    window.addEventListener('wcr-company-info-updated', syncHandler);
    return () => window.removeEventListener('wcr-company-info-updated', syncHandler);
  }, []);

  const company = overrideCompanyInfo || storedCompany;
  const coords = company.officeCoordinates;
  const hasValidCoords = isValidCoordinate(coords);
  const exactDirectionsUrl = getGoogleMapsDirectionsUrl(
    hasValidCoords ? coords : null,
    company.mapsDirectionsUrl || company.googleMapsSearchUrl
  );

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
            <p className="text-xs text-[#A5A19A] mt-1">
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
                <span className="font-mono-tabular truncate ltr-isolate">{company.primaryPhone}</span>
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
                <span className="font-mono-tabular truncate ltr-isolate">{company.whatsappNumber}</span>
                <span className="ml-auto text-[11px] text-[#6EE7B7] font-semibold shrink-0 hidden xs:inline">
                  WhatsApp Desk
                </span>
              </a>

              <a
                href={company.emailHref}
                className="flex items-center gap-2.5 p-2.5 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] text-[#F5F1E8] font-medium transition-colors min-w-0"
              >
                <Mail className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                <span className="font-mono-tabular truncate min-w-0 flex-1 ltr-isolate">{company.email}</span>
                <span className="ml-auto text-[11px] text-[#A5A19A] shrink-0 hidden sm:inline">
                  Official Email
                </span>
              </a>
            </div>
          </div>

          {/* Prominent Get Directions CTA */}
          <div>
            <a
              href={exactDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-3 sm:px-4 bg-[#D4AF72] text-[#080808] hover:bg-[#E6C77A] text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-colors text-center"
            >
              <Navigation className="w-4 h-4 shrink-0" />
              <span className="leading-snug">GET DIRECTIONS TO WHITE COLLAR REALTY</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            <p className="text-[11px] text-[#A5A19A] text-center mt-2">
              Opens Google Maps with turn-by-turn navigation to {company.address.building}
            </p>
          </div>
        </div>

        {/* Interactive Google Map with explicit responsive height */}
        <div className="lg:col-span-7 min-w-0 h-[300px] sm:h-[360px] lg:h-[460px] relative border-t lg:border-t-0 lg:border-l border-[#D4AF72]/20 bg-[#080808]">
          {mapsLoading && !apiKey ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-xs text-[#A5A19A]">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4AF72]" />
              <span>Initializing office location map...</span>
            </div>
          ) : apiKey && !mapErrorReason && hasValidCoords ? (
            <APIProvider
              key={`office-map-${retryToken}`}
              apiKey={apiKey}
              libraries={['marker']}
              language="en"
              region="AE"
            >
              <GoogleMapsGuard
                loadingLabel="Loading office headquarters map tiles..."
                onStatusError={(reason) => setMapErrorReason(reason)}
              >
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
                    <OfficeMarkerWithPopup
                      company={company}
                      position={coords}
                      directionsUrl={exactDirectionsUrl}
                    />
                  </GoogleMap>
                </div>
              </GoogleMapsGuard>
            </APIProvider>
          ) : (
            <div className="w-full h-full relative bg-[#0B1217] overflow-hidden flex flex-col justify-between">
              {/* Architectural Dark-Gold Street Map Graphic of Sector 67 / Golf Course Ext Rd */}
              <svg
                viewBox="0 0 760 440"
                preserveAspectRatio="xMidYMid slice"
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                aria-hidden="true"
              >
                <defs>
                  <pattern id="officeGrid" width="38" height="38" patternUnits="userSpaceOnUse">
                    <path
                      d="M 38 0 L 0 0 0 38"
                      fill="none"
                      stroke="rgba(212, 175, 114, 0.08)"
                      strokeWidth="1"
                    />
                  </pattern>
                  <radialGradient id="officeGlow" cx="52%" cy="48%" r="42%">
                    <stop offset="0%" stopColor="rgba(212, 175, 114, 0.22)" />
                    <stop offset="100%" stopColor="rgba(11, 18, 23, 0)" />
                  </radialGradient>
                </defs>
                <rect width="760" height="440" fill="#0B1217" />
                <rect width="760" height="440" fill="url(#officeGrid)" />
                <rect width="760" height="440" fill="url(#officeGlow)" />

                {/* Sector Blocks */}
                <rect x="110" y="70" width="145" height="92" fill="#111A21" stroke="rgba(212,175,114,0.14)" />
                <rect x="285" y="70" width="185" height="92" fill="#111A21" stroke="rgba(212,175,114,0.14)" />
                <rect x="500" y="70" width="155" height="92" fill="#111A21" stroke="rgba(212,175,114,0.14)" />
                <rect x="285" y="196" width="185" height="106" fill="#13221D" stroke="rgba(212,175,114,0.38)" strokeWidth="1.5" />
                <rect x="110" y="196" width="145" height="106" fill="#111A21" stroke="rgba(212,175,114,0.14)" />
                <rect x="500" y="196" width="155" height="106" fill="#111A21" stroke="rgba(212,175,114,0.14)" />

                {/* Main Arterials */}
                <path d="M -20 180 L 780 174" stroke="#D4AF72" strokeOpacity="0.65" strokeWidth="6" fill="none" />
                <path d="M -20 180 L 780 174" stroke="#0B1217" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="8 6" fill="none" />
                <path d="M 268 -10 L 254 450" stroke="#D4AF72" strokeOpacity="0.45" strokeWidth="5" fill="none" />
                <path d="M 486 -10 L 498 450" stroke="#A5A19A" strokeOpacity="0.28" strokeWidth="3.5" fill="none" />
                <path d="M -20 322 L 780 318" stroke="#A5A19A" strokeOpacity="0.22" strokeWidth="3" fill="none" />

                {/* Roundabouts */}
                <circle cx="262" cy="177" r="10" fill="#0B1217" stroke="#D4AF72" strokeWidth="2.5" />
                <circle cx="491" cy="175" r="8" fill="#0B1217" stroke="#D4AF72" strokeOpacity="0.6" strokeWidth="2" />

                {/* Road & District Labels */}
                <text x="530" y="167" fill="#D4AF72" fontSize="10" fontWeight="600" letterSpacing="1.5">
                  GOLF COURSE EXT. ROAD
                </text>
                <text x="208" y="395" fill="#A5A19A" fontSize="9.5" letterSpacing="1.2" transform="rotate(-88 208 395)">
                  SOHNA ROAD CORRIDOR
                </text>
                <text x="518" y="254" fill="#7C8B94" fontSize="10" letterSpacing="1.2">
                  SECTOR 67 · GURUGRAM
                </text>

                {/* Office Pin */}
                <circle cx="378" cy="244" r="24" fill="#D4AF72" fillOpacity="0.16" />
                <circle cx="378" cy="244" r="11" fill="#080808" stroke="#D4AF72" strokeWidth="2.5" />
                <circle cx="378" cy="244" r="4.5" fill="#D4AF72" />
              </svg>

              {/* Top Overlay Header */}
              <div className="relative z-10 p-4 flex items-start justify-between gap-3">
                <div className="bg-[#080808]/92 border border-[#D4AF72]/35 px-3 py-2 max-w-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72] flex items-center gap-1.5">
                    {mapErrorReason ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FCD34D] shrink-0" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{company.address.building}</span>
                  </p>
                  <p className="text-xs font-medium text-[#F5F1E8] mt-0.5">{company.address.area}</p>
                  {mapErrorReason && (
                    <p className="text-[11px] text-[#FCA5A5] mt-1">
                      {mapErrorReason === 'quota_exceeded'
                        ? 'Google Maps preview quota reached. GPS directions remain active.'
                        : 'Unable to load interactive Google Maps tiles right now.'}
                    </p>
                  )}
                </div>

                {/* Compass Rose */}
                <div className="w-10 h-10 bg-[#080808]/92 border border-[#D4AF72]/35 flex flex-col items-center justify-center text-[9px] font-mono-tabular text-[#D4AF72] shrink-0">
                  <span>N</span>
                  <span className="w-px h-2.5 bg-[#D4AF72]" />
                </div>
              </div>

              {/* Bottom Coordinates & Action Strip */}
              <div className="relative z-10 p-4 bg-gradient-to-t from-[#080808] via-[#080808]/90 to-transparent flex flex-wrap items-center justify-between gap-2.5">
                {hasValidCoords ? (
                  <p className="text-xs font-mono-tabular text-[#D4AF72] ltr-isolate bg-[#080808]/95 border border-[#D4AF72]/30 px-2.5 py-1.5">
                    GPS: {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                  </p>
                ) : (
                  <p className="text-xs text-[#FCA5A5]">
                    Office GPS coordinates pending update in Company Settings.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {mapErrorReason && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapErrorReason(null);
                        setRetryToken((n) => n + 1);
                        onRetryMapsConfig?.();
                      }}
                      className="px-3 py-1.5 bg-[#121212] border border-[#D4AF72]/45 text-xs font-semibold text-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808] flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Live Map</span>
                    </button>
                  )}
                  <a
                    href={exactDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] flex items-center gap-1.5"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Open in Google Maps</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
