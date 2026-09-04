import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  addDays,
  addMonths,
  calculateCheckoutQuote,
  calculateEarnedPoints,
  cents,
  createEarningEntries,
  createExpirationEntries,
  createManualAdjustmentEntry,
  createRedemptionEntry,
  createReversalEntry,
  defaultRewardProgramConfig,
  dollars as formatCents,
  expirationReminderEntries,
  makeBookingPointsAvailable,
  membershipLevelFromStatus,
  pointsToCreditCents,
  recurringProgress,
  rewardRiskFlags,
  serviceRule,
  summarizeRewardAccount,
  todayISO,
  type CheckoutQuote,
  type EligibleServiceCode,
  type PointStatus,
  type RewardAccountSummary,
  type RewardLedgerEntry,
  type RewardProgramConfig,
  type RewardRiskFlag,
} from './src/rewardsSystem';
import { hasSupabaseConfig } from './lib/supabase';

type Screen = 'home' | 'register' | 'services' | 'rewards' | 'bookings' | 'admin' | 'profile';
type Category = 'Home Care' | 'Move-out' | 'Moving' | 'Pet Care' | 'Perks';
type Filter = Category | 'All';
type MembershipStatus = 'Active' | 'Trial' | 'Past Due' | 'Cancelled' | 'Expired' | 'None';
type VerificationStatus = 'Unverified' | 'Resident Self-Verified' | 'Property Verified' | 'Admin Verified';
type DiscountTreatment = 'FLAIRO absorbs discount' | 'Vendor absorbs discount' | 'Shared discount' | 'Discount offsets FLAIRO commission' | 'Promotional subsidy';
type AdminTab = 'Dashboard' | 'Services' | 'Pricing' | 'Vendors' | 'Bookings' | 'Rewards' | 'Provider' | 'Reports' | 'Audit';

type Community = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  active: boolean;
  plusAvailable: boolean;
  unitFormat: string;
  promotion: string;
};

type Unit = {
  id: string;
  communityId: string;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  verificationStatus: VerificationStatus;
  duplicateReview: boolean;
};

type ResidentProfile = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  communityId: string;
  unit: Unit;
  membershipStatus: MembershipStatus;
};

type PricingTier = {
  label: string;
  bedrooms: number;
  bathrooms: number;
  standardPrice: number;
  plusPrice: number;
  vendorNet: number;
};

type VendorAgreement = {
  id: string;
  vendorName: string;
  paymentConnectionStatus: string;
  standardFlairoFeePercent: number;
  plusFlairoFeePercent: number;
  flatBookingFee: number;
  discountTreatment: DiscountTreatment;
  active: boolean;
  effectiveDate: string;
  notes: string;
};

type Service = {
  id: string;
  rewardCode: EligibleServiceCode;
  title: string;
  subtitle: string;
  category: Category;
  duration: string;
  accent: string;
  detail: string;
  vendorAgreementId: string;
  pricingTiers?: PricingTier[];
  standardPrice?: number;
  plusPrice?: number;
};

type Booking = {
  id: string;
  residentName: string;
  communityName: string;
  unitNumber: string;
  unitConfig: string;
  serviceId: string;
  serviceTitle: string;
  vendorName: string;
  bookingDate: string;
  serviceDate: string;
  membershipStatus: MembershipStatus;
  rewardServiceCode: EligibleServiceCode;
  originalEligibleSubtotal: number;
  standardPrice: number;
  plusPrice: number;
  selectedPrice: number;
  discount: number;
  pointsRedeemed: number;
  finalResidentPayment: number;
  vendorAmount: number;
  grossReferralFee: number;
  creditOffset: number;
  flairoRevenue: number;
  providerRetainedAfterReferral: number;
  earnedBasePoints: number;
  earnedBonusPoints: number;
  earnedRecurringBonus: number;
  earnedTotalPoints: number;
  plusAdditionalPoints: number;
  pointStatus: PointStatus;
  availabilityDate: string;
  completionDate?: string;
  settlementStatus: 'Not started' | 'Unpaid' | 'Paid' | 'Disputed' | 'Offset applied';
  reviewFlags: RewardRiskFlag[];
  paymentStatus: string;
  bookingStatus: string;
  discountTreatment: DiscountTreatment;
};

const fullLogo = require('./assets/flairo-gold-full-logo-web.jpg') as ImageSourcePropType;
const badgeLogo = require('./assets/flairo-logo-black-bg.jpg') as ImageSourcePropType;
const goldIcon = require('./assets/flairo-app-icon-gold.png') as ImageSourcePropType;

const communities: Community[] = [
  {
    id: 'arbor',
    name: 'The Arbor on 7th',
    address: '701 NE 7th Ave',
    city: 'Fort Lauderdale',
    state: 'FL',
    zip: '33304',
    propertyType: 'Multifamily',
    active: true,
    plusAvailable: true,
    unitFormat: 'Building optional + unit, e.g. 4B',
    promotion: 'Launch residents earn 2x points on first Home Care booking.',
  },
  {
    id: 'solara',
    name: 'Solara Midtown',
    address: '1880 Midtown Blvd',
    city: 'Miami',
    state: 'FL',
    zip: '33137',
    propertyType: 'High-rise',
    active: true,
    plusAvailable: false,
    unitFormat: 'Tower + unit, e.g. East 1208',
    promotion: 'Move-in cleaning discount pending.',
  },
];

const knownUnits: Unit[] = [
  {
    id: 'unit-arbor-4b',
    communityId: 'arbor',
    unitNumber: '4B',
    bedrooms: 2,
    bathrooms: 2,
    verificationStatus: 'Property Verified',
    duplicateReview: false,
  },
];

const cleaningPricing: PricingTier[] = [
  { label: 'Studio / 1 bath', bedrooms: 0, bathrooms: 1, standardPrice: 119, plusPrice: 99, vendorNet: 84 },
  { label: '1 bedroom / 1 bath', bedrooms: 1, bathrooms: 1, standardPrice: 145, plusPrice: 119, vendorNet: 102 },
  { label: '2 bedroom / 1 bath', bedrooms: 2, bathrooms: 1, standardPrice: 165, plusPrice: 139, vendorNet: 119 },
  { label: '2 bedroom / 2 bath', bedrooms: 2, bathrooms: 2, standardPrice: 185, plusPrice: 149, vendorNet: 128 },
  { label: '3 bedroom / 2 bath', bedrooms: 3, bathrooms: 2, standardPrice: 225, plusPrice: 189, vendorNet: 162 },
  { label: '3 bedroom / 3 bath', bedrooms: 3, bathrooms: 3, standardPrice: 255, plusPrice: 219, vendorNet: 188 },
  { label: '4+ bedroom', bedrooms: 4, bathrooms: 2, standardPrice: 295, plusPrice: 249, vendorNet: 214 },
];

const vendorAgreements: VendorAgreement[] = [
  {
    id: 'sparkle-agreement',
    vendorName: 'Sparkle & Settle Cleaning Co.',
    paymentConnectionStatus: 'Connected account ready',
    standardFlairoFeePercent: 10,
    plusFlairoFeePercent: 10,
    flatBookingFee: 0,
    discountTreatment: 'Discount offsets FLAIRO commission',
    active: true,
    effectiveDate: '2026-09-01',
    notes: 'Launch agreement. PLUS pricing available at participating communities.',
  },
  {
    id: 'porter-agreement',
    vendorName: 'Porter Preferred Movers',
    paymentConnectionStatus: 'Vendor onboarding pending',
    standardFlairoFeePercent: 10,
    plusFlairoFeePercent: 10,
    flatBookingFee: 0,
    discountTreatment: 'Shared discount',
    active: true,
    effectiveDate: '2026-09-15',
    notes: 'Marketplace payment processor not finalized.',
  },
  {
    id: 'petcare-agreement',
    vendorName: 'Pink Palm Pet Care',
    paymentConnectionStatus: 'Connected account ready',
    standardFlairoFeePercent: 10,
    plusFlairoFeePercent: 10,
    flatBookingFee: 0,
    discountTreatment: 'Vendor absorbs discount',
    active: true,
    effectiveDate: '2026-09-10',
    notes: 'Grooming, walking, and pet-sitter drop-ins. PLUS pricing approved for launch.',
  },
  {
    id: 'homefix-agreement',
    vendorName: 'Hex Key Home Services',
    paymentConnectionStatus: 'Connected account ready',
    standardFlairoFeePercent: 10,
    plusFlairoFeePercent: 10,
    flatBookingFee: 0,
    discountTreatment: 'Shared discount',
    active: true,
    effectiveDate: '2026-09-05',
    notes: 'Handyman, junk-hauling, and light move-out repair work.',
  },
];

const services: Service[] = [
  {
    id: 'occupied-cleaning',
    rewardCode: 'recurring_housekeeping',
    title: 'Recurring housekeeping',
    subtitle: 'Premium recurring cleaning for residents actively living in the apartment.',
    category: 'Home Care',
    duration: '2-4 hrs',
    accent: '#F786C7',
    detail: 'Uses the resident bed/bath profile to display Standard and FLAIRO PLUS pricing automatically.',
    vendorAgreementId: 'sparkle-agreement',
    pricingTiers: cleaningPricing,
  },
  {
    id: 'groomer',
    rewardCode: 'groomer_appointment',
    title: 'Groomer appointment',
    subtitle: 'In-building pet grooming with preferred resident appointment windows.',
    category: 'Pet Care',
    duration: '60-90 min',
    accent: '#E8A7BA',
    detail: 'Provider-funded PLUS pricing and service-completion bonus for eligible grooming appointments.',
    vendorAgreementId: 'petcare-agreement',
    standardPrice: 95,
    plusPrice: 85,
  },
  {
    id: 'dog-walking',
    rewardCode: 'dog_walking',
    title: 'Dog-walking appointment',
    subtitle: 'Scheduled walks for busy resident days and recurring pet routines.',
    category: 'Pet Care',
    duration: '30 min',
    accent: '#D4AF37',
    detail: 'Recurring-eligible service that can count toward loyalty milestones when completed.',
    vendorAgreementId: 'petcare-agreement',
    standardPrice: 28,
    plusPrice: 24,
  },
  {
    id: 'pet-sitter',
    rewardCode: 'pet_sitter_drop_in',
    title: 'Pet-sitter drop-in',
    subtitle: 'Quick feeding, medication, litter, and comfort checks while residents are away.',
    category: 'Pet Care',
    duration: '25 min',
    accent: '#F786C7',
    detail: 'Recurring-eligible drop-ins with PLUS member pricing for participating communities.',
    vendorAgreementId: 'petcare-agreement',
    standardPrice: 32,
    plusPrice: 27,
  },
  {
    id: 'moveout-cleaning',
    rewardCode: 'move_out_cleaning',
    title: 'Move-out cleaning',
    subtitle: 'Deposit-minded final clean before keys are returned.',
    category: 'Move-out',
    duration: '2-5 hrs',
    accent: '#E8A7BA',
    detail: 'Final polish for kitchens, baths, floors, appliances, and inspection prep.',
    vendorAgreementId: 'sparkle-agreement',
    standardPrice: 185,
    plusPrice: 149,
  },
  {
    id: 'moveout-deep-cleaning',
    rewardCode: 'move_out_deep_cleaning',
    title: 'Move-out deep cleaning',
    subtitle: 'Heavier cleaning for appliance interiors, grout, baseboards, and tough turnover areas.',
    category: 'Move-out',
    duration: '4-7 hrs',
    accent: '#D4AF37',
    detail: 'Eligible subtotal, reward credits, and referral fee are preserved separately at checkout.',
    vendorAgreementId: 'sparkle-agreement',
    standardPrice: 245,
    plusPrice: 215,
  },
  {
    id: 'touch-up-painting',
    rewardCode: 'move_out_touch_up_painting',
    title: 'Move-out touch-up painting',
    subtitle: 'Patch small holes, color-match paint, and refresh high-touch walls.',
    category: 'Move-out',
    duration: 'Same week',
    accent: '#D4AF37',
    detail: 'Estimate-led service for paint, supplies, access, and scheduling.',
    vendorAgreementId: 'homefix-agreement',
    standardPrice: 225,
    plusPrice: 195,
  },
  {
    id: 'full-painting',
    rewardCode: 'move_out_full_painting',
    title: 'Move-out full painting',
    subtitle: 'Full repaint coordination for larger turnover or lease-close projects.',
    category: 'Move-out',
    duration: '1-2 days',
    accent: '#F0D58A',
    detail: 'Higher bonus category with admin review flags for unusual redemption or dispute patterns.',
    vendorAgreementId: 'homefix-agreement',
    standardPrice: 650,
    plusPrice: 595,
  },
  {
    id: 'movers',
    rewardCode: 'moving_service',
    title: 'Preferred movers',
    subtitle: 'Vetted moving partners with renter-only pricing windows.',
    category: 'Moving',
    duration: '3 quotes',
    accent: '#F786C7',
    detail: 'Resident-to-vendor marketplace flow for labor-only and full-service moves.',
    vendorAgreementId: 'porter-agreement',
    standardPrice: 325,
    plusPrice: 299,
  },
  {
    id: 'handyman',
    rewardCode: 'handyman_work',
    title: 'Handyman work',
    subtitle: 'Small repairs, mounting help, furniture fixes, and resident maintenance extras.',
    category: 'Home Care',
    duration: '90 min',
    accent: '#D4AF37',
    detail: 'Shared-discount service with completion verification before points become available.',
    vendorAgreementId: 'homefix-agreement',
    standardPrice: 125,
    plusPrice: 110,
  },
  {
    id: 'junk-hauling',
    rewardCode: 'junk_hauling',
    title: 'Junk-hauling service',
    subtitle: 'Furniture, boxes, bulk trash, and post-move disposal help.',
    category: 'Home Care',
    duration: 'Same week',
    accent: '#E8A7BA',
    detail: 'Settlement reporting tracks resident credit, provider remittance, and FLAIRO fee offset.',
    vendorAgreementId: 'homefix-agreement',
    standardPrice: 165,
    plusPrice: 145,
  },
];

const filters: Filter[] = ['All', 'Home Care', 'Move-out', 'Moving', 'Pet Care', 'Perks'];
const adminTabs: AdminTab[] = ['Dashboard', 'Services', 'Pricing', 'Vendors', 'Bookings', 'Rewards', 'Provider', 'Reports', 'Audit'];

const navItems: Array<{ key: Screen; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'register', label: 'Join' },
  { key: 'services', label: 'Care' },
  { key: 'rewards', label: 'Wallet' },
  { key: 'bookings', label: 'Activity' },
  { key: 'admin', label: 'Admin' },
];

const initialRewards: RewardLedgerEntry[] = [
  {
    id: 'launch-bonus',
    residentId: 'demo-resident',
    type: 'manual_adjustment',
    direction: 'credit',
    status: 'available',
    points: 1250,
    reason: 'Launch wallet bonus',
    source: 'admin_adjustment',
    createdAt: '2026-08-26',
    availableAt: '2026-08-26',
    expiresAt: '2028-02-26',
    adminId: 'system',
  },
];

const money = (value: number) => `$${value.toFixed(0)}`;
const unitKey = (bedrooms: number, bathrooms: number) => `${bedrooms}-${bathrooms}`;
const isPlusEligible = (status: MembershipStatus) => status === 'Active' || status === 'Trial';

function findCommunity(id: string) {
  return communities.find((community) => community.id === id) ?? communities[0];
}

function getAgreement(service: Service) {
  return vendorAgreements.find((agreement) => agreement.id === service.vendorAgreementId) ?? vendorAgreements[0];
}

function getPricing(service: Service, resident: ResidentProfile | null) {
  if (service.pricingTiers && resident) {
    const exact = service.pricingTiers.find(
      (tier) => tier.bedrooms === resident.unit.bedrooms && tier.bathrooms === resident.unit.bathrooms,
    );
    if (exact) return exact;

    const fallback = service.pricingTiers[service.pricingTiers.length - 1];
    const bathroomSurcharge = Math.max(resident.unit.bathrooms - fallback.bathrooms, 0) * 25;
    return {
      ...fallback,
      label: `${resident.unit.bedrooms}+ bedroom custom`,
      standardPrice: fallback.standardPrice + bathroomSurcharge,
      plusPrice: fallback.plusPrice + bathroomSurcharge,
      vendorNet: fallback.vendorNet + bathroomSurcharge,
    };
  }

  return {
    label: resident ? `${resident.unit.bedrooms}BR / ${resident.unit.bathrooms}BA` : 'Resident profile required',
    bedrooms: resident?.unit.bedrooms ?? 1,
    bathrooms: resident?.unit.bathrooms ?? 1,
    standardPrice: service.standardPrice ?? 0,
    plusPrice: service.plusPrice ?? service.standardPrice ?? 0,
    vendorNet: Math.max((service.plusPrice ?? service.standardPrice ?? 0) * 0.82, 0),
  };
}

function createSettlementBooking({
  checkout,
  completedRecurringCountIncludingThis,
  rewardConfig,
  resident,
  service,
}: {
  checkout: CheckoutQuote;
  completedRecurringCountIncludingThis: number;
  rewardConfig: RewardProgramConfig;
  resident: ResidentProfile;
  service: Service;
}): Booking {
  const community = findCommunity(resident.communityId);
  const pricing = getPricing(service, resident);
  const agreement = getAgreement(service);
  const plusEligible = isPlusEligible(resident.membershipStatus);
  const selectedPrice = plusEligible ? pricing.plusPrice : pricing.standardPrice;
  const membershipLevel = membershipLevelFromStatus(resident.membershipStatus);
  const earned = calculateEarnedPoints({
    completedRecurringCountIncludingThis,
    config: rewardConfig,
    eligibleSubtotalCents: checkout.originalServicePriceCents,
    membershipLevel,
    serviceCode: service.rewardCode,
  });
  const completionFlags = rewardRiskFlags({
    alreadyCompletedBookingIds: [],
    checkout,
    eligibleService: serviceRule(service.rewardCode, rewardConfig).active,
  });

  return {
    id: `BK-${Date.now().toString().slice(-6)}`,
    residentName: `${resident.firstName} ${resident.lastName}`,
    communityName: community.name,
    unitNumber: resident.unit.unitNumber,
    unitConfig: `${resident.unit.bedrooms}BR / ${resident.unit.bathrooms}BA`,
    serviceId: service.id,
    serviceTitle: service.title,
    vendorName: agreement.vendorName,
    bookingDate: 'Today',
    serviceDate: 'Choose a time',
    membershipStatus: resident.membershipStatus,
    rewardServiceCode: service.rewardCode,
    originalEligibleSubtotal: checkout.originalServicePriceCents / 100,
    standardPrice: pricing.standardPrice,
    plusPrice: pricing.plusPrice,
    selectedPrice,
    discount: checkout.residentCreditCents / 100,
    pointsRedeemed: checkout.appliedPoints,
    finalResidentPayment: checkout.residentPaysProviderCents / 100,
    vendorAmount: checkout.residentPaysProviderCents / 100,
    grossReferralFee: checkout.grossReferralFeeCents / 100,
    creditOffset: checkout.creditOffsetCents / 100,
    flairoRevenue: checkout.netReferralFeeOwedCents / 100,
    providerRetainedAfterReferral: checkout.providerRetainedAfterReferralCents / 100,
    earnedBasePoints: earned.basePoints,
    earnedBonusPoints: earned.completionBonusPoints,
    earnedRecurringBonus: earned.recurringBonusPoints,
    earnedTotalPoints: earned.totalPoints,
    plusAdditionalPoints: earned.plusAdditionalPoints,
    pointStatus: 'pending',
    availabilityDate: addDays(todayISO(), rewardConfig.availabilityWaitingDays),
    settlementStatus: 'Not started',
    reviewFlags: completionFlags,
    paymentStatus: 'Resident pays vendor',
    bookingStatus: 'Requested',
    discountTreatment: agreement.discountTreatment,
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [resident, setResident] = useState<ResidentProfile | null>(null);
  const [rewardConfig, setRewardConfig] = useState<RewardProgramConfig>(defaultRewardProgramConfig);
  const [selectedServiceId, setSelectedServiceId] = useState('occupied-cleaning');
  const [serviceFilter, setServiceFilter] = useState<Filter>('Home Care');
  const [rewardDiscount, setRewardDiscount] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rewardTransactions, setRewardTransactions] = useState<RewardLedgerEntry[]>(initialRewards);
  const [adminTab, setAdminTab] = useState<AdminTab>('Dashboard');
  const [auditEvents, setAuditEvents] = useState<string[]>([
    'System seeded launch bonus with admin/system attribution.',
  ]);

  const rewardSummary = useMemo(
    () => summarizeRewardAccount(rewardTransactions, rewardConfig),
    [rewardConfig, rewardTransactions],
  );
  const points = rewardSummary.availablePoints;

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? services[0],
    [selectedServiceId],
  );

  const filteredServices = useMemo(() => {
    if (serviceFilter === 'All') return services;
    return services.filter((service) => service.category === serviceFilter);
  }, [serviceFilter]);

  const chooseFilter = (filter: Filter) => {
    setServiceFilter(filter);
    const nextService = filter === 'All' ? services[0] : services.find((service) => service.category === filter);
    if (nextService) setSelectedServiceId(nextService.id);
  };

  const createResident = (profile: ResidentProfile) => {
    setResident(profile);
    setScreen('home');
  };

  const updateMembership = (status: MembershipStatus) => {
    if (!resident) return;
    setResident({ ...resident, membershipStatus: status });
    setAuditEvents((current) => [
      `${todayISO()} / Membership changed to ${status}. Future earning follows ${membershipLevelFromStatus(status).toUpperCase()} rules.`,
      ...current,
    ]);
  };

  const bookService = () => {
    if (!resident) {
      setScreen('register');
      return;
    }

    const pricing = getPricing(selectedService, resident);
    const membershipLevel = membershipLevelFromStatus(resident.membershipStatus);
    const selectedPrice = membershipLevel === 'plus' ? pricing.plusPrice : pricing.standardPrice;
    const serviceIsRecurring = serviceRule(selectedService.rewardCode, rewardConfig).recurringEligible;
    const completedRecurringCount = bookings.filter(
      (booking) => booking.bookingStatus === 'Completed' && serviceRule(booking.rewardServiceCode, rewardConfig).recurringEligible,
    ).length;
    const completedRecurringCountIncludingThis = serviceIsRecurring ? completedRecurringCount + 1 : 0;
    const checkout = calculateCheckoutQuote({
      availablePoints: rewardSummary.availablePoints,
      config: rewardConfig,
      membershipLevel,
      originalEligibleSubtotalCents: cents(pricing.standardPrice),
      requestedPoints: rewardDiscount ? rewardSummary.availablePoints : 0,
      selectedServicePriceCents: cents(selectedPrice),
    });
    const booking = createSettlementBooking({
      checkout,
      completedRecurringCountIncludingThis,
      rewardConfig,
      resident,
      service: selectedService,
    });
    const earned = calculateEarnedPoints({
      completedRecurringCountIncludingThis,
      config: rewardConfig,
      eligibleSubtotalCents: checkout.originalServicePriceCents,
      membershipLevel,
      serviceCode: selectedService.rewardCode,
    });
    const earningEntries = createEarningEntries({
      bookingId: booking.id,
      breakdown: earned,
      config: rewardConfig,
      residentId: 'demo-resident',
      serviceCode: selectedService.rewardCode,
      status: 'pending',
    });
    const redemptionEntry = checkout.appliedPoints > 0
      ? createRedemptionEntry({
        bookingId: booking.id,
        points: checkout.appliedPoints,
        residentCreditCents: checkout.residentCreditCents,
        residentId: 'demo-resident',
      })
      : null;

    setBookings((current) => [booking, ...current]);
    setRewardTransactions((current) => [
      ...earningEntries,
      ...(redemptionEntry ? [redemptionEntry] : []),
      ...current,
    ]);
    setAuditEvents((current) => [
      `${todayISO()} / Booking ${booking.id} created with ${earned.totalPoints} pending points and ${checkout.appliedPoints} redeemed points.`,
      ...current,
    ]);
    setRewardDiscount(false);
    setScreen('bookings');
  };

  const confirmBooking = (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking || booking.bookingStatus === 'Completed') {
      setAuditEvents((current) => [`${todayISO()} / Duplicate completion attempt blocked for ${bookingId}.`, ...current]);
      return;
    }

    setBookings((current) => current.map((item) => (
      item.id === bookingId
        ? {
          ...item,
          bookingStatus: 'Completed',
          completionDate: todayISO(),
          paymentStatus: 'Completion and payment confirmed',
          pointStatus: 'available',
          settlementStatus: item.creditOffset > 0 ? 'Offset applied' : 'Unpaid',
        }
        : item
    )));
    setRewardTransactions((current) => makeBookingPointsAvailable({ bookingId, entries: current }));
    setAuditEvents((current) => [
      `${todayISO()} / Provider confirmed completion and payment for ${bookingId}; pending points are now available.`,
      ...current,
    ]);
  };

  const reverseBooking = (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking || booking.bookingStatus === 'Refunded') return;

    setBookings((current) => current.map((item) => (
      item.id === bookingId
        ? {
          ...item,
          bookingStatus: 'Refunded',
          paymentStatus: 'Refund/dispute recorded',
          pointStatus: 'reversed',
          settlementStatus: 'Disputed',
        }
        : item
    )));
    setRewardTransactions((current) => [
      createReversalEntry({
        bookingId,
        points: booking.earnedTotalPoints,
        reason: 'Refund or dispute reversed earned reward points',
        residentId: 'demo-resident',
      }),
      ...current,
    ]);
    setAuditEvents((current) => [
      `${todayISO()} / Refund or dispute reversed ${booking.earnedTotalPoints} points for ${bookingId}.`,
      ...current,
    ]);
  };

  const runExpirationBatch = () => {
    const runDate = addMonths(todayISO(), rewardConfig.expirationMonthsWithoutActivity + 1);
    const expirationEntries = createExpirationEntries({ createdAt: runDate, entries: rewardTransactions });
    if (expirationEntries.length === 0) {
      setAuditEvents((current) => [`${todayISO()} / Expiration batch found no eligible points.`, ...current]);
      return;
    }

    setRewardTransactions((current) => [...expirationEntries, ...current]);
    setAuditEvents((current) => [
      `${todayISO()} / Expiration batch created ${expirationEntries.length} ledger entries using the configured inactivity rule.`,
      ...current,
    ]);
  };

  const addManualAdjustment = (pointsDelta: number, reason: string) => {
    const entry = createManualAdjustmentEntry({
      adminId: 'admin-demo',
      points: pointsDelta,
      reason,
      residentId: 'demo-resident',
    });
    setRewardTransactions((current) => [{ ...entry, id: `${entry.id}-${Date.now()}` }, ...current]);
    setAuditEvents((current) => [
      `${todayISO()} / Admin adjustment ${pointsDelta > 0 ? '+' : ''}${pointsDelta} points: ${reason}.`,
      ...current,
    ]);
  };

  const updateRewardConfig = (patch: Partial<RewardProgramConfig>) => {
    setRewardConfig((current) => ({ ...current, ...patch }));
    setAuditEvents((current) => [`${todayISO()} / Reward program configuration updated.`, ...current]);
  };

  const content = useMemo(() => {
    if (screen === 'register') {
      return <Registration resident={resident} createResident={createResident} />;
    }

    if (screen === 'services') {
      return (
        <Services
          bookService={bookService}
          bookings={bookings}
          chooseFilter={chooseFilter}
          filteredServices={filteredServices}
          resident={resident}
          rewardConfig={rewardConfig}
          rewardDiscount={rewardDiscount}
          rewardSummary={rewardSummary}
          selectedFilter={serviceFilter}
          selectedService={selectedService}
          selectedServiceId={selectedServiceId}
          setRewardDiscount={setRewardDiscount}
          setSelectedServiceId={setSelectedServiceId}
        />
      );
    }

    if (screen === 'rewards') {
      return (
        <Rewards
          addManualAdjustment={addManualAdjustment}
          bookings={bookings}
          resident={resident}
          rewardConfig={rewardConfig}
          rewardSummary={rewardSummary}
          runExpirationBatch={runExpirationBatch}
          transactions={rewardTransactions}
        />
      );
    }

    if (screen === 'bookings') {
      return (
        <Bookings
          bookings={bookings}
          confirmBooking={confirmBooking}
          reverseBooking={reverseBooking}
          setScreen={setScreen}
        />
      );
    }

    if (screen === 'admin') {
      return (
        <Admin
          addManualAdjustment={addManualAdjustment}
          adminTab={adminTab}
          auditEvents={auditEvents}
          bookings={bookings}
          resident={resident}
          rewardConfig={rewardConfig}
          rewardSummary={rewardSummary}
          rewardTransactions={rewardTransactions}
          runExpirationBatch={runExpirationBatch}
          setAdminTab={setAdminTab}
          updateRewardConfig={updateRewardConfig}
        />
      );
    }

    if (screen === 'profile') {
      return <Profile points={points} resident={resident} rewardSummary={rewardSummary} setScreen={setScreen} updateMembership={updateMembership} />;
    }

    return <Home bookings={bookings} points={points} resident={resident} rewardSummary={rewardSummary} setScreen={setScreen} supabaseReady={hasSupabaseConfig} />;
  }, [
    adminTab,
    auditEvents,
    bookings,
    filteredServices,
    points,
    resident,
    rewardConfig,
    rewardDiscount,
    rewardSummary,
    rewardTransactions,
    screen,
    selectedService,
    selectedServiceId,
    serviceFilter,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setScreen('home')} style={styles.headerBrand}>
            <Image resizeMode="cover" source={goldIcon} style={styles.headerIcon} />
            <View style={styles.headerCopy}>
              <Text style={styles.brand}>Flairo</Text>
              <Text style={styles.headerMeta}>
                {resident ? `${findCommunity(resident.communityId).name} / Unit ${resident.unit.unitNumber}` : 'Resident marketplace'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setScreen('profile')} style={styles.pointsPill}>
            <Text style={styles.pointsPillText}>{points.toLocaleString()}</Text>
            <Text style={styles.pointsPillLabel}>PTS</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>

        <View style={styles.nav}>
          {navItems.map((item) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: screen === item.key }}
              key={item.key}
              onPress={() => setScreen(item.key)}
              style={[styles.navButton, screen === item.key && styles.navButtonActive]}
            >
              <View style={[styles.navMark, screen === item.key && styles.navMarkActive]} />
              <Text style={[styles.navItem, screen === item.key && styles.navItemActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Home({
  bookings,
  points,
  resident,
  rewardSummary,
  setScreen,
  supabaseReady,
}: {
  bookings: Booking[];
  points: number;
  resident: ResidentProfile | null;
  rewardSummary: RewardAccountSummary;
  setScreen: (screen: Screen) => void;
  supabaseReady: boolean;
}) {
  const community = resident ? findCommunity(resident.communityId) : communities[0];
  const activeStatus = resident?.membershipStatus ?? 'None';
  const nextBooking = bookings[0];

  return (
    <View>
      <View style={styles.heroPanel}>
        <Image resizeMode="contain" source={fullLogo} style={styles.heroLogo} />
        <Text style={styles.eyebrow}>EXCLUSIVE PERKS. ELEVATED LIVING.</Text>
        <Text style={styles.hero}>Resident services, priced for your home.</Text>
        <Text style={styles.heroBody}>
          FLAIRO now captures resident, community, unit, membership, rewards, booking, and provider economics in one flow.
        </Text>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setScreen(resident ? 'services' : 'register')}>
            <Text style={styles.primaryButtonText}>{resident ? 'Book Home Care' : 'Create account'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setScreen('admin')}>
            <Text style={styles.ghostButtonText}>Admin model</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard label="Home" value={resident ? resident.unit.unitNumber : 'Not set'} detail={resident ? `${resident.unit.bedrooms}BR / ${resident.unit.bathrooms}BA` : 'Register first'} />
        <StatCard label="Plus" value={isPlusEligible(activeStatus) ? activeStatus : 'Off'} detail={community.plusAvailable ? 'available here' : 'not enabled'} />
        <StatCard label="Rewards" value={points.toLocaleString()} detail={`${rewardSummary.pendingPoints.toLocaleString()} pending`} />
      </View>

      <View style={styles.infoPanel}>
        <Text style={supabaseReady ? styles.cardLabelGold : styles.cardLabelPink}>
          {supabaseReady ? 'SUPABASE CONNECTED' : 'SUPABASE KEY NEEDED'}
        </Text>
        <Text style={styles.bodyMuted}>
          {supabaseReady
            ? 'The mobile app has the project URL and public key needed for live Auth and database calls.'
            : 'The project URL is set. Paste the Supabase publishable key into .env to turn on live Auth and database calls.'}
        </Text>
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.cardLabelGold}>MY HOME</Text>
        <Text style={styles.panelTitle}>{community.name}</Text>
        <Text style={styles.bodyMuted}>{community.address}, {community.city}, {community.state} {community.zip}</Text>
        <Text style={styles.bodyMuted}>
          {resident
            ? `Unit ${resident.unit.unitNumber} is ${resident.unit.verificationStatus}${resident.unit.duplicateReview ? ' and flagged for duplicate review.' : '.'}`
            : 'Registration builds the unit directory without requiring PMS data.'}
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Resident snapshot</Text>
        <TouchableOpacity onPress={() => setScreen('profile')}>
          <Text style={styles.sectionLink}>Profile</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.listItem}>
        <View style={styles.listCopy}>
          <Text style={styles.cardTitle}>Upcoming service</Text>
          <Text style={styles.bodyMuted}>
            {nextBooking ? `${nextBooking.serviceTitle} / ${nextBooking.bookingStatus} / ${money(nextBooking.finalResidentPayment)}` : 'No active booking yet.'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setScreen(nextBooking ? 'bookings' : 'services')}>
          <Text style={styles.chevron}>{nextBooking ? 'Open' : 'Book'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.benefitStrip}>
        <BenefitTile title="Resident -> Provider" detail="Direct payment model" />
        <BenefitTile title="Rewards ledger" detail="Every point traced" />
        <BenefitTile title="Configurable" detail="Rules, caps, pricing" />
      </View>
    </View>
  );
}

function Registration({
  createResident,
  resident,
}: {
  createResident: (profile: ResidentProfile) => void;
  resident: ResidentProfile | null;
}) {
  const [firstName, setFirstName] = useState(resident?.firstName ?? 'Maya');
  const [lastName, setLastName] = useState(resident?.lastName ?? 'Chen');
  const [email, setEmail] = useState(resident?.email ?? 'maya.chen@example.com');
  const [mobile, setMobile] = useState(resident?.mobile ?? '(305) 555-0199');
  const [password, setPassword] = useState('••••••••');
  const [communityId, setCommunityId] = useState(resident?.communityId ?? communities[0].id);
  const [unitNumber, setUnitNumber] = useState(resident?.unit.unitNumber ?? '4B');
  const [bedrooms, setBedrooms] = useState(resident?.unit.bedrooms ?? 2);
  const [bathrooms, setBathrooms] = useState(resident?.unit.bathrooms ?? 2);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(resident?.membershipStatus ?? 'Trial');
  const [error, setError] = useState('');

  const community = findCommunity(communityId);
  const duplicateReview = knownUnits.some(
    (unit) => unit.communityId === communityId && unit.unitNumber.toLowerCase() === unitNumber.trim().toLowerCase(),
  );

  const submit = () => {
    if (!unitNumber.trim()) {
      setError('Unit number is required.');
      return;
    }

    const verificationStatus: VerificationStatus = duplicateReview ? 'Unverified' : 'Resident Self-Verified';
    createResident({
      firstName,
      lastName,
      email,
      mobile,
      communityId,
      membershipStatus,
      unit: {
        id: `unit-${communityId}-${unitNumber.trim().toLowerCase()}`,
        communityId,
        unitNumber: unitNumber.trim(),
        bedrooms,
        bathrooms,
        verificationStatus,
        duplicateReview,
      },
    });
  };

  return (
    <View>
      <PageIntro
        kicker="CREATE RESIDENT ACCOUNT"
        title="Self-registration without PMS dependency."
        body="Residents identify their community and unit. FLAIRO keeps the unit record for future pricing, validation, and administration."
      />

      <View style={styles.formPanel}>
        <FormField label="First name" value={firstName} onChangeText={setFirstName} />
        <FormField label="Last name" value={lastName} onChangeText={setLastName} />
        <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <FormField label="Mobile phone" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
        <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.fieldLabel}>Community</Text>
        <View style={styles.optionRow}>
          {communities.map((item) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={item.id}
              onPress={() => setCommunityId(item.id)}
              style={[styles.optionButton, communityId === item.id && styles.optionButtonActive]}
            >
              <Text style={[styles.optionText, communityId === item.id && styles.optionTextActive]}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FormField label="Unit number" value={unitNumber} onChangeText={setUnitNumber} />
        <PickerRow label="Bedrooms" options={[0, 1, 2, 3, 4]} selected={bedrooms} setSelected={setBedrooms} />
        <PickerRow label="Bathrooms" options={[1, 2, 3, 4]} selected={bathrooms} setSelected={setBathrooms} />
        <StatusPicker selected={membershipStatus} setSelected={setMembershipStatus} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.validationPanel}>
          <Text style={styles.cardLabelGold}>UNIT VALIDATION</Text>
          <Text style={styles.bodyMuted}>Format: {community.unitFormat}</Text>
          <Text style={styles.bodyMuted}>
            {duplicateReview
              ? 'Existing active unit found. Registration is allowed but flagged for admin review.'
              : 'No matching active unit found. A new unit record will be created.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButtonWide} onPress={submit}>
          <Text style={styles.primaryButtonText}>Create resident profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Services({
  bookService,
  bookings,
  chooseFilter,
  filteredServices,
  resident,
  rewardConfig,
  rewardDiscount,
  rewardSummary,
  selectedFilter,
  selectedService,
  selectedServiceId,
  setRewardDiscount,
  setSelectedServiceId,
}: {
  bookService: () => void;
  bookings: Booking[];
  chooseFilter: (filter: Filter) => void;
  filteredServices: Service[];
  resident: ResidentProfile | null;
  rewardConfig: RewardProgramConfig;
  rewardDiscount: boolean;
  rewardSummary: RewardAccountSummary;
  selectedFilter: Filter;
  selectedService: Service;
  selectedServiceId: string;
  setRewardDiscount: (value: boolean) => void;
  setSelectedServiceId: (id: string) => void;
}) {
  const pricing = getPricing(selectedService, resident);
  const agreement = getAgreement(selectedService);
  const plusEligible = resident ? isPlusEligible(resident.membershipStatus) : false;
  const membershipLevel = membershipLevelFromStatus(resident?.membershipStatus);
  const selectedPrice = plusEligible ? pricing.plusPrice : pricing.standardPrice;
  const serviceIsRecurring = serviceRule(selectedService.rewardCode, rewardConfig).recurringEligible;
  const completedRecurringCount = bookings.filter(
    (booking) => booking.bookingStatus === 'Completed' && serviceRule(booking.rewardServiceCode, rewardConfig).recurringEligible,
  ).length;
  const recurringCountForQuote = serviceIsRecurring ? completedRecurringCount + 1 : 0;
  const checkout = calculateCheckoutQuote({
    availablePoints: rewardSummary.availablePoints,
    config: rewardConfig,
    membershipLevel,
    originalEligibleSubtotalCents: cents(pricing.standardPrice),
    requestedPoints: rewardDiscount ? rewardSummary.availablePoints : 0,
    selectedServicePriceCents: cents(selectedPrice),
  });
  const earned = calculateEarnedPoints({
    completedRecurringCountIncludingThis: recurringCountForQuote,
    config: rewardConfig,
    eligibleSubtotalCents: checkout.originalServicePriceCents,
    membershipLevel,
    serviceCode: selectedService.rewardCode,
  });
  const freeEarned = calculateEarnedPoints({
    completedRecurringCountIncludingThis: recurringCountForQuote,
    config: rewardConfig,
    eligibleSubtotalCents: checkout.originalServicePriceCents,
    membershipLevel: 'free',
    serviceCode: selectedService.rewardCode,
  });
  const plusEarned = calculateEarnedPoints({
    completedRecurringCountIncludingThis: recurringCountForQuote,
    config: rewardConfig,
    eligibleSubtotalCents: checkout.originalServicePriceCents,
    membershipLevel: 'plus',
    serviceCode: selectedService.rewardCode,
  });
  const savings = Math.max(pricing.standardPrice - pricing.plusPrice, 0);
  const recurringStatus = recurringProgress({
    completedRecurringAppointments: completedRecurringCount,
    config: rewardConfig,
  });
  const canRedeem = checkout.maxRedeemablePoints > 0;

  return (
    <View>
      <PageIntro
        kicker="HOME CARE"
        title="Occupied cleaning priced from the resident profile."
        body="Bedroom and bathroom counts are captured once during registration and reused for service pricing."
      />

      <ScrollView contentContainerStyle={styles.categoryRail} horizontal showsHorizontalScrollIndicator={false}>
        {filters.map((filter) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={filter}
            onPress={() => chooseFilter(filter)}
            style={[styles.chip, selectedFilter === filter && styles.chipActive]}
          >
            <Text style={[styles.chipText, selectedFilter === filter && styles.chipTextActive]}>{filter}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.fastRequestPanel}>
        <View style={styles.fastRequestTop}>
          <View style={styles.hexBadgeSmall}>
            <Image resizeMode="cover" source={badgeLogo} style={styles.hexBadgeImage} />
          </View>
          <View style={styles.fastRequestCopy}>
            <Text style={styles.cardLabelGold}>FAST REQUEST</Text>
            <Text style={styles.panelTitle}>{selectedService.title}</Text>
            <Text style={styles.bodyMuted}>{selectedService.detail}</Text>
          </View>
        </View>

        <View style={styles.pricePanel}>
          <Text style={styles.cardLabelPink}>PRICE SNAPSHOT</Text>
          <PriceLine label="Unit profile" value={resident ? `${pricing.label}` : 'Create account first'} />
          <PriceLine label="Standard price" value={money(pricing.standardPrice)} />
          <PriceLine label="FLAIRO PLUS price" value={`${money(pricing.plusPrice)} / save ${money(savings)}`} />
          <PriceLine label="Eligible PLUS status" value={plusEligible ? resident?.membershipStatus ?? 'None' : 'Not active'} />
          <PriceLine label="Available balance" value={`${rewardSummary.availablePoints.toLocaleString()} pts / ${formatCents(pointsToCreditCents(rewardSummary.availablePoints, rewardConfig))}`} />
          <PriceLine label="Maximum points applied" value={`${checkout.maxRedeemablePoints.toLocaleString()} pts`} />
          <PriceLine label="Reward credit" value={checkout.residentCreditCents > 0 ? `-${formatCents(checkout.residentCreditCents)} / ${checkout.appliedPoints.toLocaleString()} pts` : 'None applied'} />
          <PriceLine label="Resident pays provider" value={formatCents(checkout.residentPaysProviderCents)} emphasized />
          <PriceLine label="Points after completion" value={`${earned.totalPoints.toLocaleString()} pts (${earned.basePoints} base + ${earned.completionBonusPoints} bonus${earned.recurringBonusPoints ? ` + ${earned.recurringBonusPoints} loyalty` : ''})`} />
          <PriceLine label="PLUS advantage" value={plusEligible ? `${earned.plusAdditionalPoints.toLocaleString()} extra pts and ${money(savings)} saved` : `Upgrade: +${Math.max(plusEarned.totalPoints - freeEarned.totalPoints, 0).toLocaleString()} pts / ${money(savings)} saved`} />
          <PriceLine label="Payment route" value="Resident pays connected vendor" />
          <PriceLine label="Gross 10% referral fee" value={formatCents(checkout.grossReferralFeeCents)} />
          <PriceLine label="Credit offset" value={formatCents(checkout.creditOffsetCents)} />
          <PriceLine label="Net owed to FLAIRO" value={formatCents(checkout.netReferralFeeOwedCents)} />
          <PriceLine label="Discount funding" value={agreement.discountTreatment} />
          {serviceIsRecurring ? <PriceLine label="Recurring milestone" value={recurringStatus.message} /> : null}
        </View>

        <TouchableOpacity
          disabled={!canRedeem}
          onPress={() => setRewardDiscount(!rewardDiscount)}
          style={[styles.ghostButtonWide, rewardDiscount && styles.ghostButtonSelected, !canRedeem && styles.disabledButton]}
        >
          <Text style={styles.ghostButtonText}>
            {rewardDiscount ? 'Reward applied' : canRedeem ? `Apply up to ${checkout.maxRedeemablePoints.toLocaleString()} pts` : 'Reach threshold to redeem'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButtonWide} onPress={bookService}>
          <Text style={styles.primaryButtonText}>{resident ? 'Book and snapshot pricing' : 'Register to book'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Marketplace services</Text>
      {filteredServices.map((service) => {
        const servicePricing = getPricing(service, resident);
        return (
          <TouchableOpacity
            accessibilityRole="button"
            key={service.id}
            onPress={() => setSelectedServiceId(service.id)}
            style={[styles.serviceCard, selectedServiceId === service.id && styles.serviceCardSelected]}
          >
            <View style={[styles.serviceAccent, { backgroundColor: service.accent }]} />
            <View style={styles.serviceContent}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardLabel}>{service.category}</Text>
                <Text style={styles.priceText}>{money(servicePricing.plusPrice)} PLUS</Text>
              </View>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.bodyMuted}>{service.subtitle}</Text>
              <View style={styles.serviceMetaRow}>
                <Text style={styles.metaText}>{service.duration}</Text>
                <Text style={styles.pointsEarn}>Bonus {serviceRule(service.rewardCode, rewardConfig).freeCompletionBonus}/{serviceRule(service.rewardCode, rewardConfig).plusCompletionBonus} pts</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Rewards({
  addManualAdjustment,
  bookings,
  resident,
  rewardConfig,
  rewardSummary,
  runExpirationBatch,
  transactions,
}: {
  addManualAdjustment: (pointsDelta: number, reason: string) => void;
  bookings: Booking[];
  resident: ResidentProfile | null;
  rewardConfig: RewardProgramConfig;
  rewardSummary: RewardAccountSummary;
  runExpirationBatch: () => void;
  transactions: RewardLedgerEntry[];
}) {
  const completedRecurringCount = bookings.filter(
    (booking) => booking.bookingStatus === 'Completed' && serviceRule(booking.rewardServiceCode, rewardConfig).recurringEligible,
  ).length;
  const progress = recurringProgress({ completedRecurringAppointments: completedRecurringCount, config: rewardConfig });
  const reminders = expirationReminderEntries({ entries: transactions, config: rewardConfig });
  const membershipLevel = membershipLevelFromStatus(resident?.membershipStatus);
  const membership = membershipLevel === 'plus' ? rewardConfig.plus : rewardConfig.free;
  const recommended = completedRecurringCount === 0
    ? 'Recurring housekeeping unlocks the fastest loyalty milestone.'
    : 'Pet care and handyman work are good next reward categories.';

  return (
    <View>
      <PageIntro
        kicker="FLAIRO REWARDS"
        title="Points, credits, and loyalty progress."
        body="Every point now lives in a ledger: pending, available, redeemed, reversed, or expired."
      />
      <View style={styles.walletHero}>
        <Image resizeMode="cover" source={goldIcon} style={styles.walletIcon} />
        <View style={styles.walletCopy}>
          <Text style={styles.cardLabelGold}>CURRENT BALANCE</Text>
          <Text style={styles.walletNumber}>{rewardSummary.availablePoints.toLocaleString()}</Text>
          <Text style={styles.bodyMuted}>
            {formatCents(rewardSummary.outstandingLiabilityCents)} available / {rewardSummary.pendingPoints.toLocaleString()} pending pts
          </Text>
        </View>
      </View>

      {rewardSummary.negativeBalance ? (
        <View style={styles.warningPanel}>
          <Text style={styles.cardLabelPink}>NEGATIVE BALANCE</Text>
          <Text style={styles.bodyMuted}>Refunds or reversals exceeded available points. Future earnings will recover the balance before new credits can be used.</Text>
        </View>
      ) : null}

      <View style={styles.statGrid}>
        <StatCard label="Earned" value={rewardSummary.lifetimePointsEarned.toLocaleString()} detail="lifetime points" />
        <StatCard label="Redeemed" value={formatCents(rewardSummary.lifetimeRewardsRedeemedCents)} detail={`${rewardSummary.redeemedPoints.toLocaleString()} pts`} />
        <StatCard label="PLUS" value={rewardSummary.plusAdditionalPointsEarned.toLocaleString()} detail="extra points earned" />
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.cardLabelPink}>MY PROGRAM</Text>
        <PriceLine label="Membership" value={`${membership.label}${membershipLevel === 'plus' ? ' / $5 monthly' : ''}`} />
        <PriceLine label="Earn rate" value={`${membership.basePointsPerDollar} point${membership.basePointsPerDollar === 1 ? '' : 's'} per $1`} />
        <PriceLine label="Redemption starts at" value={`${membership.redemptionThresholdPoints.toLocaleString()} pts`} />
        <PriceLine label="Point value" value="100 pts = $1 service credit" />
        <PriceLine label="Expiration rule" value={`${rewardConfig.expirationMonthsWithoutActivity} months without qualifying activity`} />
        <PriceLine label="Upcoming reminders" value={reminders.length ? `${reminders.length} expiration reminder${reminders.length === 1 ? '' : 's'} due` : 'None due today'} />
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.cardLabelGold}>RECURRING LOYALTY</Text>
        <PriceLine label="Completed recurring visits" value={completedRecurringCount.toString()} />
        <PriceLine label="Next milestone" value={progress.nextMilestone ? `${progress.nextMilestone.completedAppointments} visits` : 'Complete'} />
        <Text style={styles.bodyMuted}>{progress.message}</Text>
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.cardLabelPink}>RECOMMENDED NEXT</Text>
        <Text style={styles.bodyMuted}>{recommended}</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.ghostButtonWideHalf} onPress={() => addManualAdjustment(250, 'Concierge recovery credit')}>
          <Text style={styles.ghostButtonText}>Admin +250</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButtonWideHalf} onPress={runExpirationBatch}>
          <Text style={styles.ghostButtonText}>Run expiration</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Transaction history</Text>
      {transactions.map((transaction) => (
        <View key={transaction.id} style={styles.rewardCard}>
          <View style={styles.rowBetweenTop}>
            <View style={styles.rewardCopy}>
              <Text style={transaction.direction === 'credit' ? styles.cardLabelGold : styles.cardLabelPink}>
                {transaction.type.replace(/_/g, ' ').toUpperCase()} / {transaction.status.toUpperCase()}
              </Text>
              <Text style={styles.cardTitle}>{transaction.reason}</Text>
              <Text style={styles.bodyMuted}>
                {transaction.bookingId ? `Booking ${transaction.bookingId}` : `Source ${transaction.source}`}
                {transaction.expiresAt ? ` / expires ${transaction.expiresAt}` : ''}
              </Text>
            </View>
            <Text style={styles.rewardCost}>{transaction.direction === 'credit' ? '+' : '-'}{transaction.points}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Bookings({
  bookings,
  confirmBooking,
  reverseBooking,
  setScreen,
}: {
  bookings: Booking[];
  confirmBooking: (bookingId: string) => void;
  reverseBooking: (bookingId: string) => void;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <View>
      <PageIntro
        kicker="BOOKING ACTIVITY"
        title="Historical pricing is preserved."
        body="Bookings snapshot the agreed price, reward redemption, vendor payment route, and FLAIRO revenue obligation."
      />

      {bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.cardTitle}>No bookings yet</Text>
          <Text style={styles.bodyMuted}>Create a resident profile, open Home Care, apply points if eligible, and book Occupied Cleaning.</Text>
          <TouchableOpacity style={styles.primaryButtonWide} onPress={() => setScreen('services')}>
            <Text style={styles.primaryButtonText}>Book Home Care</Text>
          </TouchableOpacity>
        </View>
      ) : (
        bookings.map((booking) => (
          <BookingCard
            booking={booking}
            confirmBooking={confirmBooking}
            key={booking.id}
            reverseBooking={reverseBooking}
          />
        ))
      )}
    </View>
  );
}

function Admin({
  addManualAdjustment,
  adminTab,
  auditEvents,
  bookings,
  resident,
  rewardConfig,
  rewardSummary,
  rewardTransactions,
  runExpirationBatch,
  setAdminTab,
  updateRewardConfig,
}: {
  addManualAdjustment: (pointsDelta: number, reason: string) => void;
  adminTab: AdminTab;
  auditEvents: string[];
  bookings: Booking[];
  resident: ResidentProfile | null;
  rewardConfig: RewardProgramConfig;
  rewardSummary: RewardAccountSummary;
  rewardTransactions: RewardLedgerEntry[];
  runExpirationBatch: () => void;
  setAdminTab: (tab: AdminTab) => void;
  updateRewardConfig: (patch: Partial<RewardProgramConfig>) => void;
}) {
  const grossServiceValue = bookings.reduce((sum, booking) => sum + booking.originalEligibleSubtotal, 0);
  const completedBookings = bookings.filter((booking) => booking.bookingStatus === 'Completed');
  const plusBookings = bookings.filter((booking) => isPlusEligible(booking.membershipStatus));
  const refundedBookings = bookings.filter((booking) => booking.bookingStatus === 'Refunded');
  const grossReferralFees = bookings.reduce((sum, booking) => sum + booking.grossReferralFee, 0);
  const rewardCredits = bookings.reduce((sum, booking) => sum + booking.creditOffset, 0);
  const flairoRevenue = bookings.reduce((sum, booking) => sum + booking.flairoRevenue, 0);
  const vendorRevenue = bookings.reduce((sum, booking) => sum + booking.vendorAmount, 0);
  const plusSavings = plusBookings.reduce((sum, booking) => sum + Math.max(booking.standardPrice - booking.selectedPrice, 0), 0);
  const recurringBookings = bookings.filter((booking) => serviceRule(booking.rewardServiceCode, rewardConfig).recurringEligible);
  const providerFundedDiscounts = bookings
    .filter((booking) => booking.discountTreatment === 'Vendor absorbs discount')
    .reduce((sum, booking) => sum + Math.max(booking.standardPrice - booking.selectedPrice, 0), 0);
  const flairoFundedDiscounts = bookings
    .filter((booking) => booking.discountTreatment === 'FLAIRO absorbs discount' || booking.discountTreatment === 'Promotional subsidy')
    .reduce((sum, booking) => sum + Math.max(booking.standardPrice - booking.selectedPrice, 0), 0);
  const sharedDiscounts = bookings
    .filter((booking) => booking.discountTreatment === 'Shared discount')
    .reduce((sum, booking) => sum + Math.max(booking.standardPrice - booking.selectedPrice, 0), 0);
  const membershipRevenue = resident && isPlusEligible(resident.membershipStatus) ? rewardConfig.plus.monthlyFeeCents / 100 : 0;
  const activeMembers = resident ? 1 : 0;
  const activePlusMembers = resident && isPlusEligible(resident.membershipStatus) ? 1 : 0;
  const repeatBookingRate = bookings.length > 1 ? '100%' : '0%';

  const patchRewardConfig = (patch: Partial<RewardProgramConfig>) => updateRewardConfig(patch);
  const updateNumericSetting = (
    key: 'availabilityWaitingDays' | 'expirationMonthsWithoutActivity' | 'redemptionMaxPercentOfEligibleSubtotal' | 'referralFeePercent',
    delta: number,
  ) => {
    const next = Math.max(0, Math.round((rewardConfig[key] + delta) * 100) / 100);
    patchRewardConfig({ [key]: key === 'availabilityWaitingDays' ? Math.min(next, 30) : next } as Partial<RewardProgramConfig>);
  };
  const toggleServiceRule = (code: EligibleServiceCode) => {
    patchRewardConfig({
      serviceRules: rewardConfig.serviceRules.map((rule) => (
        rule.code === code ? { ...rule, active: !rule.active } : rule
      )),
    });
  };

  return (
    <View>
      <PageIntro
        kicker="FLAIRO ADMIN PORTAL"
        title="Rewards, providers, settlement, and audit."
        body="Settings in this screen update the live resident wallet, checkout limits, service eligibility, and reporting cards."
      />

      <ScrollView contentContainerStyle={styles.categoryRail} horizontal showsHorizontalScrollIndicator={false}>
        {adminTabs.map((tab) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={tab}
            onPress={() => setAdminTab(tab)}
            style={[styles.chip, adminTab === tab && styles.chipActive]}
          >
            <Text style={[styles.chipText, adminTab === tab && styles.chipTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {adminTab === 'Dashboard' ? (
        <View>
          <View style={styles.statGrid}>
            <StatCard label="Bookings" value={bookings.length.toString()} detail="total requests" />
            <StatCard label="GSV" value={money(grossServiceValue)} detail="gross service value" />
            <StatCard label="FLAIRO" value={money(flairoRevenue)} detail="net referral revenue" />
          </View>
          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelGold}>REPORTING DASHBOARD</Text>
            <PriceLine label="Active Rewards members" value={activeMembers.toString()} />
            <PriceLine label="Active PLUS members" value={activePlusMembers.toString()} />
            <PriceLine label="Monthly membership revenue" value={money(membershipRevenue)} />
            <PriceLine label="Vendor revenue collected directly" value={money(vendorRevenue)} />
            <PriceLine label="Outstanding points liability" value={formatCents(rewardSummary.outstandingLiabilityCents)} />
            <PriceLine label="Pending points liability" value={formatCents(rewardSummary.pendingLiabilityCents)} />
            <PriceLine label="Bookings by community" value={resident ? findCommunity(resident.communityId).name : 'None yet'} />
            <PriceLine label="Drill-down source" value="Bookings, reward ledger, provider fee ledger" />
          </View>
        </View>
      ) : null}

      {adminTab === 'Services' ? (
        <AdminSection title="Service management">
          {services.map((service) => (
            <AdminRow
              actionLabel={serviceRule(service.rewardCode, rewardConfig).active ? 'Deactivate' : 'Activate'}
              detail={`${service.category} / ${service.duration} / bonus ${serviceRule(service.rewardCode, rewardConfig).freeCompletionBonus} free, ${serviceRule(service.rewardCode, rewardConfig).plusCompletionBonus} PLUS`}
              key={service.id}
              onAction={() => toggleServiceRule(service.rewardCode)}
              title={service.title}
            />
          ))}
        </AdminSection>
      ) : null}

      {adminTab === 'Pricing' ? (
        <AdminSection title="Pricing management">
          {cleaningPricing.map((tier) => (
            <AdminRow key={tier.label} title={tier.label} detail={`Standard ${money(tier.standardPrice)} / PLUS ${money(tier.plusPrice)} / vendor net baseline ${money(tier.vendorNet)}`} />
          ))}
          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelPink}>PRICE HISTORY RULE</Text>
            <Text style={styles.bodyMuted}>Future price changes create new effective-dated records. Existing bookings retain their original price snapshot.</Text>
            <PriceLine label="PLUS pricing fields" value="standard, member price, savings, dates, areas, communities, unit sizes, blackout rules, funding source" />
          </View>
        </AdminSection>
      ) : null}

      {adminTab === 'Vendors' ? (
        <AdminSection title="Vendor management">
          {vendorAgreements.map((agreement) => (
            <AdminRow
              key={agreement.id}
              title={agreement.vendorName}
              detail={`${agreement.paymentConnectionStatus} / Standard ${agreement.standardFlairoFeePercent}% / PLUS ${agreement.plusFlairoFeePercent}% / ${agreement.discountTreatment}`}
            />
          ))}
        </AdminSection>
      ) : null}

      {adminTab === 'Bookings' ? (
        <AdminSection title="Booking management">
          {bookings.length === 0 ? (
            <AdminRow title="No bookings" detail="Create a Home Care booking to populate admin operations." />
          ) : (
            bookings.map((booking) => (
              <AdminRow
                key={booking.id}
                title={`${booking.id} / ${booking.serviceTitle}`}
                detail={`${booking.residentName} / ${booking.communityName} ${booking.unitNumber} / ${booking.bookingStatus} / ${booking.pointStatus} rewards / resident pays ${money(booking.finalResidentPayment)}`}
              />
            ))
          )}
        </AdminSection>
      ) : null}

      {adminTab === 'Rewards' ? (
        <AdminSection title="Reward program controls">
          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelGold}>CONFIGURABLE VALUES</Text>
            <ConfigLine label="Availability waiting period" value={`${rewardConfig.availabilityWaitingDays} days`} decrease={() => updateNumericSetting('availabilityWaitingDays', -1)} increase={() => updateNumericSetting('availabilityWaitingDays', 1)} />
            <ConfigLine label="Redemption cap" value={`${rewardConfig.redemptionMaxPercentOfEligibleSubtotal}% of eligible subtotal`} decrease={() => updateNumericSetting('redemptionMaxPercentOfEligibleSubtotal', -1)} increase={() => updateNumericSetting('redemptionMaxPercentOfEligibleSubtotal', 1)} />
            <ConfigLine label="Expiration period" value={`${rewardConfig.expirationMonthsWithoutActivity} months`} decrease={() => updateNumericSetting('expirationMonthsWithoutActivity', -1)} increase={() => updateNumericSetting('expirationMonthsWithoutActivity', 1)} />
            <ConfigLine label="Provider referral fee" value={`${rewardConfig.referralFeePercent}%`} decrease={() => updateNumericSetting('referralFeePercent', -1)} increase={() => updateNumericSetting('referralFeePercent', 1)} />
            <PriceLine label="Point value" value="100 pts = $1" />
            <PriceLine label="Free threshold" value={`${rewardConfig.free.redemptionThresholdPoints} pts`} />
            <PriceLine label="PLUS threshold" value={`${rewardConfig.plus.redemptionThresholdPoints} pts`} />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.ghostButtonWideHalf} onPress={() => addManualAdjustment(250, 'Manual goodwill adjustment')}>
              <Text style={styles.ghostButtonText}>Add 250 pts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostButtonWideHalf} onPress={() => addManualAdjustment(-150, 'Administrative correction')}>
              <Text style={styles.ghostButtonText}>Remove 150 pts</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.ghostButtonWide} onPress={runExpirationBatch}>
            <Text style={styles.ghostButtonText}>Run point-expiration batch</Text>
          </TouchableOpacity>

          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelPink}>POINT STATUS TOTALS</Text>
            <PriceLine label="Pending" value={rewardSummary.pendingPoints.toLocaleString()} />
            <PriceLine label="Available" value={rewardSummary.availablePoints.toLocaleString()} />
            <PriceLine label="Redeemed" value={rewardSummary.redeemedPoints.toLocaleString()} />
            <PriceLine label="Reversed" value={rewardSummary.reversedPoints.toLocaleString()} />
            <PriceLine label="Expired" value={rewardSummary.expiredPoints.toLocaleString()} />
          </View>
        </AdminSection>
      ) : null}

      {adminTab === 'Provider' ? (
        <AdminSection title="Provider portal">
          {bookings.length === 0 ? (
            <AdminRow title="No provider activity" detail="Create and complete bookings to populate provider settlement reporting." />
          ) : (
            <View>
              <View style={styles.infoPanel}>
                <Text style={styles.cardLabelGold}>SETTLEMENT SUMMARY</Text>
                <PriceLine label="Completed bookings" value={completedBookings.length.toString()} />
                <PriceLine label="Eligible service revenue" value={money(grossServiceValue)} />
                <PriceLine label="Gross 10% referral fees" value={money(grossReferralFees)} />
                <PriceLine label="Reward credits applied" value={money(rewardCredits)} />
                <PriceLine label="Provider-funded discounts" value={money(providerFundedDiscounts)} />
                <PriceLine label="FLAIRO-funded discounts" value={money(flairoFundedDiscounts)} />
                <PriceLine label="Shared discounts" value={money(sharedDiscounts)} />
                <PriceLine label="Net fees owed" value={money(flairoRevenue)} />
                <PriceLine label="PLUS booking performance" value={`${plusBookings.length} bookings / ${money(plusSavings)} member savings`} />
                <PriceLine label="Refunds or disputes" value={refundedBookings.length.toString()} />
              </View>
              {bookings.map((booking) => (
                <AdminRow
                  key={booking.id}
                  title={`${booking.vendorName} owes FLAIRO ${money(booking.flairoRevenue)}`}
                  detail={`${booking.id} / ${booking.bookingStatus} / gross fee ${money(booking.grossReferralFee)} / credit offset ${money(booking.creditOffset)} / ${booking.settlementStatus}`}
                />
              ))}
            </View>
          )}
        </AdminSection>
      ) : null}

      {adminTab === 'Reports' ? (
        <AdminSection title="Reports">
          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelGold}>MEMBERSHIP</Text>
            <PriceLine label="Rewards members" value={activeMembers.toString()} />
            <PriceLine label="PLUS members" value={activePlusMembers.toString()} />
            <PriceLine label="PLUS enrollments" value={activePlusMembers.toString()} />
            <PriceLine label="PLUS cancellations/churn" value={resident?.membershipStatus === 'Cancelled' ? '1 / 100%' : '0 / 0%'} />
            <PriceLine label="Membership revenue" value={money(membershipRevenue)} />
          </View>
          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelPink}>REWARDS AND FINANCE</Text>
            <PriceLine label="Points issued" value={rewardSummary.lifetimePointsEarned.toLocaleString()} />
            <PriceLine label="Pending/redeemed/reversed/expired" value={`${rewardSummary.pendingPoints}/${rewardSummary.redeemedPoints}/${rewardSummary.reversedPoints}/${rewardSummary.expiredPoints}`} />
            <PriceLine label="Outstanding liability" value={formatCents(rewardSummary.outstandingLiabilityCents)} />
            <PriceLine label="Service credits redeemed" value={formatCents(rewardSummary.lifetimeRewardsRedeemedCents)} />
            <PriceLine label="Gross service revenue" value={money(grossServiceValue)} />
            <PriceLine label="Gross referral fees" value={money(grossReferralFees)} />
            <PriceLine label="Credit offsets" value={money(rewardCredits)} />
            <PriceLine label="Net referral revenue" value={money(flairoRevenue)} />
          </View>
          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelGold}>BEHAVIOR</Text>
            <PriceLine label="Average bookings per member" value={activeMembers ? (bookings.length / activeMembers).toFixed(1) : '0'} />
            <PriceLine label="Repeat-booking rate" value={repeatBookingRate} />
            <PriceLine label="Recurring-service adoption" value={`${recurringBookings.length} booking${recurringBookings.length === 1 ? '' : 's'}`} />
            <PriceLine label="Most booked service" value={bookings[0]?.serviceTitle ?? 'None yet'} />
            <PriceLine label="Most redeemed service" value={bookings.find((booking) => booking.pointsRedeemed > 0)?.serviceTitle ?? 'None yet'} />
            <PriceLine label="PLUS savings and extra points" value={`${money(plusSavings)} / ${rewardSummary.plusAdditionalPointsEarned.toLocaleString()} pts`} />
            <PriceLine label="Filters" value="date, provider, service, resident, membership, community, city, state, booking status" />
          </View>
        </AdminSection>
      ) : null}

      {adminTab === 'Audit' ? (
        <AdminSection title="Audit trail">
          <View style={styles.infoPanel}>
            <Text style={styles.cardLabelPink}>FINANCIAL CONTROLS</Text>
            <PriceLine label="Duplicate completions" value="Blocked by booking status" />
            <PriceLine label="Ineligible services" value="Blocked by active service rule" />
            <PriceLine label="Excessive redemption" value="Capped by balance, threshold, and referral-fee percentage" />
            <PriceLine label="Refund/rebooking behavior" value={`${refundedBookings.length} refunds or disputes flagged`} />
            <PriceLine label="Unauthorized adjustments" value="Admin ID and reason required in ledger" />
          </View>
          {auditEvents.map((event) => (
            <AdminRow key={event} title={event.split(' / ')[0]} detail={event} />
          ))}
          <Text style={styles.sectionTitle}>Ledger source records</Text>
          {rewardTransactions.slice(0, 8).map((entry) => (
            <AdminRow
              key={entry.id}
              title={`${entry.id} / ${entry.status}`}
              detail={`${entry.direction === 'credit' ? '+' : '-'}${entry.points} pts / ${entry.type} / ${entry.reason}`}
            />
          ))}
        </AdminSection>
      ) : null}
    </View>
  );
}

function Profile({
  points,
  resident,
  rewardSummary,
  setScreen,
  updateMembership,
}: {
  points: number;
  resident: ResidentProfile | null;
  rewardSummary: RewardAccountSummary;
  setScreen: (screen: Screen) => void;
  updateMembership: (status: MembershipStatus) => void;
}) {
  if (!resident) {
    return (
      <View>
        <PageIntro kicker="RESIDENT PROFILE" title="Create a profile first." body="Registration is required before FLAIRO can price services against your home." />
        <TouchableOpacity style={styles.primaryButtonWide} onPress={() => setScreen('register')}>
          <Text style={styles.primaryButtonText}>Create resident account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const community = findCommunity(resident.communityId);

  return (
    <View>
      <PageIntro
        kicker="RESIDENT ACCOUNT"
        title="Home, services, Plus, rewards, and payments."
        body="Residents can manage contact and unit details, subject to admin validation rules."
      />
      <View style={styles.profileCard}>
        <Image resizeMode="cover" source={badgeLogo} style={styles.profileBadge} />
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{resident.firstName} {resident.lastName}</Text>
          <Text style={styles.bodyMuted}>{community.name}, Unit {resident.unit.unitNumber}</Text>
        </View>
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.cardLabelGold}>MY FLAIRO PLUS</Text>
        <View style={styles.optionRow}>
          {(['Active', 'Trial', 'Past Due', 'Cancelled', 'None'] as MembershipStatus[]).map((status) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={status}
              onPress={() => updateMembership(status)}
              style={[styles.optionButton, resident.membershipStatus === status && styles.optionButtonActive]}
            >
              <Text style={[styles.optionText, resident.membershipStatus === status && styles.optionTextActive]}>{status}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.bodyMuted}>
          PLUS is $5 monthly. Canceling keeps previously earned points, while future bookings return to the free earning rate.
        </Text>
      </View>

      {[
        ['My Home', `${community.name} / ${resident.unit.bedrooms}BR / ${resident.unit.bathrooms}BA / ${resident.unit.verificationStatus}`],
        ['My Rewards', `${points.toLocaleString()} available points / ${rewardSummary.pendingPoints.toLocaleString()} pending / ${formatCents(rewardSummary.outstandingLiabilityCents)} value`],
        ['My Payments', 'Resident pays vendor; receipts and refunds will attach to bookings.'],
        ['Support', 'Concierge chat and service preferences.'],
      ].map(([title, subtitle]) => (
        <View style={styles.listItem} key={title}>
          <View style={styles.listCopy}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.bodyMuted}>{subtitle}</Text>
          </View>
          <Text style={styles.chevron}>Open</Text>
        </View>
      ))}
    </View>
  );
}

function BookingCard({
  booking,
  confirmBooking,
  reverseBooking,
}: {
  booking: Booking;
  confirmBooking: (bookingId: string) => void;
  reverseBooking: (bookingId: string) => void;
}) {
  return (
    <View style={styles.bookingCard}>
      <View style={styles.rowBetweenTop}>
        <View style={styles.bookingCopy}>
          <Text style={styles.cardLabelGold}>{booking.bookingStatus} / {booking.paymentStatus}</Text>
          <Text style={styles.cardTitle}>{booking.serviceTitle}</Text>
          <Text style={styles.bodyMuted}>{booking.communityName}, Unit {booking.unitNumber} / {booking.unitConfig}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{booking.serviceDate}</Text>
        </View>
      </View>
      <View style={styles.pricePanelCompact}>
        <PriceLine label="Original eligible subtotal" value={money(booking.originalEligibleSubtotal)} />
        <PriceLine label="Standard" value={money(booking.standardPrice)} />
        <PriceLine label="PLUS" value={money(booking.plusPrice)} />
        <PriceLine label="Discount" value={`-${money(booking.discount)} / ${booking.pointsRedeemed} pts`} />
        <PriceLine label="Resident pays vendor" value={money(booking.finalResidentPayment)} emphasized />
        <PriceLine label="Gross 10% referral fee" value={money(booking.grossReferralFee)} />
        <PriceLine label="Credit offset" value={money(booking.creditOffset)} />
        <PriceLine label="Vendor owes FLAIRO" value={money(booking.flairoRevenue)} />
        <PriceLine label="Provider retains after fee" value={money(booking.providerRetainedAfterReferral)} />
        <PriceLine label="Reward status" value={`${booking.pointStatus} / ${booking.earnedTotalPoints.toLocaleString()} pts`} />
        <PriceLine label="Settlement" value={booking.settlementStatus} />
      </View>
      {booking.reviewFlags.length > 0 ? (
        <View style={styles.warningPanelInline}>
          {booking.reviewFlags.map((flag) => (
            <Text key={flag.code} style={styles.warningText}>{flag.severity.toUpperCase()}: {flag.message}</Text>
          ))}
        </View>
      ) : null}
      <View style={styles.actionRow}>
        <TouchableOpacity
          disabled={booking.bookingStatus === 'Completed' || booking.bookingStatus === 'Refunded'}
          onPress={() => confirmBooking(booking.id)}
          style={[
            styles.ghostButtonWideHalf,
            (booking.bookingStatus === 'Completed' || booking.bookingStatus === 'Refunded') && styles.disabledButton,
          ]}
        >
          <Text style={styles.ghostButtonText}>Confirm done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={booking.bookingStatus === 'Refunded'}
          onPress={() => reverseBooking(booking.id)}
          style={[styles.ghostButtonWideHalf, booking.bookingStatus === 'Refunded' && styles.disabledButton]}
        >
          <Text style={styles.ghostButtonText}>Refund/reverse</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormField({
  keyboardType,
  label,
  onChangeText,
  secureTextEntry,
  value,
}: {
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  label: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function PickerRow({
  label,
  options,
  selected,
  setSelected,
}: {
  label: string;
  options: number[];
  selected: number;
  setSelected: (value: number) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={option}
            onPress={() => setSelected(option)}
            style={[styles.numberButton, selected === option && styles.optionButtonActive]}
          >
            <Text style={[styles.optionText, selected === option && styles.optionTextActive]}>{option === 0 ? 'Studio' : option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function StatusPicker({ selected, setSelected }: { selected: MembershipStatus; setSelected: (status: MembershipStatus) => void }) {
  const statuses: MembershipStatus[] = ['Trial', 'Active', 'Past Due', 'Cancelled'];
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>FLAIRO PLUS status</Text>
      <View style={styles.optionRow}>
        {statuses.map((status) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={status}
            onPress={() => setSelected(status)}
            style={[styles.optionButton, selected === status && styles.optionButtonActive]}
          >
            <Text style={[styles.optionText, selected === status && styles.optionTextActive]}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function PageIntro({ body, kicker, title }: { body: string; kicker: string; title: string }) {
  return (
    <View style={styles.pageIntro}>
      <Text style={styles.eyebrow}>{kicker}</Text>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageBody}>{body}</Text>
    </View>
  );
}

function StatCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statDetail}>{detail}</Text>
    </View>
  );
}

function BenefitTile({ detail, title }: { detail: string; title: string }) {
  return (
    <View style={styles.benefitTile}>
      <View style={styles.benefitGem} />
      <Text style={styles.benefitTitle}>{title}</Text>
      <Text style={styles.benefitDetail}>{detail}</Text>
    </View>
  );
}

function PriceLine({ emphasized, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return (
    <View style={styles.priceLine}>
      <Text style={styles.priceLineLabel}>{label}</Text>
      <Text style={[styles.priceLineValue, emphasized && styles.priceLineValueEmphasized]}>{value}</Text>
    </View>
  );
}

function ConfigLine({
  decrease,
  increase,
  label,
  value,
}: {
  decrease: () => void;
  increase: () => void;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.configLine}>
      <View style={styles.configCopy}>
        <Text style={styles.priceLineLabel}>{label}</Text>
        <Text style={styles.priceLineValueLeft}>{value}</Text>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity accessibilityRole="button" onPress={decrease} style={styles.stepButton}>
          <Text style={styles.stepButtonText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={increase} style={styles.stepButton}>
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AdminSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AdminRow({
  actionLabel,
  detail,
  onAction,
  title,
}: {
  actionLabel?: string;
  detail: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.adminRow}>
      <View style={styles.rowBetweenTop}>
        <View style={styles.adminRowCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.bodyMuted}>{detail}</Text>
        </View>
        {actionLabel && onAction ? (
          <TouchableOpacity accessibilityRole="button" onPress={onAction} style={styles.smallActionButton}>
            <Text style={styles.smallActionButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const colors = {
  matte: '#0D0D0F',
  charcoal: '#151516',
  charcoalLift: '#1D1D1E',
  grain: '#242222',
  ivory: '#F7F4EF',
  ivoryMuted: '#D9D2C8',
  ash: '#9C9A98',
  taupe: '#2A2725',
  pink: '#F786C7',
  dustyPink: '#E8A7BA',
  gold: '#D4AF37',
  goldSoft: '#F0D58A',
  border: '#3B3332',
};

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.matte, flex: 1 },
  shell: { backgroundColor: colors.matte, flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: colors.matte,
    borderBottomColor: '#201B1B',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headerBrand: { alignItems: 'center', flex: 1, flexDirection: 'row', paddingRight: 12 },
  headerIcon: { borderColor: colors.gold, borderRadius: 8, borderWidth: 1, height: 42, marginRight: 10, width: 34 },
  headerCopy: { flex: 1 },
  brand: { color: colors.pink, fontSize: 28, fontWeight: '800', letterSpacing: 0 },
  headerMeta: { color: colors.ivoryMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  pointsPill: {
    alignItems: 'center',
    backgroundColor: colors.charcoalLift,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 74,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pointsPillLabel: { color: colors.goldSoft, fontSize: 10, fontWeight: '900', marginTop: 1 },
  pointsPillText: { color: colors.ivory, fontSize: 15, fontWeight: '900' },
  scroll: { paddingBottom: 116, paddingHorizontal: 18 },
  heroPanel: {
    backgroundColor: colors.charcoal,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
    padding: 18,
  },
  heroLogo: { alignSelf: 'flex-start', height: 112, marginBottom: 10, width: '100%' },
  eyebrow: { color: colors.goldSoft, fontSize: 11, fontWeight: '900', letterSpacing: 0, marginTop: 4 },
  hero: { color: colors.pink, fontSize: 38, fontWeight: '900', lineHeight: 40, marginTop: 9 },
  heroBody: { color: colors.ivory, fontSize: 15, fontWeight: '600', lineHeight: 22, marginTop: 12 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.pink,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  primaryButtonWide: {
    alignItems: 'center',
    backgroundColor: colors.pink,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 17,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: colors.matte, fontSize: 14, fontWeight: '900' },
  ghostButton: {
    alignItems: 'center',
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  ghostButtonWide: {
    alignItems: 'center',
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  ghostButtonWideHalf: {
    alignItems: 'center',
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  ghostButtonSelected: { backgroundColor: colors.taupe, borderColor: colors.pink },
  ghostButtonText: { color: colors.ivory, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  disabledButton: { opacity: 0.45 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statGrid: { flexDirection: 'row', gap: 9, marginTop: 12 },
  statCard: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 94,
    padding: 11,
  },
  statLabel: { color: colors.ash, fontSize: 10, fontWeight: '900' },
  statValue: { color: colors.ivory, fontSize: 18, fontWeight: '900', marginTop: 8 },
  statDetail: { color: colors.dustyPink, fontSize: 10, fontWeight: '700', lineHeight: 14, marginTop: 5 },
  infoPanel: {
    backgroundColor: colors.taupe,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  warningPanel: {
    backgroundColor: '#21171B',
    borderColor: colors.pink,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  warningPanelInline: {
    backgroundColor: '#21171B',
    borderColor: colors.pink,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  warningText: { color: colors.ivoryMuted, fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 4 },
  cardLabel: { color: colors.ash, fontSize: 11, fontWeight: '900', letterSpacing: 0 },
  cardLabelGold: { color: colors.goldSoft, fontSize: 11, fontWeight: '900', letterSpacing: 0 },
  cardLabelPink: { color: colors.pink, fontSize: 11, fontWeight: '900', letterSpacing: 0 },
  panelTitle: { color: colors.ivory, fontSize: 21, fontWeight: '900', lineHeight: 26, marginTop: 8 },
  bodyMuted: { color: colors.ivoryMuted, fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 8 },
  benefitStrip: { flexDirection: 'row', gap: 9, marginTop: 14 },
  benefitTile: {
    alignItems: 'center',
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 118,
    padding: 10,
  },
  benefitGem: {
    borderColor: colors.pink,
    borderRadius: 3,
    borderWidth: 1,
    height: 19,
    marginBottom: 10,
    transform: [{ rotate: '45deg' }],
    width: 19,
  },
  benefitTitle: { color: colors.ivory, fontSize: 12, fontWeight: '900', lineHeight: 16, textAlign: 'center' },
  benefitDetail: { color: colors.ash, fontSize: 10, fontWeight: '700', lineHeight: 14, marginTop: 6, textAlign: 'center' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  sectionTitle: { color: colors.ivory, fontSize: 20, fontWeight: '900', marginTop: 24 },
  sectionLink: { color: colors.pink, fontSize: 13, fontWeight: '900' },
  listItem: {
    alignItems: 'center',
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 15,
  },
  listCopy: { flex: 1, paddingRight: 12 },
  chevron: { color: colors.goldSoft, fontSize: 12, fontWeight: '900' },
  pageIntro: { paddingTop: 16 },
  pageTitle: { color: colors.pink, fontSize: 32, fontWeight: '900', lineHeight: 35, marginTop: 8 },
  pageBody: { color: colors.ivoryMuted, fontSize: 15, fontWeight: '600', lineHeight: 22, marginTop: 12 },
  formPanel: {
    backgroundColor: colors.charcoal,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  fieldBlock: { marginTop: 13 },
  fieldLabel: { color: colors.goldSoft, fontSize: 11, fontWeight: '900', marginBottom: 7 },
  input: {
    backgroundColor: colors.matte,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ivory,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  optionButton: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  numberButton: {
    alignItems: 'center',
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  optionText: { color: colors.ivoryMuted, fontSize: 12, fontWeight: '900' },
  optionTextActive: { color: colors.matte },
  errorText: { color: colors.pink, fontSize: 13, fontWeight: '800', marginTop: 12 },
  validationPanel: {
    backgroundColor: colors.taupe,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  categoryRail: { gap: 8, paddingVertical: 18 },
  chip: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  chipText: { color: colors.ivoryMuted, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.matte },
  fastRequestPanel: {
    backgroundColor: colors.charcoal,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  fastRequestTop: { alignItems: 'center', flexDirection: 'row' },
  hexBadgeSmall: {
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    height: 70,
    marginRight: 13,
    overflow: 'hidden',
    width: 54,
  },
  hexBadgeImage: { height: '100%', width: '100%' },
  fastRequestCopy: { flex: 1 },
  pricePanel: {
    backgroundColor: colors.matte,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 15,
    padding: 14,
  },
  pricePanelCompact: {
    backgroundColor: colors.matte,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  priceLine: {
    alignItems: 'flex-start',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
    paddingTop: 9,
  },
  priceLineLabel: { color: colors.ash, flex: 1, fontSize: 12, fontWeight: '800', paddingRight: 12 },
  priceLineValue: { color: colors.ivory, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 17, textAlign: 'right' },
  priceLineValueLeft: { color: colors.ivory, fontSize: 13, fontWeight: '900', lineHeight: 18, marginTop: 4 },
  priceLineValueEmphasized: { color: colors.goldSoft, fontSize: 14, fontWeight: '900' },
  configLine: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
  },
  configCopy: { flex: 1, paddingRight: 12 },
  stepper: { flexDirection: 'row', gap: 8 },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.charcoalLift,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepButtonText: { color: colors.ivory, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  serviceCard: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    overflow: 'hidden',
  },
  serviceCardSelected: { borderColor: colors.pink, borderWidth: 2 },
  serviceAccent: { width: 8 },
  serviceContent: { flex: 1, padding: 15 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowBetweenTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: colors.ivory, fontSize: 17, fontWeight: '900', lineHeight: 22, marginTop: 5 },
  priceText: { color: colors.goldSoft, fontSize: 13, fontWeight: '900' },
  serviceMetaRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metaText: { color: colors.ivory, fontSize: 13, fontWeight: '800' },
  pointsEarn: { color: colors.pink, fontSize: 13, fontWeight: '900' },
  walletHero: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    padding: 16,
  },
  walletIcon: { borderColor: colors.gold, borderRadius: 8, borderWidth: 1, height: 96, marginRight: 16, width: 78 },
  walletCopy: { flex: 1 },
  walletNumber: { color: colors.ivory, fontSize: 44, fontWeight: '900', marginTop: 4 },
  rewardCard: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  rewardCopy: { flex: 1, paddingRight: 14 },
  rewardCost: { color: colors.goldSoft, fontSize: 17, fontWeight: '900' },
  emptyState: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
    padding: 18,
  },
  bookingCard: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  bookingCopy: { flex: 1, paddingRight: 12 },
  dateBadge: {
    backgroundColor: colors.taupe,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 116,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  dateBadgeText: { color: colors.ivory, fontSize: 11, fontWeight: '900', lineHeight: 15, textAlign: 'center' },
  adminRow: {
    backgroundColor: colors.charcoalLift,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 15,
  },
  adminRowCopy: { flex: 1, paddingRight: 12 },
  smallActionButton: {
    alignItems: 'center',
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 86,
    paddingHorizontal: 10,
  },
  smallActionButtonText: { color: colors.ivory, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    padding: 16,
  },
  profileBadge: { borderColor: colors.pink, borderRadius: 8, borderWidth: 1, height: 92, marginRight: 14, width: 66 },
  profileCopy: { flex: 1 },
  profileName: { color: colors.pink, fontSize: 26, fontWeight: '900', lineHeight: 30 },
  nav: {
    backgroundColor: colors.charcoal,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 14,
    padding: 6,
    position: 'absolute',
    right: 14,
  },
  navButton: { alignItems: 'center', borderRadius: 8, flex: 1, minHeight: 48, paddingVertical: 7 },
  navButtonActive: { backgroundColor: colors.taupe },
  navMark: { backgroundColor: 'transparent', borderRadius: 3, height: 6, marginBottom: 5, width: 6 },
  navMarkActive: { backgroundColor: colors.pink },
  navItem: { color: colors.ash, fontSize: 10, fontWeight: '900' },
  navItemActive: { color: colors.ivory },
});
