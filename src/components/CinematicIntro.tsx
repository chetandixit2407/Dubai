import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

interface CinematicIntroProps {
  open: boolean;
  onComplete: () => void;
}

export const INTRO_SEEN_STORAGE_KEY = 'wcr_intro_seen_v1';

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ open, onComplete }) => {
  const [phase, setPhase] = useState<'forest' | 'skyline' | 'brand' | 'exiting'>('forest');
  const exitTimerRef = useRef<number | null>(null);
  const hasFinishedRef = useRef(false);

  const handleFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    try {
      window.localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    } catch {
      // Ignore storage restrictions
    }
    setPhase('exiting');
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onComplete();
    }, 520);
  }, [onComplete]);

  useEffect(() => {
    if (!open) {
      hasFinishedRef.current = false;
      return;
    }

    hasFinishedRef.current = false;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      try {
        window.localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
      } catch {
        // ignore
      }
      onComplete();
      return;
    }

    setPhase('forest');
    const t1 = window.setTimeout(() => setPhase('skyline'), 320);
    const t2 = window.setTimeout(() => setPhase('brand'), 1550);
    const t3 = window.setTimeout(() => handleFinish(), 3700);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleFinish();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleFinish, onComplete]);

  if (!open) return null;

  const isSkylineVisible = phase === 'skyline' || phase === 'brand' || phase === 'exiting';
  const isBrandVisible = phase === 'brand' || phase === 'exiting';
  const isExiting = phase === 'exiting';

  return (
    <div
      role="dialog"
      aria-label="White Collar Realty Introductory Sequence"
      className={`fixed inset-0 z-[120] overflow-hidden select-none transition-opacity duration-500 ease-out ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'linear-gradient(180deg, #06140F 0%, #09130F 36%, #0B0D0C 68%, #080808 100%)',
      }}
    >
      {/* Ambient Radial Gold Rim Illumination */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: isSkylineVisible ? 0.95 : 0.25,
          background:
            'radial-gradient(ellipse 68% 48% at 50% 62%, rgba(212, 175, 114, 0.14) 0%, rgba(18, 42, 32, 0.22) 42%, transparent 78%)',
        }}
      />

      {/* Top Bar with Visible Skip Intro */}
      <div className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 sm:pt-6 pt-safe flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-[#D4AF72]/75 font-mono-tabular truncate">
          Dubai · Abu Dhabi · UAE
        </div>
        <button
          type="button"
          onClick={handleFinish}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#121212]/80 backdrop-blur-md border border-[#D4AF72]/35 text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.2em] font-medium transition-colors duration-200 cursor-pointer shrink-0"
        >
          <span>Skip Intro</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#D4AF72]" />
        </button>
      </div>

      {/* Camera Motion Container for Architectural Skyline */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[72vh] pointer-events-none flex items-end justify-center overflow-hidden"
        style={{
          transform: isSkylineVisible
            ? 'scale(1.035) translate3d(0, 0, 0)'
            : 'scale(1.12) translate3d(0, 28px, 0)',
          transition: 'transform 3400ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <svg
          viewBox="0 0 1440 520"
          preserveAspectRatio="xMidYMax slice"
          className="w-full h-full max-w-[1720px]"
        >
          <defs>
            <linearGradient id="towerObsidian" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A1A1A" />
              <stop offset="55%" stopColor="#0E0E0E" />
              <stop offset="100%" stopColor="#060606" />
            </linearGradient>
            <linearGradient id="towerFar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#12211B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#080C0A" stopOpacity="0.98" />
            </linearGradient>
            <linearGradient id="goldEdge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E6C77A" stopOpacity="0.88" />
              <stop offset="45%" stopColor="#D4AF72" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#A88750" stopOpacity="0.06" />
            </linearGradient>
            <linearGradient id="waterReflect" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4AF72" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#080808" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizon Glow Line */}
          <line
            x1="80"
            y1="448"
            x2="1360"
            y2="448"
            stroke="#D4AF72"
            strokeOpacity={isSkylineVisible ? 0.38 : 0}
            strokeWidth="1"
            style={{ transition: 'stroke-opacity 1200ms ease-out' }}
          />

          {/* Layer 1: Distant Coastal & Downtown Silhouettes */}
          <g
            style={{
              opacity: isSkylineVisible ? 0.85 : 0,
              transform: isSkylineVisible ? 'translate3d(0,0,0)' : 'translate3d(0,36px,0)',
              transition: 'opacity 1100ms ease-out, transform 1400ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <rect x="65" y="295" width="44" height="153" fill="url(#towerFar)" />
            <rect x="122" y="262" width="54" height="186" fill="url(#towerFar)" />
            <polygon points="200,448 200,238 248,215 248,448" fill="url(#towerFar)" />
            <rect x="275" y="254" width="58" height="194" fill="url(#towerFar)" />
            <rect x="358" y="218" width="46" height="230" fill="url(#towerFar)" />
            <rect x="1010" y="232" width="52" height="216" fill="url(#towerFar)" />
            <polygon points="1090,448 1090,210 1142,240 1142,448" fill="url(#towerFar)" />
            <rect x="1170" y="255" width="64" height="193" fill="url(#towerFar)" />
            <rect x="1265" y="286" width="48" height="162" fill="url(#towerFar)" />
            <rect x="1335" y="310" width="46" height="138" fill="url(#towerFar)" />
          </g>

          {/* Layer 2: Mid-Ground Architectural Luxury Towers */}
          <g
            style={{
              opacity: isSkylineVisible ? 1 : 0,
              transform: isSkylineVisible ? 'translate3d(0,0,0)' : 'translate3d(0,55px,0)',
              transition:
                'opacity 1200ms ease-out 180ms, transform 1600ms cubic-bezier(0.22,1,0.36,1) 140ms',
            }}
          >
            {/* Left Crown Twin */}
            <rect x="424" y="182" width="54" height="266" fill="url(#towerObsidian)" stroke="#D4AF72" strokeOpacity="0.22" strokeWidth="0.8" />
            <line x1="451" y1="145" x2="451" y2="182" stroke="#D4AF72" strokeOpacity="0.5" strokeWidth="1" />
            <rect x="492" y="220" width="68" height="228" fill="url(#towerObsidian)" stroke="#D4AF72" strokeOpacity="0.18" strokeWidth="0.8" />
            {/* Address-Style Sloped Podium */}
            <polygon points="576,448 576,170 638,148 638,448" fill="url(#towerObsidian)" stroke="url(#goldEdge)" strokeWidth="1" />

            {/* Right Architectural Sail & Towers */}
            <polygon points="804,448 804,158 866,180 866,448" fill="url(#towerObsidian)" stroke="url(#goldEdge)" strokeWidth="1" />
            <rect x="882" y="210" width="60" height="238" fill="url(#towerObsidian)" stroke="#D4AF72" strokeOpacity="0.2" strokeWidth="0.8" />
            <path d="M962 448 Q974 285 1018 195 Q1028 310 1026 448 Z" fill="url(#towerObsidian)" stroke="url(#goldEdge)" strokeWidth="1" />
          </g>

          {/* Layer 3: Centerpiece Burj Spire Silhouette */}
          <g
            style={{
              opacity: isSkylineVisible ? 1 : 0,
              transform: isSkylineVisible ? 'translate3d(0,0,0)' : 'translate3d(0,75px,0)',
              transition:
                'opacity 1350ms ease-out 260ms, transform 1750ms cubic-bezier(0.22,1,0.36,1) 200ms',
            }}
          >
            {/* Tapered Tiers */}
            <polygon
              points="720,24 723,128 730,134 732,208 742,216 745,294 758,304 764,382 778,390 784,448 656,448 662,390 676,382 682,304 695,294 698,216 708,208 710,134 717,128"
              fill="url(#towerObsidian)"
              stroke="url(#goldEdge)"
              strokeWidth="1.15"
            />
            {/* Center Gold Spine Line */}
            <line x1="720" y1="24" x2="720" y2="448" stroke="#D4AF72" strokeOpacity="0.45" strokeWidth="1" />
            {/* Spire Tip Sparkle */}
            <circle cx="720" cy="24" r="2.2" fill="#E6C77A" opacity={isBrandVisible ? 0.95 : 0.35} />
          </g>

          {/* Subtle Window Glint Stripes */}
          <g
            opacity={isBrandVisible ? 0.55 : 0}
            style={{ transition: 'opacity 1400ms ease-out 300ms' }}
          >
            <line x1="436" y1="205" x2="436" y2="430" stroke="#D4AF72" strokeOpacity="0.22" strokeDasharray="3 10" />
            <line x1="595" y1="185" x2="595" y2="430" stroke="#D4AF72" strokeOpacity="0.22" strokeDasharray="2 12" />
            <line x1="846" y1="190" x2="846" y2="430" stroke="#D4AF72" strokeOpacity="0.22" strokeDasharray="2 12" />
            <line x1="905" y1="230" x2="905" y2="430" stroke="#D4AF72" strokeOpacity="0.22" strokeDasharray="3 10" />
          </g>

          {/* Creek Water Horizon Reflection */}
          <rect
            x="240"
            y="449"
            width="960"
            height="70"
            fill="url(#waterReflect)"
            opacity={isSkylineVisible ? 0.75 : 0}
            style={{ transition: 'opacity 1200ms ease-out' }}
          />
        </svg>
      </div>

      {/* Editorial Brand Reveal Overlay */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center px-4 sm:px-6 text-center pb-20 sm:pb-24 pb-safe">
        <div
          style={{
            opacity: isBrandVisible ? 1 : 0,
            transform: isBrandVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 18px, 0)',
            transition: 'opacity 850ms cubic-bezier(0.22, 1, 0.36, 1), transform 850ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          className="max-w-3xl w-full"
        >
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.38em] text-[#D4AF72] font-medium mb-3 sm:mb-4">
            Private Real Estate Advisory
          </p>
          <h1 className="font-display text-3xl xs:text-4xl sm:text-6xl md:text-7xl font-medium tracking-[0.06em] text-[#F5F1E8] leading-tight">
            WHITE COLLAR REALTY
          </h1>
          <div
            className="mx-auto my-5 h-px bg-gradient-to-r from-transparent via-[#D4AF72] to-transparent"
            style={{
              width: isBrandVisible ? '220px' : '0px',
              transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1) 180ms',
            }}
          />
          <p className="font-display italic text-lg sm:text-2xl text-[#D4AF72]/90 tracking-wide">
            Discover Extraordinary Living.
          </p>
        </div>
      </div>
    </div>
  );
};
