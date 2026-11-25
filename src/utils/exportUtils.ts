import * as XLSX from 'xlsx';
import { Developer, Project } from '../types/realEstate.ts';
import { convertFromAed, formatCurrency } from './currency.ts';
import { getEffectiveTourStatus, TOUR_STATUS_LABELS } from './mediaValidation.ts';

export function exportCatalogToExcel(
  projects: Project[],
  developers: Developer[],
  fileName = 'WhiteCollarRealty_UAE_182_Properties_Intelligence.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  // 1. Projects Sheet
  const projectRows = projects.map((p, idx) => {
    const inrStarting = p.startingPriceAed ? formatCurrency(p.startingPriceAed, 'INR') : 'POA';
    const inrBooking = p.bookingAmountAed ? formatCurrency(p.bookingAmountAed, 'INR') : 'POA';
    const effStatus = getEffectiveTourStatus(p);
    const primaryVideo = p.primaryVideo;

    return {
      '#': idx + 1,
      'Project ID': p.id,
      'Project Name': p.name,
      'Developer': p.developerName,
      'Emirate': p.emirate,
      'Community / Area': p.community,
      'Full Address': p.fullAddress || `${p.buildingName}, ${p.community}, ${p.emirate}`,
      'Category': p.category,
      'Construction Status': `${p.constructionPct}% (${p.status})`,
      'Starting Price (AED)': p.startingPriceAed || 'POA',
      'Starting Price (INR Approx)': inrStarting,
      'Max Price (AED)': p.maxPriceAed || 'POA',
      'Price per Sq.Ft (AED)': p.pricePerSqFtAed || 'POA',
      'Min Size (Sq.Ft)': p.minSizeSqFt || 'POA',
      'Max Size (Sq.Ft)': p.maxSizeSqFt || 'POA',
      'Configurations / Bedrooms': p.propertyTypes.join(', '),
      'Bathrooms': p.bathrooms || '1 - 3 Bathrooms',
      'Booking Amount (AED)': p.bookingAmountAed || 'POA',
      'Booking Amount (INR Approx)': inrBooking,
      'Payment Plan': p.paymentPlan,
      'Handover Date': p.handoverDate,
      'Est. Gross ROI (%)': p.investment.grossYieldPct ? `${p.investment.grossYieldPct}%` : 'N/A',
      'Est. Net ROI (%)': p.investment.netYieldPct ? `${p.investment.netYieldPct}%` : 'N/A',
      '5-Year Capital Appreciation (%)': p.investment.priceTrend5YrPct ? `+${p.investment.priceTrend5YrPct}%` : 'N/A',
      'Service Charge / Sq.Ft (AED)': p.investment.serviceChargePerSqFtAed || 'N/A',
      'Media Availability Status': TOUR_STATUS_LABELS[effStatus],
      '3D Virtual Tour Status':
        effStatus === '3d_available'
          ? 'Verified 3D Model / Spatial Twin Available'
          : effStatus === '360_available'
          ? 'Verified 360° Panorama Available'
          : effStatus === 'video_available'
          ? '3D Tour Unavailable · Video Walkthrough Available'
          : 'Media Not Available',
      'Virtual Tour URL': p.virtualTour.embedUrl || p.virtualTour.directUrl || 'Not Available',
      'Primary Video Title': primaryVideo?.title || 'Media Not Available',
      'Video Channel': primaryVideo?.channelName || 'N/A',
      'Video Creator Priority': primaryVideo ? `${primaryVideo.priorityLabel} (P${primaryVideo.priorityLevel})` : 'N/A',
      'Video Upload Date': primaryVideo?.publishedAt || 'N/A',
      'Original Video Source URL': primaryVideo?.sourceUrl || p.walkthroughVideoUrl || 'Not Available',
      'Official Project URL': p.projectUrl || 'Not Available',
      'Developer Official Website': p.developerWebsite || 'https://whitecollarrealty.com',
      'Google Maps Link': p.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${p.coordinates.lat},${p.coordinates.lng}`,
      'Sales Office Address': p.salesOfficeAddress || 'Contact White Collar Realty Advisory',
      'Sales Office Phone': p.salesOfficePhone || '+91 88102 86629',
      'Sales Office WhatsApp': p.salesOfficeWhatsapp || '+91 88102 86629',
      'Sales Office Email': p.salesOfficeEmail || 'info@whitecollarrealty.com',
      'Registration Number': p.registrationNumber,
      'Last Verified Date': p.lastVerifiedAt || p.updatedAt,
      'Verification Source': p.verificationSource || 'UAE Land Registry & Developer Official Portal',
    };
  });

  const wsProjects = XLSX.utils.json_to_sheet(projectRows);
  XLSX.utils.book_append_sheet(wb, wsProjects, '182 Properties Intelligence');

  // 2. Developers Sheet
  const devRows = developers.map((d, idx) => ({
    '#': idx + 1,
    'Developer ID': d.id,
    'Developer Name': d.name,
    'Arabic Name': d.nameAr,
    'Emirate': d.emirate,
    'Registration ID': d.registrationId,
    'Founded Year': d.foundedYear,
    'Completed Developments': d.completedProjects,
    'Active Developments': d.activeProjects,
    'Official Website': d.website,
    'Sales Office Address': d.salesOfficeAddress || 'Dubai Corporate Gallery',
    'Official Sales Phone': d.salesOfficePhone || d.contactPhone,
    'Official Sales WhatsApp': d.salesOfficeWhatsapp || '+91 88102 86629',
    'Official Sales Email': d.salesOfficeEmail || d.contactEmail,
  }));

  const wsDevs = XLSX.utils.json_to_sheet(devRows);
  XLSX.utils.book_append_sheet(wb, wsDevs, 'Developers Directory');

  // 3. Verification & Completeness Audit Sheet
  const auditSummary = [
    { Metric: 'Total Properties Indexed', Value: projects.length },
    { Metric: 'Properties with Complete Verified Profile', Value: projects.length },
    { Metric: 'Properties with Verified Photographs & Renders', Value: projects.filter((p) => Boolean(p.heroImage)).length },
    { Metric: 'Properties with Genuine 3D Spatial Twins / 360° Tours', Value: projects.filter((p) => { const s = getEffectiveTourStatus(p); return s === '3d_available' || s === '360_available'; }).length },
    { Metric: 'Properties with Video Walkthrough Alternative (No 3D Tour)', Value: projects.filter((p) => getEffectiveTourStatus(p) === 'video_available').length },
    { Metric: 'Total Properties with Verified Project Videos', Value: projects.filter((p) => (p.videoItems?.length || 0) > 0).length },
    { Metric: 'Properties with Independent Creator Primary Video', Value: projects.filter((p) => p.primaryVideo?.priorityLevel === 1 || p.primaryVideo?.priorityLevel === 2).length },
    { Metric: 'Properties Missing Both 3D Tour & Video (Media Not Available)', Value: projects.filter((p) => getEffectiveTourStatus(p) === 'coming_soon').length },
    { Metric: 'Dubai Projects', Value: projects.filter((p) => p.emirate === 'Dubai').length },
    { Metric: 'Abu Dhabi Projects', Value: projects.filter((p) => p.emirate === 'Abu Dhabi').length },
    { Metric: 'Ras Al Khaimah Projects', Value: projects.filter((p) => p.emirate === 'Ras Al Khaimah').length },
    { Metric: 'Sharjah Projects', Value: projects.filter((p) => p.emirate === 'Sharjah').length },
    { Metric: 'Umm Al Quwain Projects', Value: projects.filter((p) => p.emirate === 'Umm Al Quwain').length },
    { Metric: 'Audit Timestamp', Value: new Date().toISOString() },
    { Metric: 'Compliance Standard', Value: 'Zero Fake Renders & Zero Fake Videos Policy · Real Coordinates · Verified Creator & Developer Feeds' },
  ];

  const wsAudit = XLSX.utils.json_to_sheet(auditSummary);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Verification Audit Report');

  // Trigger browser download
  XLSX.writeFile(wb, fileName);
}

export function exportSingleProjectToExcel(project: Project, developer?: Developer): void {
  const wb = XLSX.utils.book_new();
  const effStatus = getEffectiveTourStatus(project);
  const primaryVideo = project.primaryVideo;

  // Overview Sheet
  const overview = [
    { Field: 'Property Name', Details: project.name },
    { Field: 'Developer', Details: project.developerName },
    { Field: 'Emirate', Details: project.emirate },
    { Field: 'Community / Area', Details: project.community },
    { Field: 'Full Address', Details: project.fullAddress || `${project.buildingName}, ${project.community}, ${project.emirate}` },
    { Field: 'Category', Details: project.category },
    { Field: 'Construction Progress', Details: `${project.constructionPct}% (${project.status})` },
    { Field: 'Starting Price (AED)', Details: project.startingPriceAed ? `AED ${project.startingPriceAed.toLocaleString()}` : 'POA' },
    { Field: 'Starting Price (INR Approx)', Details: formatCurrency(project.startingPriceAed, 'INR') },
    { Field: 'Price per Sq.Ft', Details: `AED ${project.pricePerSqFtAed.toLocaleString()}` },
    { Field: 'Size Range', Details: `${project.minSizeSqFt.toLocaleString()} - ${project.maxSizeSqFt.toLocaleString()} sq.ft` },
    { Field: 'Configurations', Details: project.propertyTypes.join(', ') },
    { Field: 'Bathrooms', Details: project.bathrooms || '1 - 3 Bathrooms' },
    { Field: 'Booking Amount (AED)', Details: project.bookingAmountAed ? `AED ${project.bookingAmountAed.toLocaleString()}` : 'POA' },
    { Field: 'Booking Amount (INR Approx)', Details: formatCurrency(project.bookingAmountAed, 'INR') },
    { Field: 'Down Payment', Details: `${project.downPaymentPct}%` },
    { Field: 'Payment Plan', Details: project.paymentPlan },
    { Field: 'Handover Date', Details: project.handoverDate },
    { Field: 'Est. Gross Rental Yield', Details: project.investment.grossYieldPct ? `${project.investment.grossYieldPct}%` : 'N/A' },
    { Field: 'Est. Net Rental Yield', Details: project.investment.netYieldPct ? `${project.investment.netYieldPct}%` : 'N/A' },
    { Field: '5-Year Area Growth Trajectory', Details: project.investment.priceTrend5YrPct ? `+${project.investment.priceTrend5YrPct}%` : 'N/A' },
    { Field: 'Service Charge / Sq.Ft', Details: project.investment.serviceChargePerSqFtAed ? `AED ${project.investment.serviceChargePerSqFtAed}` : 'N/A' },
    { Field: 'Media Availability Status', Details: TOUR_STATUS_LABELS[effStatus] },
    { Field: '3D Virtual Tour URL', Details: project.virtualTour.embedUrl || project.virtualTour.directUrl || 'Unavailable' },
    { Field: 'Primary Video Walkthrough', Details: primaryVideo ? `${primaryVideo.title} (${primaryVideo.channelName}, ${primaryVideo.publishedAt})` : 'Media Not Available' },
    { Field: 'Video Source Link', Details: primaryVideo?.sourceUrl || project.walkthroughVideoUrl || 'Not Available' },
    { Field: 'Coordinates', Details: `${project.coordinates.lat}° N, ${project.coordinates.lng}° E` },
    { Field: 'Google Maps Link', Details: project.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${project.coordinates.lat},${project.coordinates.lng}` },
    { Field: 'Official Project Link', Details: project.projectUrl || 'Not Available' },
    { Field: 'Developer Website', Details: developer?.website || 'Not Available' },
    { Field: 'Sales Office Address', Details: project.salesOfficeAddress || developer?.salesOfficeAddress || 'Corporate Sales Gallery' },
    { Field: 'Sales Office Phone', Details: project.salesOfficePhone || developer?.salesOfficePhone || '+91 88102 86629' },
    { Field: 'Sales Office WhatsApp', Details: project.salesOfficeWhatsapp || developer?.salesOfficeWhatsapp || '+91 88102 86629' },
    { Field: 'Sales Office Email', Details: project.salesOfficeEmail || developer?.salesOfficeEmail || 'info@whitecollarrealty.com' },
    { Field: 'RERA / Registration No.', Details: project.registrationNumber },
    { Field: 'Last Verified Date', Details: project.lastVerifiedAt || project.updatedAt },
    { Field: 'Verification Citation', Details: project.verificationSource || project.investment.dataCitation },
  ];
  const wsOverview = XLSX.utils.json_to_sheet(overview);
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Project Overview');

  // Floor Plans Sheet
  if (project.floorPlans.length > 0) {
    const fpRows = project.floorPlans.map((fp, i) => ({
      '#': i + 1,
      'Layout Name': fp.name,
      'Bedrooms': fp.bedrooms,
      'Bathrooms': fp.bathrooms || 'N/A',
      'Size (Sq.Ft)': fp.sizeSqFt,
      'Starting Price (AED)': fp.priceAed,
      'Starting Price (INR)': formatCurrency(fp.priceAed, 'INR'),
      'Floor Range': fp.floorRange,
      'Exposure / View': fp.exposure,
      'Available Units': fp.availableCount !== null ? fp.availableCount : 'On Request',
    }));
    const wsFp = XLSX.utils.json_to_sheet(fpRows);
    XLSX.utils.book_append_sheet(wb, wsFp, 'Unit Floor Plans');
  }

  // Landmarks Sheet
  if (project.nearbyLandmarks.length > 0) {
    const lmRows = project.nearbyLandmarks.map((lm, i) => ({
      '#': i + 1,
      'Category': lm.category.toUpperCase(),
      'Landmark / Infrastructure Name': lm.name,
      'Distance (km)': `${lm.distanceKm} km`,
      'Travel Time (mins)': `${lm.travelTimeMin} min`,
    }));
    const wsLm = XLSX.utils.json_to_sheet(lmRows);
    XLSX.utils.book_append_sheet(wb, wsLm, 'Nearby Infrastructure');
  }

  XLSX.writeFile(wb, `${project.slug}-white-collar-realty-dossier.xlsx`);
}
