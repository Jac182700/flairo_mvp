import {
  calculateCheckoutQuote,
  calculateEarnedPoints,
  cents,
  createEarningEntries,
  createExpirationEntries,
  createManualAdjustmentEntry,
  createRedemptionEntry,
  createReversalEntry,
  defaultRewardProgramConfig,
  expirationReminderEntries,
  makeBookingPointsAvailable,
  membershipLevelFromStatus,
  rewardRiskFlags,
  serviceRule,
  summarizeRewardAccount,
  type RewardLedgerEntry,
} from './rewardsSystem';

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function expectTrue(label: string, value: boolean) {
  if (!value) throw new Error(`${label}: expected true`);
}

const config = defaultRewardProgramConfig;

config.serviceRules.forEach((rule) => {
  const free = calculateEarnedPoints({
    config,
    eligibleSubtotalCents: cents(200),
    membershipLevel: 'free',
    serviceCode: rule.code,
  });
  const plus = calculateEarnedPoints({
    config,
    eligibleSubtotalCents: cents(200),
    membershipLevel: 'plus',
    serviceCode: rule.code,
  });

  expectEqual(`${rule.code} free bonus`, free.completionBonusPoints, rule.freeCompletionBonus);
  expectEqual(`${rule.code} PLUS bonus`, plus.completionBonusPoints, rule.plusCompletionBonus);
  expectEqual(`${rule.code} free total`, free.totalPoints, 0);
  expectEqual(`${rule.code} PLUS total`, plus.totalPoints, 400 + rule.plusCompletionBonus);
});

const freeHousekeeping = calculateEarnedPoints({
  config,
  eligibleSubtotalCents: cents(150),
  membershipLevel: 'free',
  serviceCode: 'recurring_housekeeping',
});
expectEqual('free resident does not earn Plume Points', freeHousekeeping.totalPoints, 0);

const plusHousekeeping = calculateEarnedPoints({
  config,
  eligibleSubtotalCents: cents(150),
  membershipLevel: 'plus',
  serviceCode: 'recurring_housekeeping',
});
expectEqual('PLUS housekeeping example', plusHousekeeping.totalPoints, 500);
expectEqual('PLUS Plume Points retained as ledger metadata', plusHousekeeping.plusAdditionalPoints, 500);

expectEqual('Active status earns as PLUS', membershipLevelFromStatus('Active'), 'plus');
expectEqual('Cancelled status reverts future earning', membershipLevelFromStatus('Cancelled'), 'free');

const milestone = calculateEarnedPoints({
  completedRecurringCountIncludingThis: 3,
  config,
  eligibleSubtotalCents: cents(150),
  membershipLevel: 'plus',
  serviceCode: 'recurring_housekeeping',
});
expectEqual('third recurring visit includes PLUS milestone', milestone.recurringBonusPoints, 200);
expectTrue('housekeeping is recurring eligible', serviceRule('recurring_housekeeping', config).recurringEligible);

const pendingEntries = createEarningEntries({
  bookingId: 'BK-001',
  breakdown: plusHousekeeping,
  config,
  createdAt: '2026-08-26',
  residentId: 'resident-1',
  serviceCode: 'recurring_housekeeping',
  status: 'pending',
});
let ledger: RewardLedgerEntry[] = pendingEntries;
expectEqual('pending points before confirmation', summarizeRewardAccount(ledger, config).pendingPoints, 500);
ledger = makeBookingPointsAvailable({ bookingId: 'BK-001', entries: ledger });
expectEqual('available points after provider confirmation', summarizeRewardAccount(ledger, config).availablePoints, 500);

const launchBonus = createManualAdjustmentEntry({
  adminId: 'admin-1',
  createdAt: '2026-08-26',
  points: 1250,
  reason: 'Launch bonus credit',
  residentId: 'resident-1',
});
ledger = [launchBonus, ...ledger];

const quote = calculateCheckoutQuote({
  availablePoints: summarizeRewardAccount(ledger, config).availablePoints,
  config,
  membershipLevel: 'plus',
  originalEligibleSubtotalCents: cents(200),
  requestedPoints: 1000,
  selectedServicePriceCents: cents(200),
});
expectEqual('checkout applied requested points', quote.appliedPoints, 1000);
expectEqual('checkout resident credit', quote.residentCreditCents, 1000);
expectEqual('checkout resident pays provider', quote.residentPaysProviderCents, 19000);
expectEqual('gross referral fee uses original eligible subtotal', quote.grossReferralFeeCents, 2000);
expectEqual('credit offset reduces FLAIRO fee', quote.creditOffsetCents, 1000);
expectEqual('net referral fee after reward credit', quote.netReferralFeeOwedCents, 1000);
ledger = [
  createRedemptionEntry({
    bookingId: 'BK-002',
    createdAt: '2026-08-26',
    points: quote.appliedPoints,
    residentCreditCents: quote.residentCreditCents,
    residentId: 'resident-1',
  }),
  ...ledger,
];
expectEqual('redemption reduces available points', summarizeRewardAccount(ledger, config).availablePoints, 750);

const plusQuote = calculateCheckoutQuote({
  availablePoints: 0,
  config,
  membershipLevel: 'plus',
  originalEligibleSubtotalCents: cents(200),
  requestedPoints: 0,
  selectedServicePriceCents: cents(180),
});
expectEqual('PLUS pricing does not lower referral-fee base', plusQuote.grossReferralFeeCents, 2000);
expectEqual('PLUS member savings recorded', plusQuote.memberSavingsCents, 2000);

ledger = [
  createReversalEntry({
    bookingId: 'BK-001',
    createdAt: '2026-08-27',
    points: 500,
    reason: 'Refund reversed earned points',
    residentId: 'resident-1',
  }),
  ...ledger,
];
expectEqual('refund reversal removes earned points', summarizeRewardAccount(ledger, config).reversedPoints, 500);

const expiring: RewardLedgerEntry = {
  ...launchBonus,
  id: 'expiring-credit',
  points: 300,
  createdAt: '2026-02-26',
  availableAt: '2026-02-26',
  expiresAt: '2026-09-02',
};
expectEqual('7-day expiration reminder detected', expirationReminderEntries({
  entries: [expiring],
  config,
  today: '2026-08-26',
}).length, 1);
expectEqual('expiration creates debit entry', createExpirationEntries({
  createdAt: '2026-09-03',
  entries: [expiring],
}).length, 1);

const negativeLedger = [
  createReversalEntry({
    bookingId: 'BK-NEG',
    createdAt: '2026-08-28',
    points: 2000,
    reason: 'Chargeback after point spend',
    residentId: 'resident-1',
  }),
  ...ledger,
];
expectTrue('negative balance is allowed after reversal', summarizeRewardAccount(negativeLedger, config).negativeBalance);

const cappedQuote = calculateCheckoutQuote({
  availablePoints: 400,
  config,
  membershipLevel: 'plus',
  originalEligibleSubtotalCents: cents(200),
  requestedPoints: 5000,
  selectedServicePriceCents: cents(200),
});
const flags = rewardRiskFlags({
  alreadyCompletedBookingIds: ['BK-003'],
  checkout: cappedQuote,
  eligibleService: false,
  requestedCompletionBookingId: 'BK-003',
});
expectTrue('fraud controls flag ineligible service', flags.some((flag) => flag.code === 'ineligible_service'));
expectTrue('fraud controls flag excessive redemption', flags.some((flag) => flag.code === 'redemption_capped'));
expectTrue('fraud controls block duplicate completion', flags.some((flag) => flag.code === 'duplicate_completion'));

console.log('FLAIRO Plume Points self-test passed: 12 workflow groups verified.');
