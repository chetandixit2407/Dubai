import { AdvisorResolvedLanguage, Language } from '../types/realEstate.ts';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    brand: 'WHITE COLLAR REALTY',
    navProjects: 'Projects',
    navMap: 'UAE Map',
    navDevelopers: 'Developers',
    navCalculator: 'Calculator',
    navInsights: 'Insights',
    navPortal: 'Client Portal',
    navAdmin: 'Admin Console',
    primaryCta: 'Private Advisory',
    heroKicker: 'Private UAE Real Estate Advisory · White Collar Realty',
    heroTitle: 'Discover Extraordinary Living.',
    heroSubtitle:
      'Acquire waterfront penthouses, signature residences, and institutional-grade developments across the UAE with verified developer dossiers, RERA/DLD registry context, interactive mapping, and multi-currency AED/INR analytics.',
    exploreProjects: 'Explore Collection',
    openMap: 'Open UAE Property Map',
    searchTitle: 'Bespoke UAE Property Search Engine',
    searchPlaceholder: 'Search project, community, or developer...',
    allEmirates: 'All 7 Emirates',
    allCategories: 'All Categories',
    allTypes: 'All Property Types',
    allDevelopers: 'All Verified Developers',
    minBudget: 'Min Budget (AED)',
    maxBudget: 'Max Budget (AED)',
    sortLabel: 'Sort By',
    saveSearch: 'Save Search & Alerts',
    resetFilters: 'Reset Filters',
    featuredHeading: 'Featured UAE Developments',
    exclusiveLuxuryHeading: 'Exclusive Ultra-Luxury Residences',
    newlyLaunchedHeading: 'Newly Launched & Upcoming Releases',
    trendingInvestmentHeading: 'Trending Investment Opportunities',
    readyToMoveHeading: 'Ready-to-Move Residences',
    offPlanHeading: 'Off-Plan Investment Opportunities',
    verifiedInventoryHeading: 'Projects with Verified Live Inventory',
    recentlyAddedHeading: 'Recently Added to Registry',
    recentlyViewedHeading: 'Recently Viewed Residences',
    byEmirateHeading: 'Explore Across All Seven Emirates',
    byDeveloperHeading: 'Verified UAE Developers',
    mapSectionHeading: 'Interactive UAE Property Map',
    virtualTourHeading: '360° & 3D Virtual Tour Showcase',
    calculatorHeading: 'Institutional Investment & Yield Calculator',
    insightsHeading: 'UAE Market Insights & Transaction Benchmarks',
    aboutHeading: 'About White Collar Realty',
    contactHeading: 'Direct Advisory & WhatsApp Desk',
    totalUnits: 'Total Registered Units',
    releasedUnits: 'Released for Sale',
    availableUnits: 'Available',
    reservedUnits: 'Reserved',
    soldUnits: 'Sold',
    onHoldUnits: 'On Hold',
    remainingUnits: 'Remaining',
    availabilityPct: 'Availability',
    inventoryUnavailable: 'Contact Developer for Latest Availability',
    virtualTourUnavailable: '360° Tour Not Available',
    viewDetails: 'View Project Dossier',
    compareBtn: 'Compare',
    comparingBtn: 'In Compare',
    saveBtn: 'Save',
    savedBtn: 'Saved',
    signInGoogle: 'Sign In with Google',
    signOut: 'Sign Out',
  },
  ar: {
    brand: 'وايت كولار ريالتي',
    navProjects: 'المشاريع',
    navMap: 'خريطة الإمارات',
    navDevelopers: 'المطورون',
    navCalculator: 'حاسبة الاستثمار',
    navInsights: 'رؤى السوق',
    navPortal: 'بوابة العملاء',
    navAdmin: 'لوحة الإدارة',
    primaryCta: 'استشارة خاصة',
    heroKicker: 'استشارات العقارات الفاخرة وسجل المخزون المباشر في الإمارات',
    heroTitle: 'اكتشف أسلوب حياة استثنائياً.',
    heroSubtitle:
      'امتلك أفخم المساكن والفلل البحرية والمشاريع الاستثمارية في دبي والإمارات السبع مع بيانات المخزون المباشر، سجل المطورين المعتمد، الخرائط التفاعلية، وتحليلات العائد.',
    exploreProjects: 'استكشف المجموعة المختارة',
    openMap: 'فتح خريطة العقارات',
    searchTitle: 'محرك البحث العقاري المتقدم في الإمارات',
    searchPlaceholder: 'ابحث عن مشروع أو منطقة أو مطور أو رقم التسجيل...',
    allEmirates: 'جميع الإمارات السبع',
    allCategories: 'جميع الفئات',
    allTypes: 'جميع أنواع العقارات',
    allDevelopers: 'جميع المطورين المعتمدين',
    minBudget: 'الحد الأدنى (درهم)',
    maxBudget: 'الحد الأقصى (درهم)',
    sortLabel: 'ترتيب حسب',
    saveSearch: 'حفظ البحث والتنبيهات',
    resetFilters: 'إعادة ضبط',
    featuredHeading: 'أبرز المشاريع العقارية في الإمارات',
    exclusiveLuxuryHeading: 'مساكن الفخامة الحصرية',
    newlyLaunchedHeading: 'أحدث الإطلاقات والمشاريع القادمة',
    trendingInvestmentHeading: 'أبرز الفرص الاستثمارية الرائجة',
    readyToMoveHeading: 'عقارات جاهزة للسكن',
    offPlanHeading: 'فرص استثمارية على الخارطة',
    verifiedInventoryHeading: 'مشاريع بمخزون وحدات مباشر موثق',
    recentlyAddedHeading: 'أُضيف حديثاً إلى السجل',
    recentlyViewedHeading: 'العقارات التي شاهدتها مؤخراً',
    byEmirateHeading: 'استكشف عبر الإمارات السبع',
    byDeveloperHeading: 'المطورون العقاريون المعتمدون',
    mapSectionHeading: 'خريطة العقارات التفاعلية في الإمارات',
    virtualTourHeading: 'جولات افتراضية ثلاثية الأبعاد و360 درجة',
    calculatorHeading: 'حاسبة العائد والاستثمار العقاري',
    insightsHeading: 'تحليلات السوق ومؤشرات الصفقات في الإمارات',
    aboutHeading: 'عن وايت كولار ريالتي',
    contactHeading: 'مكتب الاستشارات المباشرة والواتساب',
    totalUnits: 'إجمالي الوحدات المسجلة',
    releasedUnits: 'المطروح للبيع',
    availableUnits: 'متاح',
    reservedUnits: 'محجوز',
    soldUnits: 'مباع',
    onHoldUnits: 'معلق',
    remainingUnits: 'المتبقي',
    availabilityPct: 'نسبة التوفر',
    inventoryUnavailable: 'تواصل مع المطور للحصول على أحدث التوافر',
    virtualTourUnavailable: 'جولة 360° غير متوفرة',
    viewDetails: 'عرض ملف المشروع',
    compareBtn: 'مقارنة',
    comparingBtn: 'في المقارنة',
    saveBtn: 'حفظ',
    savedBtn: 'محفوظ',
    signInGoogle: 'تسجيل الدخول عبر جوجل',
    signOut: 'تسجيل الخروج',
  },
};

export interface AdvisorChatUiStrings {
  advisorTitle: string;
  launcherSubtitle: string;
  headerSubtitle: string;
  autoLabel: string;
  languageAriaLabel: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  popularQueriesLabel: string;
  criteriaBtn: string;
  clearBtn: string;
  hideCriteriaTitle: string;
  showCriteriaTitle: string;
  currencyLabel: string;
  minBudgetLabel: string;
  maxBudgetLabel: string;
  optionalPlaceholder: string;
  allLocationsLabel: string;
  anyPropertyTypeLabel: string;
  anyPurposeLabel: string;
  purposeLabels: {
    Investment: string;
    'Personal living': string;
    'Rental income': string;
    'Capital appreciation': string;
  };
  findMatchesBtn: string;
  searchingIndicator: string;
  noExactMatchesBanner: string;
  bestMatchBadge: string;
  alternativeBadge: string;
  startingPriceLabel: string;
  estLabel: string;
  propertyTypeCardLabel: string;
  bedroomsCardLabel: string;
  paymentPlanCardLabel: string;
  handoverCardLabel: string;
  estYieldLabel: string;
  notAvailableLabel: string;
  viewDetailsBtn: string;
  contactEnquireBtn: string;
  inputPlaceholder: string;
  askBtn: string;
  validationSelectCriteria: string;
  validationMinPositive: string;
  validationMaxPositive: string;
  validationMinExceedsMax: string;
  genericNetworkError: string;
}

export const ADVISOR_CHAT_TRANSLATIONS: Record<
  AdvisorResolvedLanguage,
  AdvisorChatUiStrings
> = {
  en: {
    advisorTitle: 'Dubai Property Advisor',
    launcherSubtitle: 'AI Investment Consultant',
    headerSubtitle: 'Verified UAE Catalog · Multi-Currency AI Consultant',
    autoLabel: 'Auto',
    languageAriaLabel: 'Advisor language',
    welcomeMessage:
      "Hello! I'm your Dubai Property Advisor. Tell me your investment budget and preferred location, and I'll help you discover suitable property projects.",
    suggestedQuestions: [
      'I have ₹1 crore. Suggest Dubai properties.',
      'Show me projects under AED 800,000 in JVC.',
      'I want a 2-bedroom apartment in Business Bay.',
      'Which projects are suitable for rental investment?',
      'Can I invest with a budget of AED 500K?',
    ],
    popularQueriesLabel: 'Popular Advisor Queries',
    criteriaBtn: 'Criteria',
    clearBtn: 'Clear',
    hideCriteriaTitle: 'Hide Search Preferences',
    showCriteriaTitle: 'Show Search Preferences',
    currencyLabel: 'Currency',
    minBudgetLabel: 'Min Budget',
    maxBudgetLabel: 'Max Budget',
    optionalPlaceholder: 'Optional',
    allLocationsLabel: 'All Dubai Locations',
    anyPropertyTypeLabel: 'Any Property Type',
    anyPurposeLabel: 'Any Purpose',
    purposeLabels: {
      Investment: 'Investment',
      'Personal living': 'Personal living',
      'Rental income': 'Rental income',
      'Capital appreciation': 'Capital appreciation',
    },
    findMatchesBtn: 'Find Matches',
    searchingIndicator: 'Searching verified Dubai projects',
    noExactMatchesBanner:
      'No exact matches found — showing verified nearby or flexible-budget alternatives:',
    bestMatchBadge: 'Best Match',
    alternativeBadge: 'Alternative',
    startingPriceLabel: 'Starting Price (AED)',
    estLabel: 'Est.',
    propertyTypeCardLabel: 'Property Type',
    bedroomsCardLabel: 'Bedrooms',
    paymentPlanCardLabel: 'Payment Plan',
    handoverCardLabel: 'Handover',
    estYieldLabel: 'Est. Yield:',
    notAvailableLabel: 'Not available',
    viewDetailsBtn: 'View Details',
    contactEnquireBtn: 'Contact / Enquire',
    inputPlaceholder: "Ask e.g. '₹1 crore budget in JVC' or '2BR Business Bay'...",
    askBtn: 'Ask',
    validationSelectCriteria:
      'Select a budget, Dubai location, property type, or purpose first.',
    validationMinPositive: 'Minimum budget must be a valid positive number.',
    validationMaxPositive: 'Maximum budget must be a valid positive number.',
    validationMinExceedsMax: 'Minimum budget cannot exceed maximum budget.',
    genericNetworkError: 'Unable to reach Dubai Property Advisor right now.',
  },
  hi: {
    advisorTitle: 'दुबई प्रॉपर्टी एडवाइज़र',
    launcherSubtitle: 'AI रियल एस्टेट सलाहकार',
    headerSubtitle: 'सत्यापित यूएई कैटलॉग · मल्टी-करेंसी AI सलाहकार',
    autoLabel: 'ऑटो',
    languageAriaLabel: 'एडवाइज़र भाषा',
    welcomeMessage:
      'नमस्ते! मैं आपका दुबई प्रॉपर्टी एडवाइज़र हूँ। मुझे अपना निवेश बजट और पसंदीदा लोकेशन बताएं, और मैं आपके लिए उपयुक्त प्रोजेक्ट्स ढूंढने में मदद करूँगा।',
    suggestedQuestions: [
      'मेरा बजट 1 करोड़ रुपये है। दुबई में प्रॉपर्टी सुझाएं।',
      'मुझे जेवीसी में 8 लाख दिरहम से कम के प्रोजेक्ट दिखाएं।',
      'मुझे बिजनेस बे में 2 बेडरूम अपार्टमेंट चाहिए।',
      'किराये की आय के लिए कौन से प्रोजेक्ट सबसे अच्छे हैं?',
      'क्या मैं 5 लाख दिरहम के बजट में निवेश कर सकता हूँ?',
    ],
    popularQueriesLabel: 'लोकप्रिय प्रश्न',
    criteriaBtn: 'फ़िल्टर',
    clearBtn: 'रीसेट',
    hideCriteriaTitle: 'फ़िल्टर छुपाएं',
    showCriteriaTitle: 'फ़िल्टर दिखाएं',
    currencyLabel: 'मुद्रा',
    minBudgetLabel: 'न्यूनतम बजट',
    maxBudgetLabel: 'अधिकतम बजट',
    optionalPlaceholder: 'वैकल्पिक',
    allLocationsLabel: 'पूरा दुबई',
    anyPropertyTypeLabel: 'कोई भी प्रॉपर्टी प्रकार',
    anyPurposeLabel: 'कोई भी उद्देश्य',
    purposeLabels: {
      Investment: 'निवेश',
      'Personal living': 'स्वयं रहने के लिए',
      'Rental income': 'किराये की आय',
      'Capital appreciation': 'पूंजी वृद्धि',
    },
    findMatchesBtn: 'प्रोजेक्ट खोजें',
    searchingIndicator: 'सत्यापित दुबई प्रोजेक्ट्स खोजे जा रहे हैं',
    noExactMatchesBanner:
      'सटीक मेल नहीं मिला — नज़दीकी क्षेत्र या लचीले बजट वाले सत्यापित विकल्प दिखाए जा रहे हैं:',
    bestMatchBadge: 'श्रेष्ठ मिलान',
    alternativeBadge: 'विकल्प',
    startingPriceLabel: 'प्रारंभिक कीमत (AED)',
    estLabel: 'अनुमानित',
    propertyTypeCardLabel: 'प्रॉपर्टी प्रकार',
    bedroomsCardLabel: 'बेडरूम',
    paymentPlanCardLabel: 'पेमेंट प्लान',
    handoverCardLabel: 'हैंडओवर',
    estYieldLabel: 'अनुमानित यील्ड:',
    notAvailableLabel: 'उपलब्ध नहीं',
    viewDetailsBtn: 'विवरण देखें',
    contactEnquireBtn: 'संपर्क / पूछताछ',
    inputPlaceholder: "पूछें जैसे '1 करोड़ में जेवीसी फ्लैट' या 'दुबई हिल्स विला'...",
    askBtn: 'पूछें',
    validationSelectCriteria:
      'कृपया पहले बजट, दुबई लोकेशन, प्रॉपर्टी प्रकार या उद्देश्य चुनें।',
    validationMinPositive: 'न्यूनतम बजट एक मान्य सकारात्मक संख्या होनी चाहिए।',
    validationMaxPositive: 'अधिकतम बजट एक मान्य सकारात्मक संख्या होनी चाहिए।',
    validationMinExceedsMax: 'न्यूनतम बजट अधिकतम बजट से अधिक नहीं हो सकता।',
    genericNetworkError: 'अभी दुबई प्रॉपर्टी एडवाइज़र से संपर्क नहीं हो पा रहा है।',
  },
  hinglish: {
    advisorTitle: 'Dubai Property Advisor',
    launcherSubtitle: 'AI Investment Consultant',
    headerSubtitle: 'Verified UAE Catalog · Hinglish & Multi-Currency Advisor',
    autoLabel: 'Auto',
    languageAriaLabel: 'Advisor language',
    welcomeMessage:
      'Namaste! Main aapka Dubai Property Advisor hoon. Apna budget aur pasandida Dubai location batayein, main aapke liye best verified projects suggest karunga.',
    suggestedQuestions: [
      'Mujhe 1 crore ke andar Dubai property chahiye.',
      'JVC mein AED 800,000 se kam ke projects dikhao.',
      'Business Bay mein 2BR apartment chahiye.',
      'Rental income ke liye kaunsa project best rahega?',
      'Kya AED 500K budget mein investment ho sakta hai?',
    ],
    popularQueriesLabel: 'Popular Advisor Queries',
    criteriaBtn: 'Filters',
    clearBtn: 'Clear',
    hideCriteriaTitle: 'Filters chhupayein',
    showCriteriaTitle: 'Filters dikhayein',
    currencyLabel: 'Currency',
    minBudgetLabel: 'Min Budget',
    maxBudgetLabel: 'Max Budget',
    optionalPlaceholder: 'Optional',
    allLocationsLabel: 'All Dubai Locations',
    anyPropertyTypeLabel: 'Any Property Type',
    anyPurposeLabel: 'Any Purpose',
    purposeLabels: {
      Investment: 'Investment',
      'Personal living': 'Khud Rehne Ke Liye',
      'Rental income': 'Rental Income',
      'Capital appreciation': 'Capital Growth',
    },
    findMatchesBtn: 'Matches Dhoondhein',
    searchingIndicator: 'Verified Dubai projects search ho rahe hain',
    noExactMatchesBanner:
      'Exact match nahi mila — paas ke areas ya flexible budget ke verified alternatives dikha rahe hain:',
    bestMatchBadge: 'Best Match',
    alternativeBadge: 'Alternative',
    startingPriceLabel: 'Starting Price (AED)',
    estLabel: 'Est.',
    propertyTypeCardLabel: 'Property Type',
    bedroomsCardLabel: 'Bedrooms',
    paymentPlanCardLabel: 'Payment Plan',
    handoverCardLabel: 'Handover',
    estYieldLabel: 'Est. Yield:',
    notAvailableLabel: 'Not available',
    viewDetailsBtn: 'Details Dekhein',
    contactEnquireBtn: 'Contact / Enquire',
    inputPlaceholder: "Puchhein e.g. '1 crore ke andar JVC' ya 'Dubai Hills villa'...",
    askBtn: 'Bhejein',
    validationSelectCriteria:
      'Pehle budget, Dubai location, property type ya purpose select karein.',
    validationMinPositive: 'Minimum budget ek valid positive number hona chahiye.',
    validationMaxPositive: 'Maximum budget ek valid positive number hona chahiye.',
    validationMinExceedsMax: 'Minimum budget maximum budget se zyada nahi ho sakta.',
    genericNetworkError: 'Abhi Dubai Property Advisor se connect nahi ho pa raha hai.',
  },
};

