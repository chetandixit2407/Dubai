import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Calendar,
  Compass,
  CreditCard,
  Info,
  Languages,
  MapPin,
  MessageSquare,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  AdvisorLanguagePreference,
  AdvisorResolvedLanguage,
  CurrencyCode,
  Project,
} from '../types/realEstate.ts';
import {
  AdvisorRecommendationCard,
  DubaiAdvisorResponse,
  fetchDubaiAdvisorRecommendations,
  fetchServerFxRates,
  ServerFxRatesResponse,
} from '../services/apiClient.ts';
import { ADVISOR_CHAT_TRANSLATIONS } from '../i18n/translations.ts';
import { CURRENCY_RATES_FROM_AED, EXCHANGE_RATE_UPDATED_AT } from '../utils/currency.ts';

interface DubaiAdvisorChatbotProps {
  projects: Project[];
  defaultCurrency: CurrencyCode;
  hasCompareTray?: boolean;
  onOpenProject: (project: Project) => void;
  onEnquireProject: (project: Project) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendations?: AdvisorRecommendationCard[];
  hasExactMatches?: boolean;
  aiStatus?: 'ok' | 'cached' | 'unavailable';
  aiNotice?: string;
  followUpSuggestions?: string[];
  fxSnapshotNote?: string;
}

const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;
const HINGLISH_PATTERN =
  /\b(mujhe|mujhko|chahiye|chaahiye|dikhao|dikhaiye|batao|bataiye|bataye|kaunsa|kaunse|konsa|konse|kitna|kitne|kya|hai|hain|nahi|nahin|mein|karod|karor|hazar|hazaar|rupaye|rupye|mera|meri|mere|ghar|kiraya|kiraye|nivesh|lena|khareedna|behtar|accha|achha|sasta|sabse|milega|milegi|dega|kist|kab|rehne|karo|ke andar|se kam|ke liye|ke beech|se zyada|se jyada)\b/i;

function detectClientAdvisorLanguage(
  text: string,
  fallback: AdvisorResolvedLanguage = 'en'
): AdvisorResolvedLanguage {
  const trimmed = (text || '').trim();
  if (!trimmed) return fallback;
  if (DEVANAGARI_PATTERN.test(trimmed)) return 'hi';
  if (HINGLISH_PATTERN.test(trimmed)) return 'hinglish';
  if (/[a-zA-Z]{2,}/.test(trimmed)) return 'en';
  return fallback;
}

const DUBAI_LOCATION_OPTIONS: string[] = [
  'Dubai Marina',
  'Downtown Dubai',
  'Business Bay',
  'Jumeirah Village Circle (JVC)',
  'Dubai Hills Estate',
  'Palm Jumeirah',
  'Dubai Creek Harbour',
  'Arabian Ranches',
  'DAMAC Hills',
  'Other locations',
];

const PROPERTY_TYPE_OPTIONS: string[] = [
  'Studio',
  '1 Bedroom',
  '2 Bedroom',
  '3 Bedroom',
  'Apartment',
  'Villa',
  'Townhouse',
  'Penthouse',
];

const PURPOSE_OPTIONS: Array<
  'Investment' | 'Personal living' | 'Rental income' | 'Capital appreciation'
> = ['Investment', 'Personal living', 'Rental income', 'Capital appreciation'];

const CURRENCIES: CurrencyCode[] = ['AED', 'INR', 'USD', 'GBP', 'EUR', 'SAR'];

function createInitialMessages(lang: AdvisorResolvedLanguage = 'en'): ChatMessage[] {
  const copy = ADVISOR_CHAT_TRANSLATIONS[lang];
  return [
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: copy.welcomeMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      followUpSuggestions: copy.suggestedQuestions.slice(0, 3),
    },
  ];
}

export const DubaiAdvisorChatbot: React.FC<DubaiAdvisorChatbotProps> = ({
  projects,
  defaultCurrency,
  hasCompareTray = false,
  onOpenProject,
  onEnquireProject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [languagePreference, setLanguagePreference] =
    useState<AdvisorLanguagePreference>('auto');
  const [detectedLanguage, setDetectedLanguage] =
    useState<AdvisorResolvedLanguage>('en');
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages('en'));
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const activeLanguage: AdvisorResolvedLanguage =
    languagePreference === 'auto' ? detectedLanguage : languagePreference;
  const ui = ADVISOR_CHAT_TRANSLATIONS[activeLanguage];

  // Structured Preferences State (kept synced with conversational turns)
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [minBudget, setMinBudget] = useState<string>('');
  const [maxBudget, setMaxBudget] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('');
  const [purpose, setPurpose] = useState<
    '' | 'Investment' | 'Personal living' | 'Rental income' | 'Capital appreciation'
  >('');

  const [lastRecommendedIds, setLastRecommendedIds] = useState<string[]>([]);
  const [fxData, setFxData] = useState<ServerFxRatesResponse | null>(null);
  const [failedCardImages, setFailedCardImages] = useState<Record<string, boolean>>({});

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  // Sync initial site currency when changed if user hasn't started a custom conversation
  useEffect(() => {
    if (messages.length <= 1) {
      setCurrency(defaultCurrency);
    }
  }, [defaultCurrency, messages.length]);

  // Fetch cached server FX rates when chatbot opens
  useEffect(() => {
    if (!isOpen || fxData) return;
    fetchServerFxRates()
      .then((res) => setFxData(res))
      .catch(() => {
        // Silent fallback to baseline indicator
      });
  }, [isOpen, fxData]);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  const activeFxRate =
    fxData?.ratesFromAed?.[currency] ?? CURRENCY_RATES_FROM_AED[currency] ?? 1;
  const activeFxDate = fxData?.lastUpdatedAt || EXCHANGE_RATE_UPDATED_AT;

  const handleLanguageChange = (nextPref: AdvisorLanguagePreference) => {
    setLanguagePreference(nextPref);

    let nextResolved: AdvisorResolvedLanguage = detectedLanguage;
    if (nextPref === 'en' || nextPref === 'hi' || nextPref === 'hinglish') {
      nextResolved = nextPref;
      setDetectedLanguage(nextPref);
    } else {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      nextResolved = lastUser
        ? detectClientAdvisorLanguage(lastUser.content, 'en')
        : 'en';
      setDetectedLanguage(nextResolved);
    }

    // Never reset conversation history; only localize initial welcome card if chat has not begun
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome-msg') {
        const copy = ADVISOR_CHAT_TRANSLATIONS[nextResolved];
        return [
          {
            ...prev[0],
            content: copy.welcomeMessage,
            followUpSuggestions: copy.suggestedQuestions.slice(0, 3),
          },
        ];
      }
      return prev;
    });
  };

  const handleClearChat = () => {
    const resetLang: AdvisorResolvedLanguage =
      languagePreference === 'auto' ? 'en' : languagePreference;
    if (languagePreference === 'auto') {
      setDetectedLanguage('en');
    }
    setMessages(createInitialMessages(resetLang));
    setLastRecommendedIds([]);
    setMinBudget('');
    setMaxBudget('');
    setLocation('');
    setPropertyType('');
    setPurpose('');
    setErrorBanner(null);
  };

  const submitQuery = async (customMessage?: string, fromFilterApply = false) => {
    const trimmed = (customMessage ?? inputText).trim();
    const minVal = minBudget.trim() ? Number(minBudget) : null;
    const maxVal = maxBudget.trim() ? Number(maxBudget) : null;

    if (!trimmed && !fromFilterApply) return;
    if (
      fromFilterApply &&
      !trimmed &&
      !minVal &&
      !maxVal &&
      !location &&
      !propertyType &&
      !purpose
    ) {
      setErrorBanner(ui.validationSelectCriteria);
      return;
    }

    if (minVal !== null && (!Number.isFinite(minVal) || minVal <= 0)) {
      setErrorBanner(ui.validationMinPositive);
      return;
    }
    if (maxVal !== null && (!Number.isFinite(maxVal) || maxVal <= 0)) {
      setErrorBanner(ui.validationMaxPositive);
      return;
    }
    if (minVal !== null && maxVal !== null && minVal > maxVal) {
      setErrorBanner(ui.validationMinExceedsMax);
      return;
    }

    setErrorBanner(null);

    const requestLangForTurn: AdvisorLanguagePreference =
      fromFilterApply && !trimmed ? activeLanguage : languagePreference;

    if (languagePreference === 'auto' && trimmed) {
      setDetectedLanguage(detectClientAdvisorLanguage(trimmed, detectedLanguage));
    }

    const displayUserPrompt =
      trimmed ||
      [
        location || ui.allLocationsLabel,
        propertyType || ui.anyPropertyTypeLabel,
        maxVal ? `<= ${currency} ${maxVal.toLocaleString()}` : '',
        minVal ? `>= ${currency} ${minVal.toLocaleString()}` : '',
        purpose ? ui.purposeLabels[purpose] : '',
      ]
        .filter(Boolean)
        .join(' · ');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayUserPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!customMessage) setInputText('');
    setIsLoading(true);

    // Limit conversation history to the last 4 relevant messages for token optimization
    const recentHistory = nextMessages
      .filter((m) => m.id !== 'welcome-msg')
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response: DubaiAdvisorResponse = await fetchDubaiAdvisorRecommendations({
        message: displayUserPrompt,
        preferences: {
          minBudget: minVal,
          maxBudget: maxVal,
          currency,
          location,
          propertyType,
          purpose,
        },
        history: recentHistory,
        previousProjectIds: lastRecommendedIds,
        language: requestLangForTurn,
      });

      const resolvedLang =
        response.resolvedContext?.detectedLanguage || response.detectedLanguage;
      if (resolvedLang) {
        setDetectedLanguage(resolvedLang);
      }

      // Keep UI preference controls synchronized with extracted NLU context
      const ctx = response.resolvedContext;
      if (ctx.currency) setCurrency(ctx.currency);
      if (ctx.location !== undefined) setLocation(ctx.location);
      if (ctx.propertyType !== undefined) setPropertyType(ctx.propertyType);
      if (ctx.purpose !== undefined) {
        setPurpose(
          ctx.purpose as
            | ''
            | 'Investment'
            | 'Personal living'
            | 'Rental income'
            | 'Capital appreciation'
        );
      }
      if (ctx.minBudget !== null) setMinBudget(String(ctx.minBudget));
      if (ctx.maxBudget !== null) setMaxBudget(String(ctx.maxBudget));

      if (response.recommendations.length > 0) {
        setLastRecommendedIds(response.recommendations.map((r) => r.id));
      }

      const fxNote =
        response.fxInfo.selectedCurrency !== 'AED'
          ? `Estimated conversion (1 AED ≈ ${response.fxInfo.rateFromAed} ${response.fxInfo.selectedCurrency} · FX updated ${response.fxInfo.lastUpdatedAt})`
          : `Official AED pricing · FX table updated ${response.fxInfo.lastUpdatedAt}`;

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommendations: response.recommendations,
        hasExactMatches: response.hasExactMatches,
        aiStatus: response.aiStatus,
        aiNotice: response.aiNotice,
        followUpSuggestions: response.followUpSuggestions,
        fxSnapshotNote: fxNote,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.genericNetworkError;
      setErrorBanner(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProjectFromCard = (card: AdvisorRecommendationCard) => {
    const found =
      projectById.get(card.id) || projects.find((p) => p.slug === card.slug);
    if (found) {
      setIsOpen(false);
      onOpenProject(found);
    }
  };

  const handleEnquireFromCard = (card: AdvisorRecommendationCard) => {
    const found =
      projectById.get(card.id) || projects.find((p) => p.slug === card.slug);
    if (found) {
      onEnquireProject(found);
    }
  };

  return (
    <>
      {/* Floating Luxury Chatbot Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 200);
          }}
          aria-label="Open Dubai Property Advisor AI Chatbot"
          className={`fixed right-3 sm:right-6 z-40 group flex items-center gap-2.5 bg-[#121212] hover:bg-[#1B1B1B] text-[#F5F1E8] border border-[#D4AF72]/60 hover:border-[#D4AF72] px-3.5 sm:px-4 h-12 shadow-[0_14px_40px_rgba(0,0,0,0.75)] transition-all duration-200 cursor-pointer ${
            hasCompareTray
              ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-6'
              : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6'
          }`}
        >
          <span className="w-7 h-7 bg-[#D4AF72] text-[#080808] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-xs font-semibold text-[#F5F1E8] tracking-wide">
              {ui.advisorTitle}
            </span>
            <span className="hidden sm:block text-[10px] text-[#D4AF72]">
              {ui.launcherSubtitle}
            </span>
          </span>
        </button>
      )}

      {/* Animated Expandable Chat Workspace */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            role="dialog"
            lang={activeLanguage === 'hi' ? 'hi' : 'en'}
            aria-label={ui.advisorTitle}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-x-2 bottom-2 top-14 sm:inset-auto sm:right-6 sm:bottom-6 z-50 sm:w-[460px] md:w-[500px] sm:h-[min(82vh,760px)] bg-[#080808] border border-[#D4AF72]/45 shadow-[0_24px_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header className="px-3 sm:px-4 py-3 bg-[#121212] border-b border-[#D4AF72]/25 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 bg-[#D4AF72] text-[#080808] flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base sm:text-xl font-medium text-[#F5F1E8] leading-tight truncate">
                    {ui.advisorTitle}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-[#D4AF72] truncate">
                    {ui.headerSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="relative flex items-center h-8 bg-[#1B1B1B] border border-[#D4AF72]/30 hover:border-[#D4AF72]/60 transition-colors">
                  <Languages className="w-3.5 h-3.5 text-[#D4AF72] ml-2 pointer-events-none shrink-0" />
                  <select
                    aria-label={ui.languageAriaLabel}
                    title={ui.languageAriaLabel}
                    value={languagePreference}
                    onChange={(e) =>
                      handleLanguageChange(e.target.value as AdvisorLanguagePreference)
                    }
                    className="h-full pl-1 pr-1.5 bg-transparent text-[11px] font-medium text-[#F5F1E8] focus:outline-none cursor-pointer"
                  >
                    <option value="auto" className="bg-[#121212] text-[#F5F1E8]">
                      {ui.autoLabel}
                    </option>
                    <option value="en" className="bg-[#121212] text-[#F5F1E8]">
                      English
                    </option>
                    <option value="hi" className="bg-[#121212] text-[#F5F1E8]">
                      हिंदी
                    </option>
                    <option value="hinglish" className="bg-[#121212] text-[#F5F1E8]">
                      Hinglish
                    </option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  title={showFilters ? ui.hideCriteriaTitle : ui.showCriteriaTitle}
                  aria-label="Toggle search preferences"
                  className={`h-8 px-2 text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                    showFilters
                      ? 'bg-[#D4AF72]/15 text-[#D4AF72] border-[#D4AF72]/50'
                      : 'bg-[#1B1B1B] text-[#A5A19A] border-[#D4AF72]/20 hover:text-[#F5F1E8]'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{ui.criteriaBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearChat}
                  title={ui.clearBtn}
                  aria-label="Clear chat"
                  className="h-8 px-2 bg-[#1B1B1B] border border-[#D4AF72]/20 text-[11px] text-[#A5A19A] hover:text-[#F5F1E8] hover:border-[#D4AF72]/50 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{ui.clearBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Dubai Property Advisor"
                  className="w-8 h-8 bg-[#1B1B1B] border border-[#D4AF72]/20 text-[#A5A19A] hover:text-[#F5F1E8] hover:border-[#D4AF72] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Structured Preferences Controls */}
            {showFilters && (
              <div className="px-3.5 py-2.5 bg-[#121212]/95 border-b border-[#D4AF72]/20 space-y-2 shrink-0 text-[11px]">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#A5A19A] mb-1">
                      {ui.currencyLabel}
                    </label>
                    <select
                      aria-label={ui.currencyLabel}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="w-full h-8 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#A5A19A] mb-1 truncate">
                      {ui.minBudgetLabel} ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder={ui.optionalPlaceholder}
                      aria-label={ui.minBudgetLabel}
                      value={minBudget}
                      onChange={(e) => setMinBudget(e.target.value)}
                      className="w-full h-8 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[#F5F1E8] text-xs font-mono-tabular placeholder:text-[#7C7871] focus:outline-none focus:border-[#D4AF72]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#A5A19A] mb-1 truncate">
                      {ui.maxBudgetLabel} ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder={currency === 'INR' ? 'e.g. 10000000' : 'e.g. 1500000'}
                      aria-label={ui.maxBudgetLabel}
                      value={maxBudget}
                      onChange={(e) => setMaxBudget(e.target.value)}
                      className="w-full h-8 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[#F5F1E8] text-xs font-mono-tabular placeholder:text-[#7C7871] focus:outline-none focus:border-[#D4AF72]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                  <select
                    aria-label="Preferred Dubai location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full h-8 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
                  >
                    <option value="">{ui.allLocationsLabel}</option>
                    {DUBAI_LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Property type"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full h-8 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
                  >
                    <option value="">{ui.anyPropertyTypeLabel}</option>
                    {PROPERTY_TYPE_OPTIONS.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Investment or living purpose"
                    value={purpose}
                    onChange={(e) =>
                      setPurpose(
                        e.target.value as
                          | ''
                          | 'Investment'
                          | 'Personal living'
                          | 'Rental income'
                          | 'Capital appreciation'
                      )
                    }
                    className="w-full h-8 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
                  >
                    <option value="">{ui.anyPurposeLabel}</option>
                    {PURPOSE_OPTIONS.map((purp) => (
                      <option key={purp} value={purp}>
                        {ui.purposeLabels[purp]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[10px] text-[#A5A19A] truncate">
                    {currency === 'AED'
                      ? `Base AED · FX updated ${activeFxDate}`
                      : `Est. 1 AED ≈ ${activeFxRate} ${currency} · Updated ${activeFxDate}`}
                  </span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => submitQuery(undefined, true)}
                    className="h-7 px-3 bg-[#D4AF72] hover:bg-[#E6C77A] disabled:opacity-50 text-[#080808] text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors"
                  >
                    {ui.findMatchesBtn}
                  </button>
                </div>
              </div>
            )}

            {/* Chat Conversation Feed */}
            <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 bg-[#080808]">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-3">
                  <div
                    className={`flex items-start gap-2.5 ${
                      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 flex items-center justify-center shrink-0 border mt-0.5 ${
                        msg.role === 'assistant'
                          ? 'bg-[#121212] border-[#D4AF72]/60 text-[#D4AF72]'
                          : 'bg-[#D4AF72] border-[#D4AF72] text-[#080808]'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <UserIcon className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 text-xs leading-relaxed border ${
                        msg.role === 'assistant'
                          ? 'bg-[#121212] border-[#D4AF72]/25 text-[#F5F1E8]'
                          : 'bg-[#1B1B1B] border-[#D4AF72]/45 text-[#F5F1E8]'
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.content}</p>

                      {msg.aiNotice && (
                        <div className="mt-2 p-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[11px] text-[#FCD34D] flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{msg.aiNotice}</span>
                        </div>
                      )}

                      {msg.fxSnapshotNote && (
                        <p className="mt-2 pt-1.5 border-t border-[#D4AF72]/15 text-[10px] text-[#A5A19A]">
                          {msg.fxSnapshotNote}
                        </p>
                      )}

                      <span className="block text-[10px] text-[#7C7871] mt-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Recommendation Cards */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="pl-9 space-y-2.5">
                      {!msg.hasExactMatches && (
                        <div className="px-2.5 py-1.5 bg-[#1B1B1B] border border-[#D4AF72]/35 text-[11px] text-[#D4AF72] flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          <span>{ui.noExactMatchesBanner}</span>
                        </div>
                      )}

                      {msg.recommendations.map((card) => {
                        const imgBroken = !card.heroImage || failedCardImages[card.id];
                        const hasVerifiedYield =
                          card.verifiedNetYieldPct !== null ||
                          card.verifiedGrossYieldPct !== null;

                        return (
                          <div
                            key={`${msg.id}-${card.id}`}
                            className="bg-[#121212] border border-[#D4AF72]/30 hover:border-[#D4AF72] transition-colors overflow-hidden"
                          >
                            {/* Card Image + Top Badges */}
                            <div className="relative h-32 w-full bg-[#1B1B1B] overflow-hidden">
                              {!imgBroken ? (
                                <img
                                  src={card.heroImage}
                                  alt={card.name}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={() =>
                                    setFailedCardImages((prev) => ({
                                      ...prev,
                                      [card.id]: true,
                                    }))
                                  }
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[#A5A19A]">
                                  <Building2 className="w-6 h-6 text-[#D4AF72] mb-1" />
                                  <span className="text-[10px] uppercase tracking-wider">
                                    {card.name}
                                  </span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/95 via-[#080808]/35 to-transparent" />

                              <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1.5">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                                    card.matchType === 'exact'
                                      ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                                      : 'bg-[#1B1B1B]/95 text-[#FCD34D] border-[#FCD34D]/40'
                                  }`}
                                >
                                  {card.matchType === 'exact' ? ui.bestMatchBadge : ui.alternativeBadge}
                                </span>
                                <span className="px-2 py-0.5 bg-[#080808]/85 border border-[#D4AF72]/30 text-[10px] text-[#F5F1E8]">
                                  {card.category}
                                </span>
                              </div>

                              <div className="absolute bottom-2 left-2.5 right-2.5">
                                <h4 className="font-display text-lg font-medium text-[#F5F1E8] leading-snug truncate">
                                  {card.name}
                                </h4>
                                <p className="text-[11px] text-[#A5A19A] truncate">
                                  {card.developerName}
                                </p>
                              </div>
                            </div>

                            {/* Card Details Grid */}
                            <div className="p-3 space-y-2.5 text-xs">
                              <div className="flex items-center justify-between gap-2 text-[11px] text-[#A5A19A]">
                                <span className="flex items-center gap-1 min-w-0 truncate">
                                  <MapPin className="w-3 h-3 text-[#D4AF72] shrink-0" />
                                  <span className="truncate">
                                    {card.community}, {card.emirate}
                                  </span>
                                </span>
                                <span className="text-[10px] text-[#D4AF72] shrink-0">
                                  {card.status}
                                </span>
                              </div>

                              {/* Starting Price + Estimated Selected Currency */}
                              <div className="p-2 bg-[#1B1B1B] border border-[#D4AF72]/15 flex flex-wrap items-baseline justify-between gap-2">
                                <div>
                                  <span className="block text-[10px] uppercase tracking-wider text-[#A5A19A]">
                                    {ui.startingPriceLabel}
                                  </span>
                                  <span className="font-mono-tabular text-sm font-semibold text-[#F5F1E8]">
                                    {card.formattedStartingPriceAed}
                                  </span>
                                </div>
                                {card.currency !== 'AED' && (
                                  <div className="text-right">
                                    <span className="block text-[10px] text-[#D4AF72]">
                                      {ui.estLabel} ({card.currency})
                                    </span>
                                    <span className="font-mono-tabular text-xs font-semibold text-[#D4AF72]">
                                      {card.formattedStartingPriceSelected}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Structured Attributes */}
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                                <div>
                                  <span className="text-[#7C7871] block text-[10px]">
                                    {ui.propertyTypeCardLabel}
                                  </span>
                                  <span className="text-[#F5F1E8] font-medium line-clamp-1">
                                    {card.propertyTypes.slice(0, 2).join(', ')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[#7C7871] block text-[10px]">
                                    {ui.bedroomsCardLabel}
                                  </span>
                                  <span className="text-[#F5F1E8] font-medium line-clamp-1">
                                    {card.bedroomOptions}
                                  </span>
                                </div>
                                <div className="flex items-start gap-1">
                                  <CreditCard className="w-3 h-3 text-[#D4AF72] shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="text-[#7C7871] block text-[10px]">
                                      {ui.paymentPlanCardLabel}
                                    </span>
                                    <span className="text-[#F5F1E8] font-medium line-clamp-1">
                                      {card.paymentPlan}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-start gap-1">
                                  <Calendar className="w-3 h-3 text-[#D4AF72] shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="text-[#7C7871] block text-[10px]">
                                      {ui.handoverCardLabel}
                                    </span>
                                    <span className="text-[#F5F1E8] font-medium line-clamp-1">
                                      {card.handoverDate}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Verified ROI / Yield */}
                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#D4AF72]/15 text-[11px]">
                                <span className="flex items-center gap-1 text-[#A5A19A]">
                                  <TrendingUp className="w-3.5 h-3.5 text-[#6EE7B7]" />
                                  <span>{ui.estYieldLabel}</span>
                                </span>
                                <span className="font-mono-tabular font-semibold text-[#6EE7B7]">
                                  {hasVerifiedYield
                                    ? `${
                                        card.verifiedNetYieldPct !== null
                                          ? `Net ${card.verifiedNetYieldPct}%`
                                          : ''
                                      }${
                                        card.verifiedNetYieldPct !== null &&
                                        card.verifiedGrossYieldPct !== null
                                          ? ' · '
                                          : ''
                                      }${
                                        card.verifiedGrossYieldPct !== null
                                          ? `Gross ${card.verifiedGrossYieldPct}%`
                                          : ''
                                      }`
                                    : ui.notAvailableLabel}
                                </span>
                              </div>

                              <p className="text-[10px] text-[#A5A19A] italic">
                                {card.matchReason}
                              </p>

                              {/* Action Buttons */}
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProjectFromCard(card)}
                                  className="h-8 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/40 hover:border-[#D4AF72] text-[#F5F1E8] hover:text-[#D4AF72] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Compass className="w-3 h-3" />
                                  <span>{ui.viewDetailsBtn}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEnquireFromCard(card)}
                                  className="h-8 px-2.5 bg-[#D4AF72] hover:bg-[#E6C77A] text-[#080808] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{ui.contactEnquireBtn}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Contextual Follow-up Suggestions */}
                  {msg.role === 'assistant' &&
                    msg.followUpSuggestions &&
                    msg.followUpSuggestions.length > 0 && (
                      <div className="pl-9 flex flex-wrap gap-1.5">
                        {msg.followUpSuggestions.map((sq) => (
                          <button
                            key={`${msg.id}-sq-${sq}`}
                            type="button"
                            disabled={isLoading}
                            onClick={() => submitQuery(sq)}
                            className="px-2.5 py-1 bg-[#121212] hover:bg-[#1B1B1B] border border-[#D4AF72]/30 hover:border-[#D4AF72] text-[11px] text-[#D4AF72] text-left transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {sq}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 bg-[#121212] border border-[#D4AF72]/60 text-[#D4AF72] flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="px-3.5 py-2.5 bg-[#121212] border border-[#D4AF72]/25 text-xs text-[#A5A19A] flex items-center gap-2">
                    <span>{ui.searchingIndicator}</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#D4AF72] rounded-full animate-bounce [animation-delay:-0.2s]" />
                      <span className="w-1.5 h-1.5 bg-[#D4AF72] rounded-full animate-bounce [animation-delay:-0.1s]" />
                      <span className="w-1.5 h-1.5 bg-[#D4AF72] rounded-full animate-bounce" />
                    </span>
                  </div>
                </div>
              )}

              {/* Quick Suggested Questions Strip on First Turn */}
              {messages.length <= 1 && !isLoading && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-[#A5A19A]">
                    {ui.popularQueriesLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ui.suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => submitQuery(q)}
                        className="px-2.5 py-1.5 bg-[#121212] hover:bg-[#1B1B1B] border border-[#D4AF72]/25 hover:border-[#D4AF72] text-[11px] text-[#F5F1E8] text-left transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>

            {/* Error Banner */}
            {errorBanner && (
              <div className="px-3.5 py-2 bg-[#7F1D1D]/45 border-t border-[#F87171]/40 text-[11px] text-[#FCA5A5] flex items-center justify-between gap-2 shrink-0">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorBanner}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  aria-label="Dismiss error"
                  className="text-[#FCA5A5] hover:text-[#F5F1E8]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Chat Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitQuery();
              }}
              className="p-3 bg-[#121212] border-t border-[#D4AF72]/25 flex items-center gap-2 shrink-0 pb-safe"
            >
              <input
                ref={inputRef}
                type="text"
                maxLength={600}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={ui.inputPlaceholder}
                aria-label={ui.advisorTitle}
                className="flex-1 min-w-0 h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] placeholder:text-[#7C7871] focus:outline-none focus:border-[#D4AF72]"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                aria-label="Send message"
                className="h-10 px-3.5 bg-[#D4AF72] hover:bg-[#E6C77A] disabled:opacity-45 text-[#080808] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{ui.askBtn}</span>
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
