# FLAIRO Phase 1 Platform Plan

This document translates the enhancement request into a practical first implementation path. The attached request is treated as product direction; the app still needs production backend, payments, security, and store-release work before launch.

## 1. Updated Information Architecture

- Resident app: registration, home dashboard, home care marketplace, booking activity, rewards wallet, profile.
- Admin portal: dashboard, communities, services, pricing, vendors, bookings, settlement ledger, reports, audit history.
- Vendor portal: assigned bookings, availability, profile, documents, settlement statements.
- Finance portal: vendor obligations, collections, refunds, adjustments, reports.

## 2. Resident Registration Flow

Residents create their own account without PMS dependency. Required data: first name, last name, email, mobile phone, password, community, unit number, bedrooms, bathrooms. Optional future fields include building, floor, move-in date, pets, communication preference, and accessibility/service preferences.

## 3. Community And Unit Structure

Communities are admin-managed records. Units can be created progressively when residents register. The system should not require preloaded unit data. Duplicate active unit registrations should be flagged for review while still allowing legitimate roommate/household scenarios.

## 4. Home Care Service Structure

Home Care is a primary category. Phase 1 prioritizes Occupied Cleaning, with related future services: recurring cleaning, deep cleaning, move-in cleaning, move-out cleaning, carpet cleaning, upholstery cleaning, window cleaning, organization, laundry/linen, and minor household help.

## 5. Occupied Cleaning Booking Flow

The resident selects Occupied Cleaning, the app reads the stored bed/bath profile, calculates Standard and FLAIRO PLUS prices, optionally applies eligible rewards, snapshots the price, and creates a booking.

## 6. Standard Vs. PLUS Pricing Architecture

Each service can define pricing by unit configuration, community, vendor, membership status, effective date, and promotion. PLUS prices are available only when membership status is Active or Trial.

## 7. Proposed Vendor-Payment Architecture

Payments should be modeled as Resident -> Vendor. FLAIRO tracks a separate contractual revenue obligation from each vendor. The payment layer should be provider-agnostic until a processor is finalized.

## 8. Vendor Commercial Agreement Data Model

Vendor agreements should include standard fee %, PLUS fee %, optional flat booking fee, resident-facing standard price, PLUS price, vendor net, effective date, expiration date, community/service overrides, promotions, status, notes, and agreement files.

## 9. Rewards And Points Logic

Track Plume Points issued, redeemed, current balance, transaction reason, booking association, redemption association, discount value, expiration, and admin-configured rules such as points per dollar, promotions, referrals, membership bonuses, thresholds, caps, eligible services, and excluded services. The app now uses a ledger model with pending, available, redeemed, reversed, and expired statuses instead of mutating a single balance. Current local rules make Plume Points a FLAIRO PLUS benefit.

## 10. Vendor Settlement Ledger

Every booking creates a settlement ledger entry with vendor, booking, service amount, FLAIRO fee %, discount treatment, points treatment, net amount owed to FLAIRO, paid/unpaid status, settlement method, adjustment, notes, and statement period.

## 11. Admin Portal Navigation

Primary admin sections: Dashboard, Communities, Services, Pricing, Vendors, Bookings, Plume Points, Provider, Customer Experience, Reports, Audit.

## 12. Service Management Screen

Admins need controls to create/edit/disable services, set category, upload images, define required resident fields, assign vendors and communities, set add-ons, lead times, duration, availability, blackout dates, cancellation rules, and promotions.

## 13. Pricing Management Screen

Pricing must be configurable outside code. Track Standard price, PLUS price, vendor rate, FLAIRO fee, discount treatment, bedroom/bath tiers, community/geography/date overrides, effective dates, changed by, change timestamp, and history.

## 14. Booking Management Screen

Admins need booking ID, resident, community, unit, vendor, service, booking date, service date, standard price, PLUS price, discount, points redeemed, final resident payment, vendor amount, FLAIRO revenue, payment status, and booking status.

## 15. Vendor Management Screen

Track business profile, contacts, service area, communities, services, pricing, PLUS pricing, FLAIRO commission, payment connection, agreement, insurance, license, W-9, status, rating, performance, revenue, and generated FLAIRO revenue.

## 16. Reporting Dashboard

Report booking performance, membership conversion/savings, vendor performance, rewards liability, and financial totals. Metrics must drill down to source bookings.

## 17. Database/Schema Changes Required

Core tables: communities, units, residents, memberships, services, service_pricing_tiers, vendors, vendor_agreements, bookings, payment_intents, reward_accounts, reward_transactions, settlement_ledger_entries, admin_users, audit_events, files.

Implemented schema blueprint: `supabase/flairo_rewards_schema.sql` defines Plume Points, PLUS memberships, provider pricing, booking snapshots, completion verification, reward redemptions, provider fee transactions, settlements, refunds/disputes, admin adjustments, expiration batches, reminder notifications, customer experience surveys, risk flags, dashboard views, and Supabase RLS policies.

## 18. Business Decisions Required

- Payment processor and connected-account model.
- Whether FLAIRO or vendors absorb each reward/discount type.
- Default vendor agreement economics by service.
- PLUS membership price, trial period, cancellation policy, and eligibility.
- Admin roles and approval controls.
- Community onboarding/verification policy.
- Refund/dispute handling model.
- Accounting treatment for outstanding rewards liability.

## Phase 1 Prototype Scope Implemented In App

- Self-registration with community/unit/bed/bath capture.
- Basic unit validation and duplicate-unit review flag.
- Eligible rewards service catalog covering housekeeping, pet care, move-out cleaning, moving, painting, handyman work, and junk hauling.
- Occupied Cleaning/Recurring Housekeeping service pricing from stored unit configuration.
- Standard and PLUS resident prices with savings display.
- PLUS eligibility status check.
- Plume Point credit toggle with configurable redemption cap, threshold, and provider referral-fee offset.
- PLUS earning rules with service-completion bonuses and recurring-service milestone bonuses.
- Pending points that become available after provider completion/payment confirmation.
- Refund/dispute reversal flow that can produce a negative reward balance.
- Point-expiration batch action and configurable reminder detection.
- Booking price snapshot.
- Booking snapshot preserves original eligible subtotal, selected price, resident credit, provider payment, gross 10% referral fee, credit offset, net amount owed to FLAIRO, and provider retained amount.
- Provider settlement ledger calculation and provider portal summary.
- Admin dashboard with services, pricing, bookings, vendors, Plume Point controls, provider settlement, customer experience, reports, and audit trail.
- Plume Points workflow self-test in `src/rewardsSystem.selftest.ts`.
