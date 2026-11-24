import React, { useState } from 'react';
import { Bell, Bookmark, LogOut, MessageSquare, Search, Trash2, User, X } from 'lucide-react';
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
  onClose: () => void;
}

export const CustomerPortalModal: React.FC<CustomerPortalModalProps> = ({
  userProfile,
  projects,
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
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'favorites' | 'searches' | 'enquiries'>('favorites');

  const savedProjectsList = projects.filter((p) =>
    favorites.some((f) => f.projectId === p.id)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5E2DC] w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#E5E2DC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-[#9A7B3C]" />
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#111827]">
                Client Intelligence Portal
              </h2>
              {userProfile && (
                <p className="text-xs text-[#4B5563]">
                  {userProfile.displayName} · {userProfile.email} · Role: {userProfile.role}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userProfile && (
              <button
                type="button"
                onClick={onSignOut}
                className="h-9 px-3 border border-[#E5E2DC] text-xs font-medium text-[#4B5563] hover:text-[#111827] flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Client Portal"
              className="w-9 h-9 border border-[#E5E2DC] flex items-center justify-center hover:border-[#9A7B3C]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!userProfile ? (
          <div className="p-10 text-center max-w-md mx-auto">
            <h3 className="font-display text-2xl font-semibold text-[#111827] mb-2">
              Sign in to access your UAE Portfolio
            </h3>
            <p className="text-sm text-[#4B5563] mb-6 leading-relaxed">
              Save favourite developments, subscribe to live unit availability and price change alerts, and track property viewings and enquiries.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="px-6 py-3 bg-[#111827] text-white text-sm font-medium hover:bg-[#9A7B3C] transition-colors"
            >
              Continue with Google Sign-In
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 border-b border-[#E5E2DC] flex items-center gap-6 bg-[#FAF9F6]">
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'favorites'
                    ? 'border-[#9A7B3C] text-[#111827]'
                    : 'border-transparent text-[#6B7280]'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved Projects ({savedProjectsList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('searches')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'searches'
                    ? 'border-[#9A7B3C] text-[#111827]'
                    : 'border-transparent text-[#6B7280]'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Saved Searches & Alerts ({savedSearches.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('enquiries')}
                className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'enquiries'
                    ? 'border-[#9A7B3C] text-[#111827]'
                    : 'border-transparent text-[#6B7280]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>My Enquiries & Visits ({enquiries.length})</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'favorites' && (
                <div className="space-y-3">
                  {savedProjectsList.length === 0 ? (
                    <p className="text-sm text-[#6B7280] text-center py-8">
                      You have no saved projects yet. Bookmark any UAE project card to track it here.
                    </p>
                  ) : (
                    savedProjectsList.map((proj) => (
                      <div
                        key={proj.id}
                        className="border border-[#E5E2DC] p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-[#9A7B3C] font-medium">
                            {proj.emirate} · {proj.community}
                          </p>
                          <h4 className="font-display text-lg font-semibold text-[#111827]">
                            {proj.name}
                          </h4>
                          <p className="text-xs font-mono-tabular text-[#4B5563] mt-0.5">
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
                            className="px-3.5 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
                          >
                            Open Dossier
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFavorite(proj.id, proj.name)}
                            aria-label="Remove saved project"
                            className="p-2 border border-[#E5E2DC] text-[#6B7280] hover:text-[#B91C1C]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'searches' && (
                <div className="space-y-3">
                  {savedSearches.length === 0 ? (
                    <p className="text-sm text-[#6B7280] text-center py-8">
                      No saved searches yet. Click &ldquo;Save Search & Alerts&rdquo; in the search bar to monitor price and availability changes.
                    </p>
                  ) : (
                    savedSearches.map((s) => (
                      <div
                        key={s.id}
                        className="border border-[#E5E2DC] p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{s.title}</p>
                          <p className="text-xs text-[#4B5563] mt-0.5">
                            Emirate: {s.emirate || 'All'} · Type: {s.propertyType || 'All'} ·{' '}
                            {s.alertsEnabled ? 'Availability & Price Alerts Active' : 'Alerts Paused'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onApplySavedSearch(s);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-[#111827] text-white text-xs font-medium flex items-center gap-1"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Run Search</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSavedSearch(s.id)}
                            className="p-2 border border-[#E5E2DC] text-[#6B7280] hover:text-[#B91C1C]"
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
                    <p className="text-sm text-[#6B7280] text-center py-8">
                      You have not submitted any enquiries or visit requests while signed in.
                    </p>
                  ) : (
                    enquiries.map((enq) => (
                      <div key={enq.id} className="border border-[#E5E2DC] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase text-[#9A7B3C]">
                            {enq.enquiryType.replace('_', ' ')} · Status: {enq.status}
                          </span>
                          <span className="text-xs font-mono-tabular text-[#6B7280]">
                            {new Date(enq.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-[#111827] mt-1">
                          {enq.projectName || 'General UAE Advisory'}
                        </h4>
                        {enq.assignedAgentName && (
                          <p className="text-xs text-[#047857] mt-1">
                            Assigned Specialist: {enq.assignedAgentName}
                          </p>
                        )}
                        {enq.message && <p className="text-xs text-[#4B5563] mt-1">{enq.message}</p>}
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
