export type Language = 'en' | 'ar';

export type AdvisorLanguagePreference = 'auto' | 'en' | 'hi' | 'hinglish';

export type AdvisorResolvedLanguage = 'en' | 'hi' | 'hinglish';

export type CurrencyCode = 'AED' | 'USD' | 'INR' | 'GBP' | 'EUR' | 'SAR';

export type EmiratesName =
  | 'Dubai'
  | 'Abu Dhabi'
  | 'Sharjah'
  | 'Ajman'
  | 'Ras Al Khaimah'
  | 'Fujairah'
  | 'Umm Al Quwain';

export type ProjectCategory =
  | 'Off-plan'
  | 'Ready-to-move'
  | 'Under-construction'
  | 'Upcoming launch';

export type PropertyTypeOption =
  | 'Studio'
  | '1 Bedroom'
  | '2 Bedrooms'
  | '3 Bedrooms'
  | '4+ Bedrooms'
  | 'Penthouse'
  | 'Villa'
  | 'Townhouse'
  | 'Duplex'
  | 'Mansion'
  | 'Commercial'
  | 'Office'
  | 'Retail'
  | 'Plot';

export type TenureType = 'Freehold' | 'Leasehold';
export type FurnishedType = 'Furnished' | 'Unfurnished' | 'Semi-Furnished';

export type UserRole =
  | 'customer'
  | 'sales_agent'
  | 'inventory_manager'
  | 'admin'
  | 'super_admin';

export type MediaCategory =
  | 'exterior'
  | 'interior_living'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'balcony_view'
  | 'amenities_pool'
  | 'lobby_entrance'
  | 'landscaping'
  | 'construction_progress'
  | 'surroundings';

export type MediaClassification =
  | 'actual_photograph'
  | 'developer_render'
  | 'illustrative_image'
  | 'construction_photo';

export type MediaSourcePriority = 1 | 2 | 3 | 4;

export interface ProjectMediaItem {
  id: string;
  projectId: string;
  developerId?: string;
  url: string;
  imageHash?: string;
  category: MediaCategory;
  classification: MediaClassification;
  caption: string;
  sourceName: string;
  sourcePriority: MediaSourcePriority;
  verifiedProjectSpecific: boolean;
  capturedAt?: string;
}

export type TourAvailabilityStatus =
  | '360_available'
  | '3d_available'
  | 'video_available'
  | 'coming_soon';

export type VideoCreatorType =
  | 'independent_agent'
  | 'independent_reviewer'
  | 'construction_monitor'
  | 'developer_official';

export type VideoCategory =
  | 'walkthrough'
  | 'apartment_tour'
  | 'construction_progress'
  | 'area_drone'
  | 'developer_showcase';

export type VideoPriorityLevel = 1 | 2 | 3 | 4;
// 1 = Independent Project Walkthrough, 2 = Independent Property Video, 3 = Verified Portal, 4 = Developer Official

export interface ProjectVideoItem {
  id: string;
  projectId: string;
  title: string;
  channelName: string;
  channelType: VideoCreatorType;
  priorityLevel: VideoPriorityLevel;
  priorityLabel: string;
  publishedAt: string;
  thumbnailUrl: string;
  embedUrl: string;
  sourceUrl: string;
  videoCategory: VideoCategory;
  duration?: string;
  viewCount?: string;
  verifiedProjectSpecific: boolean;
  notes?: string;
}

export interface VirtualTourHotspot {
  id: string;
  yawDeg: number;
  pitchDeg: number;
  label: string;
  detail?: string;
  targetRoomId?: string;
}

export interface NearbyLandmark {
  name: string;
  nameAr?: string;
  category: 'metro' | 'airport' | 'school' | 'hospital' | 'mall' | 'beach' | 'landmark';
  distanceKm: number;
  travelTimeMin: number;
}

export interface FloorPlanItem {
  id: string;
  name: string;
  bedrooms: string;
  bathrooms?: string;
  sizeSqFt: number;
  priceAed: number;
  availableCount: number | null;
  floorRange: string;
  exposure: string;
  planImageUrl?: string;
}

export interface FloorAvailabilityRow {
  floor: string;
  unitTypes: string;
  totalUnits: number;
  availableUnits: number | null;
  reservedUnits: number | null;
  soldUnits: number | null;
  minPriceAed: number;
}

export type TourVerificationStatus =
  | 'verified'
  | 'awaiting_verification'
  | 'broken'
  | 'unavailable';

export interface VirtualTourGalleryItem {
  id: string;
  title: string;
  titleAr?: string;
  provider: string;
  tourType: '360_panorama' | 'matterport_3d' | 'video_walkthrough' | 'webxr' | 'developer_official';
  embedUrl?: string;
  directUrl?: string;
  embedAvailable: boolean;
  verificationStatus: TourVerificationStatus;
  lastCheckedDate: string;
  sourceName?: string;
  unitType?: string;
  rooms?: VirtualTourRoom[];
  notes?: string;
}

export interface TourDiscoveryInfo {
  projectId: string;
  projectName: string;
  developerName: string;
  tourUrl: string;
  tourProvider: string;
  verificationStatus: TourVerificationStatus;
  lastCheckedDate: string;
  embedAvailable: boolean;
  errorStatus?: string;
  checkedAt?: string;
  matchConfidence?: number;
}

export interface VirtualTourRoom {
  id: string;
  projectId: string;
  floorLevel: string;
  viewCategory: 'interior' | 'exterior' | 'amenities' | 'villa_apartment';
  label: string;
  labelAr?: string;
  imageUrl: string;
  isTrue360Panorama: boolean;
  description: string;
  sourceName: string;
  yawOffset: number;
  floorPlanId?: string;
  hotspots?: VirtualTourHotspot[];
}

export interface VirtualTourConfig {
  projectId?: string;
  available: boolean;
  tourStatus: TourAvailabilityStatus;
  provider?: 'Matterport' | 'WhiteCollar360' | 'DeveloperOfficial' | 'WebXR' | string;
  embedUrl?: string;
  directUrl?: string;
  matterportUrl?: string;
  walkthroughVideoUrl?: string;
  webXrUrl?: string;
  tourType?: '360_panorama' | 'matterport_3d' | 'video_walkthrough' | 'webxr' | 'developer_official';
  sourceName?: string;
  rooms?: VirtualTourRoom[];
  tours?: VirtualTourGalleryItem[];
  discovery?: TourDiscoveryInfo;
  embedAvailable?: boolean;
  verificationStatus?: TourVerificationStatus;
  lastCheckedDate?: string;
  errorStatus?: string;
}

export interface HistoricalTransaction {
  quarter: string;
  avgPricePerSqFtAed: number;
  transactionVolume: number;
}

export interface InvestmentMetrics {
  grossYieldPct: number | null;
  netYieldPct: number | null;
  serviceChargePerSqFtAed: number | null;
  priceTrend5YrPct: number | null;
  estimatedAppreciationPct: number | null;
  historicalTransactions: HistoricalTransaction[];
  dataCitation: string;
}

export interface InventoryData {
  status: 'verified_live' | 'unavailable';
  totalRegisteredUnits: number | null;
  releasedUnits: number | null;
  availableUnits: number | null;
  soldUnits: number | null;
  reservedUnits: number | null;
  onHoldUnits: number | null;
  remainingUnits: number | null;
  availabilityPct: number | null;
  lastUpdatedAt: string;
  dataSource: string;
  sourceType: 'dld_registry' | 'developer_api' | 'broker_crm' | 'manual_admin' | 'unavailable';
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  developerId: string;
  developerName: string;
  emirate: EmiratesName;
  city: string;
  community: string;
  neighbourhood: string;
  buildingName: string;
  waterfront: boolean;
  brandedResidence: boolean;
  category: ProjectCategory;
  propertyTypes: PropertyTypeOption[];
  tenure: TenureType;
  furnished: FurnishedType;
  startingPriceAed: number;
  maxPriceAed: number;
  pricePerSqFtAed: number;
  minSizeSqFt: number;
  maxSizeSqFt: number;
  paymentPlan: string;
  downPaymentPct: number;
  handoverDate: string;
  handoverYear: number;
  launchDate: string;
  constructionPct: number;
  status: string;
  registrationNumber: string;
  verified: boolean;
  featured: boolean;
  coordinates: {
    lat: number;
    lng: number;
  };
  nearbyLandmarks: NearbyLandmark[];
  heroImage: string;
  heroImageHash?: string;
  heroClassification?: MediaClassification;
  heroSourceName?: string;
  galleryImages: string[];
  constructionImages: string[];
  mediaItems?: ProjectMediaItem[];
  projectUrl?: string;
  brochureUrl: string;
  masterPlanNotes: string;
  floorPlans: FloorPlanItem[];
  floorAvailability: FloorAvailabilityRow[];
  amenities: string[];
  virtualTour: VirtualTourConfig;
  investment: InvestmentMetrics;
  inventory: InventoryData;
  description: string;
  descriptionAr: string;
  bathrooms?: string;
  bookingAmountAed?: number;
  bookingAmountPct?: number;
  salesOfficeAddress?: string;
  salesOfficePhone?: string;
  salesOfficeWhatsapp?: string;
  salesOfficeEmail?: string;
  developerWebsite?: string;
  fullAddress?: string;
  googleMapsUrl?: string;
  lastVerifiedAt?: string;
  verificationSource?: string;
  walkthroughVideoUrl?: string;
  videoItems?: ProjectVideoItem[];
  primaryVideo?: ProjectVideoItem;
  sourceOrigin?: 'excel_import' | 'manual_admin' | 'catalog_seed';
  importBatchId?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface ExcelImportRowError {
  row: number;
  projectName?: string;
  reason: string;
}

export interface ExcelImportReport {
  batchId: string;
  fileName: string;
  importedAt: string;
  totalExcelRecords: number;
  successfullyImported: number;
  createdCount: number;
  updatedCount: number;
  failedImports: number;
  missingProjectUrls: number;
  duplicateRecordsInFile: number;
  projectsWithVerifiedPhotos: number;
  projectsWithAvailable360Tours: number;
  projectsWithVideoAlternatives?: number;
  projectsWithIndependentVideos?: number;
  projectsWithMediaNotAvailable?: number;
  errors: ExcelImportRowError[];
}

export interface ImageCollisionRecord {
  imageHash: string;
  imageUrl: string;
  projectIds: string[];
  projectNames: string[];
}

export interface CatalogMediaAuditReport {
  scannedAt: string;
  totalProjects: number;
  projectsWithVerifiedRealImages: number;
  projectsWithRendersOnly: number;
  projectsWithMissingImages: number;
  projectsWithDuplicateImages: number;
  duplicateCollisions: ImageCollisionRecord[];
  projectsWithGenuine360Tours: number;
  projectsWith3dOrVideoTours: number;
  projectsWithIndependentWalkthroughs?: number;
  projectsWithConstructionVideos?: number;
  projectsWithDeveloperVideos?: number;
  projectsWithMediaNotAvailable?: number;
  projectsWithMissingTours: number;
  projectsWithProjectUrls: number;
  projectsMissingProjectUrls: number;
}

export interface Developer {
  id: string;
  name: string;
  nameAr: string;
  emirate: EmiratesName | 'All UAE';
  registrationId: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  salesOfficeAddress?: string;
  salesOfficePhone?: string;
  salesOfficeWhatsapp?: string;
  salesOfficeEmail?: string;
  foundedYear: number;
  history: string;
  historyAr: string;
  completedProjects: number;
  activeProjects: number;
  verified: boolean;
  updatedAt?: string;
}

export interface InventoryLog {
  id: string;
  projectId: string;
  projectName: string;
  previousAvailable: number | null;
  newAvailable: number | null;
  previousSold: number | null;
  newSold: number | null;
  previousReserved: number | null;
  newReserved: number | null;
  source: string;
  syncType: 'webhook' | 'scheduled' | 'manual_refresh' | 'admin_edit' | 'csv_import';
  actorUid?: string;
  actorEmail?: string;
  notes?: string;
  timestamp: string;
}

export interface SyncProvider {
  id: string;
  name: string;
  providerType: 'dld_registry' | 'developer_api' | 'broker_crm' | 'uae_authority';
  endpointUrl: string;
  syncFrequencyMinutes: number;
  enabled: boolean;
  lastSyncAt: string;
  lastStatus: 'healthy' | 'warning' | 'error';
  lastError?: string;
  recordsSynced: number;
  updatedAt?: string;
}

export type EnquiryType =
  | 'callback'
  | 'whatsapp'
  | 'visit'
  | 'virtual_consultation'
  | 'investment'
  | 'brochure'
  | 'availability_alert';

export type EnquiryStatus = 'new' | 'contacted' | 'scheduled' | 'closed';

export interface Enquiry {
  id: string;
  userId?: string;
  projectId?: string;
  projectName?: string;
  enquiryType: EnquiryType;
  fullName: string;
  email: string;
  phone?: string;
  preferredDate?: string;
  budgetAed?: number;
  message?: string;
  status: EnquiryStatus;
  assignedAgentName?: string;
  assignedAgentUid?: string;
  staffNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  preferredCurrency?: CurrencyCode;
  preferredLanguage?: Language;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserFavorite {
  userId: string;
  projectId: string;
  projectName: string;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  userId: string;
  title: string;
  emirate?: string;
  maxBudgetAed?: number;
  propertyType?: string;
  category?: string;
  alertsEnabled: boolean;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  summary: string;
  timestamp: string;
}

export type SortOption =
  | 'featured'
  | 'lowest_price'
  | 'highest_price'
  | 'newest'
  | 'highest_availability'
  | 'nearest_handover'
  | 'best_investment';

export interface SearchFilters {
  query: string;
  emirate: string;
  community: string;
  category: string;
  propertyType: string;
  bedroomCount: string;
  minBathrooms: number | '';
  developerId: string;
  minBudgetAed: number | '';
  maxBudgetAed: number | '';
  minSizeSqFt: number | '';
  maxSizeSqFt: number | '';
  maxMonthlyPaymentAed: number | '';
  maxDownPaymentPct: number | '';
  minConstructionPct: number | '';
  handoverYear: string;
  tenure: string;
  furnished: string;
  paymentPlanFilter: string;
  minYieldPct: number | '';
  maxLandmarkDistanceKm: number | '';
  landmarkCategory: string;
  tourFilter: '' | 'any_media' | '3d_or_360' | 'video_only';
  investmentOnly: boolean;
  waterfrontOnly: boolean;
  verifiedAvailableOnly: boolean;
  sortBy: SortOption;
}
