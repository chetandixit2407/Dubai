import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, FileSpreadsheet, MessageCircle, Phone, X } from 'lucide-react';
import { EnquiryType, Project } from '../types/realEstate.ts';
import { submitEnquiry } from '../services/firestoreService.ts';
import { notifyPublicEnquiryCreated } from '../services/apiClient.ts';
import { COMPANY_INFO } from '../data/companyInfo.ts';
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';
import { formatFloorPlanAreaSqFt, formatFloorPlanBhk } from '../utils/propertySpecs.ts';

interface EnquiryModalProps {
  initialType?: EnquiryType;
  requestContext?: 'availability_sheet' | null;
  project?: Project | null;
  currentUser?: { uid: string; email?: string | null; displayName?: string | null } | null;
  onClose: () => void;
}

const ENQUIRY_LABELS: Record<EnquiryType, string> = {
  callback: 'Request Immediate Callback',
  whatsapp: 'WhatsApp Advisory Desk',
  visit: 'Schedule Private Property Visit',
  virtual_consultation: 'Request Virtual Consultation',
  investment: 'Submit Institutional Investment Enquiry',
  brochure: 'Download Project Dossier & Floor Plans',
  availability_alert: 'Subscribe to Live Unit & Price Alerts',
};

export const EnquiryModal: React.FC<EnquiryModalProps> = ({
  initialType = 'callback',
  requestContext = null,
  project,
  currentUser,
  onClose,
}) => {
  const isAvailabilitySheet = requestContext === 'availability_sheet';
  const [enquiryType, setEnquiryType] = useState<EnquiryType>(
    isAvailabilitySheet ? 'availability_alert' : initialType
  );
  const [preferredConfig, setPreferredConfig] = useState<string>('All Available Unit Types');
  const [fullName, setFullName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [budgetAed, setBudgetAed] = useState<string>(
    project && project.startingPriceAed > 0 ? String(project.startingPriceAed) : '2500000'
  );
  const [message, setMessage] = useState(() => {
    if (isAvailabilitySheet && project) {
      return `Please send the verified developer availability sheet, unit-by-unit price list, and current payment plan for ${project.name} (${project.community}, ${project.emirate}).`;
    }
    return '';
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAvailabilitySheet && project) {
      setEnquiryType('availability_alert');
    }
  }, [isAvailabilitySheet, project]);

  const configOptions = React.useMemo(() => {
    if (!project) return [];
    const options = new Set<string>(['All Available Unit Types']);
    for (const pt of project.propertyTypes || []) {
      if (pt) options.add(pt);
    }
    for (const fp of project.floorPlans || []) {
      const bhk = formatFloorPlanBhk(fp.bedrooms);
      const area = formatFloorPlanAreaSqFt(fp.sizeSqFt);
      const label = bhk !== 'Not Available' ? bhk : fp.bedrooms || fp.name;
      if (label) options.add(`${label} (${area})`);
    }
    return Array.from(options);
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError('Please enter your full name and valid email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (isAvailabilitySheet && !phone.trim()) {
      setError('Please enter a phone or WhatsApp number to receive the developer availability sheet.');
      return;
    }

    const compiledMessage = isAvailabilitySheet
      ? `[Verified Developer Availability Sheet Request] Config: ${preferredConfig}. ${message.trim()}`
      : message.trim();

    setSubmitting(true);
    try {
      await submitEnquiry({
        ...(currentUser?.uid ? { userId: currentUser.uid } : {}),
        ...(project?.id ? { projectId: project.id } : {}),
        ...(project?.name ? { projectName: project.name } : {}),
        enquiryType,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        preferredDate: preferredDate.trim(),
        budgetAed: Number(budgetAed) || undefined,
        message: compiledMessage.slice(0, 1950),
      });
      await notifyPublicEnquiryCreated(enquiryType, project?.name);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to submit enquiry. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappText = isAvailabilitySheet && project
    ? `Hello WHITE COLLAR REALTY Desk, I have submitted a request for the Verified Developer Availability Sheet for ${project.name} (${project.community}, ${project.emirate}). Configuration: ${preferredConfig}. Name: ${fullName || 'Client'}`
    : `Hello WHITE COLLAR REALTY Advisory Desk, I am enquiring about ${
        project
          ? `${project.name} (${project.community}, ${project.emirate})`
          : 'UAE Real Estate Opportunities'
      }. Name: ${fullName || 'Investor'}`;

  const lastCheckedDate = project?.inventory?.lastUpdatedAt || project?.lastVerifiedAt || project?.updatedAt;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-[#121212] text-[#F5F1E8] border border-[#D4AF72]/35 w-full max-w-xl p-4 sm:p-6 lg:p-8 relative max-h-[92dvh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Enquiry Modal"
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-9 h-9 bg-[#1B1B1B] border border-[#D4AF72]/25 flex items-center justify-center hover:border-[#D4AF72] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] pr-11 flex items-center gap-1.5">
          {isAvailabilitySheet && <FileSpreadsheet className="w-3.5 h-3.5" />}
          <span>
            {isAvailabilitySheet
              ? 'Developer Inventory Verification Desk'
              : 'WHITE COLLAR REALTY Private Advisory'}
          </span>
        </p>
        <h2 className="font-display text-xl sm:text-3xl font-medium text-[#F5F1E8] mt-1 pr-11 break-words">
          {isAvailabilitySheet
            ? 'Request Verified Developer Availability Sheet'
            : ENQUIRY_LABELS[enquiryType]}
        </h2>
        {project && (
          <p className="text-xs text-[#A5A19A] mt-1 pr-11 break-words">
            Project: <strong className="text-[#F5F1E8]">{project.name}</strong> ·{' '}
            {project.community}, {project.emirate}
          </p>
        )}

        {isAvailabilitySheet && project && !submitted && (
          <div className="mt-4 bg-[#1B1B1B] border border-[#D4AF72]/25 p-3.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#F5F1E8] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Developer: {project.developerName}</span>
              </span>
              <span className="font-mono-tabular text-[#D4AF72] font-semibold">
                {project.startingPriceAed > 0
                  ? `From ${formatProjectPrice(project.startingPriceAed, 'AED')}`
                  : 'Price on Request'}
              </span>
            </div>
            <p className="text-[#A5A19A] leading-relaxed">
              Live automated unit counts are not exposed publicly by this developer&apos;s feed. Submit this request to receive the latest verified developer availability sheet &amp; unit price list directly via WhatsApp and email.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#D4AF72]/15 text-[11px] text-[#A5A19A]">
              {lastCheckedDate && (
                <span className="flex items-center gap-1 font-mono-tabular">
                  <Clock className="w-3 h-3 text-[#D4AF72]" />
                  <span>Registry Checked: {new Date(lastCheckedDate).toLocaleDateString()}</span>
                </span>
              )}
              {project.salesOfficePhone && (
                <a
                  href={`tel:${project.salesOfficePhone.replace(/\s+/g, '')}`}
                  className="text-[#6EE7B7] font-mono-tabular hover:underline flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  <span>Developer Desk: {project.salesOfficePhone}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {submitted ? (
          <div className="mt-6 border border-[#D4AF72]/25 bg-[#1B1B1B] p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#6EE7B7] font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {isAvailabilitySheet
                  ? 'Availability Sheet Request Dispatched'
                  : 'Enquiry Registered in White Collar Realty CRM'}
              </span>
            </div>
            <p className="text-sm text-[#A5A19A] leading-relaxed">
              {isAvailabilitySheet && project ? (
                <>
                  Your request for the verified developer availability sheet of{' '}
                  <strong className="text-[#F5F1E8]">{project.name}</strong> ({preferredConfig})
                  has been logged with our specialist desk. You can download the baseline project
                  dossier now or request instant unit sheet delivery via WhatsApp.
                </>
              ) : (
                <>
                  Your request has been logged and assigned for review by a RERA-certified
                  specialist.
                  {enquiryType === 'brochure' && project && (
                    <span> You can open or save the official project dossier below.</span>
                  )}
                </>
              )}
            </p>
            {project && project.startingPriceAed > 0 && (
              <p className="text-xs font-mono-tabular text-[#D4AF72]">
                Reference Starting Price: AED {project.startingPriceAed.toLocaleString()} (≈{' '}
                {formatCurrency(project.startingPriceAed, 'INR')})
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {project && (
                <a
                  href={`/api/projects/${encodeURIComponent(project.slug)}/brochure`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A]"
                >
                  Open Printable Dossier
                </a>
              )}
              <a
                href={COMPANY_INFO.whatsappDeskUrl(whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#065F46] text-[#ECFDF5] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#047857]"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Continue on WhatsApp ({COMPANY_INFO.phone})</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#D4AF72]/30 text-xs font-medium text-[#F5F1E8]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {isAvailabilitySheet && configOptions.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                  Preferred Unit Configuration
                </label>
                <select
                  value={preferredConfig}
                  onChange={(e) => setPreferredConfig(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D4AF72]/25 text-sm text-[#F5F1E8] bg-[#1B1B1B] focus:outline-none focus:border-[#D4AF72]"
                >
                  {configOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                  Enquiry Type
                </label>
                <select
                  value={enquiryType}
                  onChange={(e) => setEnquiryType(e.target.value as EnquiryType)}
                  className="w-full h-10 px-3 border border-[#D4AF72]/25 text-sm text-[#F5F1E8] bg-[#1B1B1B] focus:outline-none focus:border-[#D4AF72]"
                >
                  {Object.entries(ENQUIRY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Tariq Al Mansoori"
                  className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                  Phone / WhatsApp {isAvailabilitySheet ? '*' : '(+91 / +971...)'}
                </label>
                <input
                  type="tel"
                  required={isAvailabilitySheet}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 88102 86629 or +971 50 000 0000"
                  className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                  {enquiryType === 'visit' || enquiryType === 'virtual_consultation'
                    ? 'Preferred Date'
                    : 'Target Budget (AED)'}
                </label>
                {enquiryType === 'visit' || enquiryType === 'virtual_consultation' ? (
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                  />
                ) : (
                  <input
                    type="number"
                    value={budgetAed}
                    onChange={(e) => setBudgetAed(e.target.value)}
                    className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Notes or Unit Requirements
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Preferred unit size, floor elevation, Golden Visa eligibility, or payment plan questions..."
                className="w-full p-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>

            {error && <p className="text-xs text-[#F87171] font-medium">{error}</p>}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <a
                href={COMPANY_INFO.whatsappDeskUrl(whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#6EE7B7] hover:underline flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Direct WhatsApp ({COMPANY_INFO.phone})</span>
              </a>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#A5A19A] hover:text-[#F5F1E8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 sm:px-6 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors disabled:opacity-60"
                >
                  {submitting
                    ? 'Submitting...'
                    : isAvailabilitySheet
                    ? 'Request Availability Sheet'
                    : 'Submit Enquiry'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
