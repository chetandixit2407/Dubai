import React, { useState } from 'react';
import {
  Bell,
  Bookmark,
  Clock,
  Film,
  LogOut,
  MessageSquare,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  Enquiry,
  Project,
  SavedSearch,
  UserFavorite,
  UserProfile,
} from '../types/realEstate.ts';
import { formatProjectPrice } from '../utils/currency.ts';

interface CustomerPortalModalProps {
  userProfile: UserProfile | null;
  projects: Project[];
  recentlyViewedProjects?: Project[];
  favorites: UserFavorite[];
  savedSearches: SavedSearch[];
  enquiries: Enquiry[];
  currency: CurrencyCode;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSelectProject: (project: Project) => void;
  onRemoveFavorite: (projectId: string, projectName: string) => Promise<void>;
  onDeleteSavedSearch: (searchId: string) => Promise<void>;
  onApplySavedSearch: (search: SavedSearch) => void;
  onReplayIntro?: () => void;
  onClose: () => void;
}

export const CustomerPortalModal: React.FC<CustomerPortalModalProps> = ({
  userProfile,
  projects,
  recentlyViewedProjects = [],
  favorites,
  savedSearches,
  enquiries,
  currency,
  onSignIn,
  onSignOut,
  onSelectProject,
  onRemoveFavorite,
  onDeleteSavedSearch,
  onApplySavedSearch,
  onReplayIntro,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent' | 'searches' | 'enquiries'>(
    'favorites'
  );

  const savedProjectsList = projects.filter((p) =>
    favorites.some((f) => f.projectId === p.id)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] text-[#F5F1E8] border border-[#D4AF72]/35 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#D4AF72]/20 bg-[#080808] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-[#D4AF72]" />
            <div>
              <h2 className="font-display text-2xl font-medium text-[#F5F1E8]">
                Private Client Portal
              </h2>
              {userProfile && (
                <p className="text-xs text-[#A5A19A]">
                  {userProfile.displayName} · {userProfile.email} · Role: {userProfile.role}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onReplayIntro && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReplayIntro();
                }}
                className="h-9 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 transition-colors"
              >
                <Film className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Replay Intro</span>
              </button>
            )}
            {userProfile && (
              <button
                type="button"
                onClick={onSignOut}
                className="h-9 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#A5A19A] hover:text-[#F5F1E8] flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Client Portal"
              className="w-9 h-9 bg-[#1B1B1B] border border-[#D4AF72]/25 flex items-center justify-center hover:border-[#D4AF72] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!userProfile ? (
          <div className="p-10 text-center max-w-lg mx-auto space-y-6">
            <div>
              <h3 className="font-display text-2xl font-medium text-[#F5F1E8] mb-2">
                Sign in to access your UAE Portfolio
              </h3>
              <p className="text-sm text-[#A5A19A] mb-6 leading-relaxed">
                Save favourite developments, subscribe to live unit availability and price change
                alerts, and track property viewings and enquiries.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="px-6 py-3 bg-[#D4AF72] text-[#080808] text-sm font-semibold hover:bg-[#E6C77A] transition-colors"
              >
                Continue with Google Sign-In
              </button>
            </div>

            {recentlyViewedProjects.length > 0 && (
              <div className="pt-6 border-t border-[#D4AF72]/20 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recently Viewed ({recentlyViewedProjects.length})</span>
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {recentlyViewedProjects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        onSelectProject(proj);
                        onClose();
                      }}
                      className="w-full text-left p-3 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] flex items-center justify-between text-xs"
                    >
                      <span>
                        <strong className="text-[#F5F1E8] block">{proj.name}</strong>
                        <span className="text-[#A5A19A]">
                          {proj.community}, {proj.emirate}
                        </span>
                      </span>
                      <span className="font-mono-tabular text-[#D4AF72] font-semibold">
                        {formatProjectPrice(proj.startingPriceAed, currency, true)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="px-6 border-b border-[#D4AF72]/20 flex flex-wrap items-center gap-6 bg-[#1B1B1B]">
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'favorites'
                    ? 'border-[#D4AF72] text-[#F5F1E8]'
                    : 'border-transparent text-[#A5A19A] hover:text-[#F5F1E8]'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Saved Projects ({savedProjectsList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('recent')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'recent'
                    ? 'border-[#D4AF72] text-[#F5F1E8]'
                    : 'border-transparent text-[#A5A19A] hover:text-[#F5F1E8]'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Recently Viewed ({recentlyViewedProjects.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('searches')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'searches'
                    ? 'border-[#D4AF72] text-[#F5F1E8]'
                    : 'border-transparent text-[#A5A19A] hover:text-[#F5F1E8]'
                }`}
              >
                <Bell className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Saved Searches &amp; Alerts ({savedSearches.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('enquiries')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'enquiries'
                    ? 'border-[#D4AF72] text-[#F5F1E8]'
                    : 'border-transparent text-[#A5A19A] hover:text-[#F5F1E8]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>My Enquiries &amp; Visits ({enquiries.length})</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'favorites' && (
                <div className="space-y-3">
                  {savedProjectsList.length === 0 ? (
                    <p className="text-sm text-[#A5A19A] text-center py-8">
                      You have no saved projects yet. Bookmark any UAE project card to track it
                      here.
                    </p>
                  ) : (
                    savedProjectsList.map((proj) => (
                      <div
                        key={proj.id}
                        className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-[#D4AF72] font-medium">
                            {proj.emirate} · {proj.community}
                          </p>
                          <h4 className="font-display text-lg font-medium text-[#F5F1E8]">
                            {proj.name}
                          </h4>
                          <p className="text-xs font-mono-tabular text-[#A5A19A] mt-0.5">
                            {proj.startingPriceAed > 0
                              ? `From ${formatProjectPrice(proj.startingPriceAed, currency)}`
                              : 'Price on Request'}{' '}
                            ·{' '}
                            {proj.inventory.status === 'verified_live'
                              ? `${proj.inventory.availableUnits} available`
                              : 'Inventory update unavailable'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProject(proj);
                              onClose();
                            }}
                            className="px-3.5 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A]"
                          >
                            Open Dossier
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFavorite(proj.id, proj.name)}
                            aria-label="Remove saved project"
                            className="p-2 border border-[#D4AF72]/25 text-[#A5A19A] hover:text-[#F87171]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'recent' && (
                <div className="space-y-3">
                  {recentlyViewedProjects.length === 0 ? (
                    <p className="text-sm text-[#A5A19A] text-center py-8">
                      Projects you inspect will appear here for swift return access.
                    </p>
                  ) : (
                    recentlyViewedProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-[#D4AF72] font-medium">
                            {proj.emirate} · {proj.community}
                          </p>
                          <h4 className="font-display text-lg font-medium text-[#F5F1E8]">
                            {proj.name}
                          </h4>
                          <p className="text-xs font-mono-tabular text-[#A5A19A] mt-0.5">
                            {proj.startingPriceAed > 0
                              ? `From ${formatProjectPrice(proj.startingPriceAed, currency)}`
                              : 'Price on Request'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProject(proj);
                            onClose();
                          }}
                          className="px-3.5 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A]"
                        >
                          Reopen Dossier
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'searches' && (
                <div className="space-y-3">
                  {savedSearches.length === 0 ? (
                    <p className="text-sm text-[#A5A19A] text-center py-8">
                      No saved searches yet. Click &ldquo;Save Search &amp; Alerts&rdquo; in the
                      search bar to monitor price and availability changes.
                    </p>
                  ) : (
                    savedSearches.map((s) => (
                      <div
                        key={s.id}
                        className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#F5F1E8]">{s.title}</p>
                          <p className="text-xs text-[#A5A19A] mt-0.5">
                            Emirate: {s.emirate || 'All'} · Type: {s.propertyType || 'All'} ·{' '}
                            {s.alertsEnabled
                              ? 'Availability & Price Alerts Active'
                              : 'Alerts Paused'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onApplySavedSearch(s);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold flex items-center gap-1"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Run Search</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSavedSearch(s.id)}
                            className="p-2 border border-[#D4AF72]/25 text-[#A5A19A] hover:text-[#F87171]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'enquiries' && (
                <div className="space-y-3">
                  {enquiries.length === 0 ? (
                    <p className="text-sm text-[#A5A19A] text-center py-8">
                      You have not submitted any enquiries or visit requests while signed in.
                    </p>
                  ) : (
                    enquiries.map((enq) => (
                      <div key={enq.id} className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase text-[#D4AF72]">
                            {enq.enquiryType.replace('_', ' ')} · Status: {enq.status}
                          </span>
                          <span className="text-xs font-mono-tabular text-[#A5A19A]">
                            {new Date(enq.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-[#F5F1E8] mt-1">
                          {enq.projectName || 'General UAE Advisory'}
                        </h4>
                        {enq.assignedAgentName && (
                          <p className="text-xs text-[#6EE7B7] mt-1">
                            Assigned Specialist: {enq.assignedAgentName}
                          </p>
                        )}
                        {enq.message && (
                          <p className="text-xs text-[#A5A19A] mt-1">{enq.message}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
