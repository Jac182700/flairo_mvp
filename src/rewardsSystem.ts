export type MembershipLevel = 'free' | 'plus';

export type PointStatus = 'pending' | 'available' | 'redeemed' | 'reversed' | 'expired';

export type RewardLedgerType =
  | 'base_earn'
  | 'completion_bonus'
  | 'recurring_bonus'
  | 'redemption'
  | 'reversal'
  | 'expiration'
  | 'manual_adjustment';

export type LedgerDirection = 'credit' | 'debit';

export type EligibleServiceCode =
  | 'recurring_housekeeping'
  | 'groomer_appointment'
  | 'dog_walking'
  | 'pet_sitter_drop_in'
  | 'move_out_cleaning'
  | 'moving_service'
  | 'move_out_touch_up_painting'
  | 'move_out_full_painting'
  | 'move_out_deep_cleaning'
  | 'handyman_work'
  | 'junk_hauling';

export type DiscountFundingSource = 'provider' | 'flairo' | 'shared' | 'referral_fee_offset';

export type ServiceRewardRule = {
  code: EligibleServiceCode;
  label: string;
  category: string;
  freeCompletionBonus: number;
  plusCompletionBonus: number;
  recurringEligible: boolean;
  active: boolean;
};

export type MembershipRewardRule = {
  level: MembershipLevel;
  label: string;
  monthlyFeeCents: number;
  basePointsPerDollar: number;
  redemptionThresholdPoints: number;
};

export type RecurringMilestoneRule = {
  completedAppointments: number;
  freeBonus: number;
  plusBonus: number;
};

export type RewardProgramConfig = {
  pointValueCents: number;
  referralFeePercent: number;
  redemptionMaxPercentOfEligibleSubtotal: number;
  availabilityWaitingDays: number;
  expirationMonthsWithoutActivity: number;
  expirationReminderDays: number[];
  free: MembershipRewardRule;
  plus: MembershipRewardRule;
  serviceRules: ServiceRewardRule[];
  recurringMilestones: RecurringMilestoneRule[];
};

export type EarnedPointBreakdown = {
  basePoints: number;
  completionBonusPoints: number;
  recurringBonusPoints: number;
  totalPoints: number;
  plusAdditionalPoints: number;
};

export type CheckoutQuote = {
  originalServicePriceCents: number;
  selectedServicePriceCents: number;
  eligibleSubtotalCents: number;
  memberSavingsCents: number;
  requestedPoints: number;
  appliedPoints: number;
  residentCreditCents: number;
  maxRedeemablePoints: number;
  residentPaysProviderCents: number;
  grossReferralFeeCents: number;
  creditOffsetCents: number;
  netReferralFeeOwedCents: number;
  providerRetainedAfterReferralCents: number;
};

export type RewardLedgerEntry = {
  id: string;
  residentId: string;
  bookingId?: string;
  serviceCode?: EligibleServiceCode;
  type: RewardLedgerType;
  direction: LedgerDirection;
  status: PointStatus;
  points: number;
  reason: string;
  source: string;
  createdAt: string;
  availableAt?: string;
  expiresAt?: string;
  adminId?: string;
  relatedLedgerEntryId?: string;
  dollarValueCents?: number;
  plusAdditionalPoints?: number;
};

export type RewardAccountSummary = {
  pendingPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  reversedPoints: number;
  expiredPoints: number;
  lifetimePointsEarned: number;
  lifetimeRewardsRedeemedCents: number;
  outstandingLiabilityCents: number;
  pendingLiabilityCents: number;
  plusAdditionalPointsEarned: number;
  negativeBalance: boolean;
};

export type RecurringProgress = {
  completed: number;
  nextMilestone?: RecurringMilestoneRule;
  remainingToNextMilestone: number;
  message: string;
};

export type RewardRiskFlag = {
  code: string;
  severity: 'info' | 'review' | 'block';
  message: string;
};

const dayMs = 24 * 60 * 60 * 1000;

export const defaultRewardProgramConfig: RewardProgramConfig = {
  pointValueCents: 1,
  referralFeePercent: 10,
  redemptionMaxPercentOfEligibleSubtotal: 10,
  availabilityWaitingDays: 0,
  expirationMonthsWithoutActivity: 18,
  expirationReminderDays: [7],
  free: {
    level: 'free',
    label: 'FLAIRO Resident',
    monthlyFeeCents: 0,
    basePointsPerDollar: 0,
    redemptionThresholdPoints: 0,
  },
  plus: {
    level: 'plus',
    label: 'FLAIRO PLUS',
    monthlyFeeCents: 500,
    basePointsPerDollar: 2,
    redemptionThresholdPoints: 250,
  },
  serviceRules: [
    {
      code: 'recurring_housekeeping',
      label: 'Recurring housekeeping visit',
      category: 'Home Care',
      freeCompletionBonus: 0,
      plusCompletionBonus: 200,
      recurringEligible: true,
      active: true,
    },
    {
      code: 'groomer_appointment',
      label: 'Groomer appointment',
      category: 'Pet Care',
      freeCompletionBonus: 0,
      plusCompletionBonus: 50,
      recurringEligible: false,
      active: true,
    },
    {
      code: 'dog_walking',
      label: 'Dog-walking appointment',
      category: 'Pet Care',
      freeCompletionBonus: 0,
      plusCompletionBonus: 20,
      recurringEligible: true,
      active: true,
    },
    {
      code: 'pet_sitter_drop_in',
      label: 'Pet-sitter drop-in',
      category: 'Pet Care',
      freeCompletionBonus: 0,
      plusCompletionBonus: 20,
      recurringEligible: true,
      active: true,
    },
    {
      code: 'move_out_cleaning',
      label: 'Move-out cleaning',
      category: 'Move-out',
      freeCompletionBonus: 0,
      plusCompletionBonus: 200,
      recurringEligible: false,
      active: true,
    },
    {
      code: 'moving_service',
      label: 'Moving service',
      category: 'Moving',
      freeCompletionBonus: 0,
      plusCompletionBonus: 300,
      recurringEligible: false,
      active: true,
    },
    {
      code: 'move_out_touch_up_painting',
      label: 'Move-out touch-up painting',
      category: 'Move-out',
      freeCompletionBonus: 0,
      plusCompletionBonus: 200,
      recurringEligible: false,
      active: true,
    },
    {
      code: 'move_out_full_painting',
      label: 'Move-out full painting',
      category: 'Move-out',
      freeCompletionBonus: 0,
      plusCompletionBonus: 400,
      recurringEligible: false,
      active: true,
    },
    {
      code: 'move_out_deep_cleaning',
      label: 'Move-out deep cleaning',
      category: 'Move-out',
      freeCompletionBonus: 0,
      plusCompletionBonus: 250,
      recurringEligible: false,
      active: true,
    },
    {
      code: 'handyman_work',
      label: 'Handyman work',
      category: 'Home Care',
      freeCompletionBonus: 0,
      plusCompletionBonus: 100,
      recurringEligible: false,
      active: true,
    },
    {
      code: 'junk_hauling',
      label: 'Junk-hauling service',
      category: 'Home Care',
      freeCompletionBonus: 0,
      plusCompletionBonus: 150,
      recurringEligible: false,
      active: true,
    },
  ],
  recurringMilestones: [
    { completedAppointments: 3, freeBonus: 0, plusBonus: 200 },
    { completedAppointments: 6, freeBonus: 0, plusBonus: 500 },
    { completedAppointments: 12, freeBonus: 0, plusBonus: 1000 },
  ],
};

export function clampConfig(config: RewardProgramConfig): RewardProgramConfig {
  return {
    ...config,
    availabilityWaitingDays: Math.max(0, Math.min(30, config.availabilityWaitingDays)),
    expirationMonthsWithoutActivity: Math.max(1, config.expirationMonthsWithoutActivity),
    redemptionMaxPercentOfEligibleSubtotal: Math.max(
      0,
      Math.min(100, config.redemptionMaxPercentOfEligibleSubtotal),
    ),
    referralFeePercent: Math.max(0, Math.min(100, config.referralFeePercent)),
  };
}

export function cents(value: number): number {
  return Math.round(value * 100);
}

export function dollars(centsValue: number): string {
  return `$${(centsValue / 100).toFixed(2)}`;
}

export function pointsToCreditCents(points: number, config = defaultRewardProgramConfig): number {
  return Math.max(0, Math.floor(points * config.pointValueCents));
}

export function creditCentsToPoints(centsValue: number, config = defaultRewardProgramConfig): number {
  return Math.max(0, Math.floor(centsValue / config.pointValueCents));
}

export function membershipLevelFromStatus(status: string | null | undefined): MembershipLevel {
  return status === 'Active' || status === 'Trial' ? 'plus' : 'free';
}

export function membershipRule(level: MembershipLevel, config = defaultRewardProgramConfig): MembershipRewardRule {
  return level === 'plus' ? config.plus : config.free;
}

export function serviceRule(
  code: EligibleServiceCode,
  config = defaultRewardProgramConfig,
): ServiceRewardRule {
  const rule = config.serviceRules.find((item) => item.code === code);
  if (!rule) throw new Error(`Missing reward rule for ${code}`);
  return rule;
}

export function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(dateISO: string, months: number): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function calculateEarnedPoints({
  completedRecurringCountIncludingThis = 0,
  config = defaultRewardProgramConfig,
  eligibleSubtotalCents,
  membershipLevel,
  promotionMultiplier = 1,
  serviceCode,
}: {
  completedRecurringCountIncludingThis?: number;
  config?: RewardProgramConfig;
  eligibleSubtotalCents: number;
  membershipLevel: MembershipLevel;
  promotionMultiplier?: number;
  serviceCode: EligibleServiceCode;
}): EarnedPointBreakdown {
  const safeConfig = clampConfig(config);
  const rule = serviceRule(serviceCode, safeConfig);
  if (membershipLevel !== 'plus') {
    return {
      basePoints: 0,
      completionBonusPoints: 0,
      plusAdditionalPoints: 0,
      recurringBonusPoints: 0,
      totalPoints: 0,
    };
  }
  const memberRule = membershipRule(membershipLevel, safeConfig);
  const subtotalDollars = Math.floor(Math.max(eligibleSubtotalCents, 0) / 100);
  const basePoints = Math.floor(subtotalDollars * memberRule.basePointsPerDollar * promotionMultiplier);
  const completionBonusPoints = rule.plusCompletionBonus;
  const recurringBonusPoints = calculateRecurringMilestoneBonus({
    completedRecurringCountIncludingThis,
    config: safeConfig,
    membershipLevel,
    serviceCode,
  });

  const totalPoints = basePoints + completionBonusPoints + recurringBonusPoints;

  return {
    basePoints,
    completionBonusPoints,
    recurringBonusPoints,
    totalPoints,
    plusAdditionalPoints: totalPoints,
  };
}

export function calculateRecurringMilestoneBonus({
  completedRecurringCountIncludingThis,
  config = defaultRewardProgramConfig,
  membershipLevel,
  serviceCode,
}: {
  completedRecurringCountIncludingThis: number;
  config?: RewardProgramConfig;
  membershipLevel: MembershipLevel;
  serviceCode: EligibleServiceCode;
}): number {
  const rule = serviceRule(serviceCode, config);
  if (membershipLevel !== 'plus') return 0;
  if (!rule.recurringEligible) return 0;
  const milestone = config.recurringMilestones.find(
    (item) => item.completedAppointments === completedRecurringCountIncludingThis,
  );
  if (!milestone) return 0;
  return milestone.plusBonus;
}

export function recurringProgress({
  completedRecurringAppointments,
  config = defaultRewardProgramConfig,
}: {
  completedRecurringAppointments: number;
  config?: RewardProgramConfig;
}): RecurringProgress {
  const nextMilestone = config.recurringMilestones.find(
    (item) => item.completedAppointments > completedRecurringAppointments,
  );
  const remaining = nextMilestone
    ? Math.max(nextMilestone.completedAppointments - completedRecurringAppointments, 0)
    : 0;

  return {
    completed: completedRecurringAppointments,
    nextMilestone,
    remainingToNextMilestone: remaining,
    message: nextMilestone
      ? `Complete ${remaining} more recurring service${remaining === 1 ? '' : 's'} to unlock your next loyalty bonus.`
      : 'All configured recurring-service milestones are complete.',
  };
}

export function calculateCheckoutQuote({
  availablePoints,
  config = defaultRewardProgramConfig,
  ineligibleFeesCents = 0,
  membershipLevel,
  originalEligibleSubtotalCents,
  requestedPoints,
  selectedServicePriceCents,
}: {
  availablePoints: number;
  config?: RewardProgramConfig;
  ineligibleFeesCents?: number;
  membershipLevel: MembershipLevel;
  originalEligibleSubtotalCents: number;
  requestedPoints: number;
  selectedServicePriceCents: number;
}): CheckoutQuote {
  const safeConfig = clampConfig(config);
  const memberRule = membershipRule(membershipLevel, safeConfig);
  const eligibleSubtotalCents = Math.max(originalEligibleSubtotalCents, 0);
  const referralFeeCents = Math.round(eligibleSubtotalCents * (safeConfig.referralFeePercent / 100));
  const maxCreditByPercentCents = Math.floor(
    eligibleSubtotalCents * (safeConfig.redemptionMaxPercentOfEligibleSubtotal / 100),
  );
  const maxPointsByCap = creditCentsToPoints(maxCreditByPercentCents, safeConfig);
  const thresholdEligiblePoints = membershipLevel === 'plus' && availablePoints >= memberRule.redemptionThresholdPoints
    ? Math.max(availablePoints, 0)
    : 0;
  const maxRedeemablePoints = Math.min(thresholdEligiblePoints, maxPointsByCap);
  const appliedPoints = Math.max(0, Math.min(requestedPoints, maxRedeemablePoints));
  const residentCreditCents = pointsToCreditCents(appliedPoints, safeConfig);
  const creditOffsetCents = Math.min(residentCreditCents, referralFeeCents);
  const netReferralFeeOwedCents = Math.max(referralFeeCents - creditOffsetCents, 0);
  const residentPaysProviderCents = Math.max(selectedServicePriceCents - residentCreditCents, 0) + ineligibleFeesCents;

  return {
    originalServicePriceCents: eligibleSubtotalCents,
    selectedServicePriceCents,
    eligibleSubtotalCents,
    memberSavingsCents: Math.max(eligibleSubtotalCents - selectedServicePriceCents, 0),
    requestedPoints,
    appliedPoints,
    residentCreditCents,
    maxRedeemablePoints,
    residentPaysProviderCents,
    grossReferralFeeCents: referralFeeCents,
    creditOffsetCents,
    netReferralFeeOwedCents,
    providerRetainedAfterReferralCents: Math.max(residentPaysProviderCents - netReferralFeeOwedCents, 0),
  };
}

export function createEarningEntries({
  bookingId,
  breakdown,
  config = defaultRewardProgramConfig,
  createdAt = todayISO(),
  residentId,
  serviceCode,
  status = 'pending',
}: {
  bookingId: string;
  breakdown: EarnedPointBreakdown;
  config?: RewardProgramConfig;
  createdAt?: string;
  residentId: string;
  serviceCode: EligibleServiceCode;
  status?: 'pending' | 'available';
}): RewardLedgerEntry[] {
  const availableAt = status === 'available' ? createdAt : addDays(createdAt, clampConfig(config).availabilityWaitingDays);
  const expiresAt = addMonths(availableAt, config.expirationMonthsWithoutActivity);
  const entries: RewardLedgerEntry[] = [];

  if (breakdown.basePoints > 0) {
    entries.push({
      id: `${bookingId}-base`,
      residentId,
      bookingId,
      serviceCode,
      type: 'base_earn',
      direction: 'credit',
      status,
      points: breakdown.basePoints,
      reason: 'Eligible service subtotal',
      source: 'booking',
      createdAt,
      availableAt,
      expiresAt,
      plusAdditionalPoints: breakdown.plusAdditionalPoints,
    });
  }

  if (breakdown.completionBonusPoints > 0) {
    entries.push({
      id: `${bookingId}-completion`,
      residentId,
      bookingId,
      serviceCode,
      type: 'completion_bonus',
      direction: 'credit',
      status,
      points: breakdown.completionBonusPoints,
      reason: `${serviceRule(serviceCode, config).label} completion bonus`,
      source: 'booking_completion',
      createdAt,
      availableAt,
      expiresAt,
    });
  }

  if (breakdown.recurringBonusPoints > 0) {
    entries.push({
      id: `${bookingId}-recurring`,
      residentId,
      bookingId,
      serviceCode,
      type: 'recurring_bonus',
      direction: 'credit',
      status,
      points: breakdown.recurringBonusPoints,
      reason: 'Recurring-service loyalty milestone',
      source: 'recurring_milestone',
      createdAt,
      availableAt,
      expiresAt,
    });
  }

  return entries;
}

export function createRedemptionEntry({
  bookingId,
  createdAt = todayISO(),
  residentCreditCents,
  residentId,
  points,
}: {
  bookingId: string;
  createdAt?: string;
  residentCreditCents: number;
  residentId: string;
  points: number;
}): RewardLedgerEntry {
  return {
    id: `${bookingId}-redeem`,
    residentId,
    bookingId,
    type: 'redemption',
    direction: 'debit',
    status: 'redeemed',
    points,
    reason: `${dollars(residentCreditCents)} FLAIRO service credit`,
    source: 'checkout',
    createdAt,
    dollarValueCents: residentCreditCents,
  };
}

export function createReversalEntry({
  bookingId,
  createdAt = todayISO(),
  points,
  reason,
  relatedLedgerEntryId,
  residentId,
}: {
  bookingId: string;
  createdAt?: string;
  points: number;
  reason: string;
  relatedLedgerEntryId?: string;
  residentId: string;
}): RewardLedgerEntry {
  return {
    id: `${bookingId}-reversal-${createdAt}`,
    residentId,
    bookingId,
    type: 'reversal',
    direction: 'debit',
    status: 'reversed',
    points,
    reason,
    source: 'refund_or_dispute',
    createdAt,
    relatedLedgerEntryId,
  };
}

export function createManualAdjustmentEntry({
  adminId,
  createdAt = todayISO(),
  points,
  reason,
  residentId,
}: {
  adminId: string;
  createdAt?: string;
  points: number;
  reason: string;
  residentId: string;
}): RewardLedgerEntry {
  return {
    id: `ADJ-${createdAt}-${Math.abs(points)}`,
    residentId,
    type: 'manual_adjustment',
    direction: points >= 0 ? 'credit' : 'debit',
    status: points >= 0 ? 'available' : 'reversed',
    points: Math.abs(points),
    reason,
    source: 'admin_adjustment',
    createdAt,
    availableAt: createdAt,
    expiresAt: points >= 0
      ? addMonths(createdAt, defaultRewardProgramConfig.expirationMonthsWithoutActivity)
      : undefined,
    adminId,
  };
}

export function createExpirationEntries({
  createdAt = todayISO(),
  entries,
}: {
  createdAt?: string;
  entries: RewardLedgerEntry[];
}): RewardLedgerEntry[] {
  return entries
    .filter((entry) => (
      entry.direction === 'credit'
      && entry.status === 'available'
      && entry.expiresAt
      && entry.expiresAt <= createdAt
    ))
    .map((entry) => ({
      id: `${entry.id}-expired`,
      residentId: entry.residentId,
      bookingId: entry.bookingId,
      serviceCode: entry.serviceCode,
      type: 'expiration' as const,
      direction: 'debit' as const,
      status: 'expired' as const,
      points: entry.points,
      reason: 'Plume Points expired after configured inactivity period',
      source: 'expiration_batch',
      createdAt,
      relatedLedgerEntryId: entry.id,
    }));
}

export function makeBookingPointsAvailable({
  bookingId,
  entries,
}: {
  bookingId: string;
  entries: RewardLedgerEntry[];
}): RewardLedgerEntry[] {
  return entries.map((entry) => (
    entry.bookingId === bookingId && entry.direction === 'credit' && entry.status === 'pending'
      ? { ...entry, status: 'available' as const }
      : entry
  ));
}

export function summarizeRewardAccount(
  entries: RewardLedgerEntry[],
  config = defaultRewardProgramConfig,
): RewardAccountSummary {
  const summary: RewardAccountSummary = {
    pendingPoints: 0,
    availablePoints: 0,
    redeemedPoints: 0,
    reversedPoints: 0,
    expiredPoints: 0,
    lifetimePointsEarned: 0,
    lifetimeRewardsRedeemedCents: 0,
    outstandingLiabilityCents: 0,
    pendingLiabilityCents: 0,
    plusAdditionalPointsEarned: 0,
    negativeBalance: false,
  };

  entries.forEach((entry) => {
    if (entry.direction === 'credit') {
      if (entry.status === 'pending') summary.pendingPoints += entry.points;
      if (entry.status === 'available') summary.availablePoints += entry.points;
      if (entry.status !== 'reversed') summary.lifetimePointsEarned += entry.points;
      summary.plusAdditionalPointsEarned += entry.plusAdditionalPoints ?? 0;
      return;
    }

    if (entry.status === 'redeemed') {
      summary.redeemedPoints += entry.points;
      summary.availablePoints -= entry.points;
      summary.lifetimeRewardsRedeemedCents += entry.dollarValueCents ?? pointsToCreditCents(entry.points, config);
    }
    if (entry.status === 'reversed') {
      summary.reversedPoints += entry.points;
      summary.availablePoints -= entry.points;
    }
    if (entry.status === 'expired') {
      summary.expiredPoints += entry.points;
      summary.availablePoints -= entry.points;
    }
  });

  summary.negativeBalance = summary.availablePoints < 0;
  summary.outstandingLiabilityCents = pointsToCreditCents(Math.max(summary.availablePoints, 0), config);
  summary.pendingLiabilityCents = pointsToCreditCents(summary.pendingPoints, config);

  return summary;
}

export function expirationReminderEntries({
  entries,
  config = defaultRewardProgramConfig,
  today = todayISO(),
}: {
  entries: RewardLedgerEntry[];
  config?: RewardProgramConfig;
  today?: string;
}): RewardLedgerEntry[] {
  const current = new Date(`${today}T00:00:00.000Z`).getTime();
  return entries.filter((entry) => {
    if (entry.direction !== 'credit' || entry.status !== 'available' || !entry.expiresAt) return false;
    const expires = new Date(`${entry.expiresAt}T00:00:00.000Z`).getTime();
    const days = Math.ceil((expires - current) / dayMs);
    return config.expirationReminderDays.includes(days);
  });
}

export function rewardRiskFlags({
  alreadyCompletedBookingIds,
  checkout,
  eligibleService,
  requestedCompletionBookingId,
}: {
  alreadyCompletedBookingIds: string[];
  checkout: CheckoutQuote;
  eligibleService: boolean;
  requestedCompletionBookingId?: string;
}): RewardRiskFlag[] {
  const flags: RewardRiskFlag[] = [];

  if (!eligibleService) {
    flags.push({
      code: 'ineligible_service',
      severity: 'block',
      message: 'Plume Points cannot be earned or redeemed on an ineligible service.',
    });
  }

  if (checkout.appliedPoints < checkout.requestedPoints) {
    flags.push({
      code: 'redemption_capped',
      severity: 'review',
      message: 'Requested redemption exceeded balance, threshold, or configured referral-fee cap.',
    });
  }

  if (checkout.residentCreditCents > checkout.grossReferralFeeCents) {
    flags.push({
      code: 'credit_exceeds_referral_fee',
      severity: 'block',
      message: 'Service credit would reduce provider compensation beyond the referral-fee structure.',
    });
  }

  if (requestedCompletionBookingId && alreadyCompletedBookingIds.includes(requestedCompletionBookingId)) {
    flags.push({
      code: 'duplicate_completion',
      severity: 'block',
      message: 'Duplicate completion confirmations are blocked until reviewed by an administrator.',
    });
  }

  return flags;
}
