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
      setError(err instanceof Error ? err.message : 'Unable to submit enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappText = encodeURIComponent(
    `Hello WHITE COLLAR REALTY Advisory Desk, I am enquiring about ${
      project ? `${project.name} (${project.community}, ${project.emirate})` : 'UAE Real Estate Opportunities'
    }. Name: ${fullName || 'Investor'}`
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5E2DC] w-full max-w-xl p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Enquiry Modal"
          className="absolute top-4 right-4 w-9 h-9 border border-[#E5E2DC] flex items-center justify-center hover:border-[#9A7B3C]"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C]">
          WHITE COLLAR REALTY Advisory Desk
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111827] mt-1">
          {ENQUIRY_LABELS[enquiryType]}
        </h2>
        {project && (
          <p className="text-xs text-[#4B5563] mt-1">
            Project: <strong className="text-[#111827]">{project.name}</strong> · {project.emirate}
          </p>
        )}

        {submitted ? (
          <div className="mt-6 border border-[#E5E2DC] bg-[#FAF9F6] p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#047857] font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Enquiry Registered in White Collar Realty CRM</span>
            </div>
            <p className="text-sm text-[#4B5563] leading-relaxed">
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
                  className="px-4 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
                >
                  Open Printable Dossier
                </a>
              )}
              <a
                href={COMPANY_INFO.whatsappDeskUrl(whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#047857] text-white text-xs font-medium flex items-center gap-1.5 hover:opacity-90"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Continue on WhatsApp ({COMPANY_INFO.phone})</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#E5E2DC] text-xs font-medium text-[#111827]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Enquiry Type
              </label>
              <select
                value={enquiryType}
                onChange={(e) => setEnquiryType(e.target.value as EnquiryType)}
                className="w-full h-10 px-3 border border-[#E5E2DC] text-sm text-[#111827] bg-white focus:outline-none focus:border-[#9A7B3C]"
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
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Tariq Al Mansoori"
                  className="w-full h-10 px-3 border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#9A7B3C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-10 px-3 border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#9A7B3C]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Phone / WhatsApp (+91 / +971...)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 88102 86629 or +971 50 000 0000"
                  className="w-full h-10 px-3 border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#9A7B3C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  {enquiryType === 'visit' || enquiryType === 'virtual_consultation'
                    ? 'Preferred Date'
                    : 'Target Budget (AED)'}
                </label>
                {enquiryType === 'visit' || enquiryType === 'virtual_consultation' ? (
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#9A7B3C]"
                  />
                ) : (
                  <input
                    type="number"
                    value={budgetAed}
                    onChange={(e) => setBudgetAed(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm focus:outline-none focus:border-[#9A7B3C]"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Notes or Unit Requirements
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Preferred unit size, floor elevation, Golden Visa eligibility, or payment plan questions..."
                className="w-full p-3 border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>

            {error && <p className="text-xs text-[#B91C1C] font-medium">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <a
                href={COMPANY_INFO.whatsappDeskUrl(whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#047857] hover:underline flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Direct WhatsApp ({COMPANY_INFO.phone})</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-[#E5E2DC] text-xs font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] transition-colors disabled:opacity-60"
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
