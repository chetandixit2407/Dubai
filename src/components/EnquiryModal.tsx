import React, { useState } from 'react';
import { CheckCircle2, MessageCircle, X } from 'lucide-react';
import { EnquiryType, Project } from '../types/realEstate.ts';
import { submitEnquiry } from '../services/firestoreService.ts';
import { notifyPublicEnquiryCreated } from '../services/apiClient.ts';
import { COMPANY_INFO } from '../data/companyInfo.ts';

interface EnquiryModalProps {
  initialType?: EnquiryType;
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
  project,
  currentUser,
  onClose,
}) => {
  const [enquiryType, setEnquiryType] = useState<EnquiryType>(initialType);
  const [fullName, setFullName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [budgetAed, setBudgetAed] = useState<string>(
    project ? String(project.startingPriceAed) : '2500000'
  );
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError('Please enter your full name and valid email address.');
      return;
    }

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
        message: message.trim(),
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

  const whatsappText = encodeURIComponent(
    `Hello WHITE COLLAR REALTY Advisory Desk, I am enquiring about ${
      project
        ? `${project.name} (${project.community}, ${project.emirate})`
        : 'UAE Real Estate Opportunities'
    }. Name: ${fullName || 'Investor'}`
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] text-[#F5F1E8] border border-[#D4AF72]/35 w-full max-w-xl p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Enquiry Modal"
          className="absolute top-4 right-4 w-9 h-9 bg-[#1B1B1B] border border-[#D4AF72]/25 flex items-center justify-center hover:border-[#D4AF72] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
          WHITE COLLAR REALTY Private Advisory
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F5F1E8] mt-1">
          {ENQUIRY_LABELS[enquiryType]}
        </h2>
        {project && (
          <p className="text-xs text-[#A5A19A] mt-1">
            Project: <strong className="text-[#F5F1E8]">{project.name}</strong> ·{' '}
            {project.emirate}
          </p>
        )}

        {submitted ? (
          <div className="mt-6 border border-[#D4AF72]/25 bg-[#1B1B1B] p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#6EE7B7] font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Enquiry Registered in White Collar Realty CRM</span>
            </div>
            <p className="text-sm text-[#A5A19A] leading-relaxed">
              Your request has been logged and assigned for review by a RERA-certified specialist.
              {enquiryType === 'brochure' && project && (
                <span> You can open or save the official project dossier below.</span>
              )}
            </p>
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
                  Phone / WhatsApp (+91 / +971...)
                </label>
                <input
                  type="tel"
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <a
                href={COMPANY_INFO.whatsappDeskUrl(whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#6EE7B7] hover:underline flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Direct WhatsApp ({COMPANY_INFO.phone})</span>
              </a>

              <div className="flex items-center gap-2">
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
                  className="px-6 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Enquiry'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
