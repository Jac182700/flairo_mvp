# Flairo MVP

Flairo is a resident concierge and benefits marketplace for renters.

## MVP scope
- Mobile-first resident home dashboard
- Resident self-registration without a PMS dependency
- Community and unit capture with bedroom/bathroom profile data
- Home Care category with Occupied Cleaning as the priority booking flow
- Bedroom/bathroom-driven Standard and FLAIRO PLUS pricing
- Membership-status validation before PLUS pricing is applied
- FLAIRO Plume Points ledger with pending, available, redeemed, reversed, and expired point statuses
- PLUS earning rules with 2x base points, service-completion bonuses, recurring milestones, and redemption thresholds
- Checkout Plume Point credit math with 100 points = $1, 10% subtotal redemption cap, provider payment, gross referral fee, credit offset, and net FLAIRO fee
- Booking/request history with historical price snapshots
- Vendor payment routing model where the resident pays the vendor
- Provider reporting for completed bookings, eligible revenue, 10% referral fees, reward credits, discount funding, and settlement status
- Configurable vendor agreement, PLUS pricing, reward rules, expiration, and FLAIRO revenue obligation model
- Admin portal for services, pricing, vendors, bookings, Plume Points, provider settlement, customer experience, reports, and audit trail
- Supabase migration blueprint for Plume Points, memberships, bookings, provider fees, settlements, adjustments, customer experience surveys, notifications, risk flags, and RLS policies

## Brand direction
- Matte charcoal mobile shell with flamingo pink, dusty pink, gold accent, and warm ivory
- Flairo logo and badge imagery from the supplied brand assets
- Premium, high-contrast card system inspired by the hexagon badge and app icon concepts

## Recommended production stack
- React Native + Expo
- TypeScript
- Supabase (Auth, Postgres, Storage, Realtime)
- Stripe for one-time and recurring payments
- Expo Notifications
- Mapbox or Google Maps later for provider routing

## Run
1. Install Node.js 20+
2. `npm install`
3. `npx expo start`

## Test the Plume Points workflows

Run the app checks:

```sh
npx tsc --noEmit
```

Run the Plume Points workflow self-test:

```sh
npx tsc --target ES2020 --module commonjs --outDir /tmp/flairo_rewards_test src/rewardsSystem.ts src/rewardsSystem.selftest.ts --esModuleInterop --skipLibCheck --strict
node /tmp/flairo_rewards_test/rewardsSystem.selftest.js
```

In Expo Go, create or use the default resident profile, open Care, book a service,
confirm completion from Activity, apply Plume Point credits after reaching threshold,
and use Admin -> Plume Points/Provider/Experience/Reports/Audit to inspect the resulting ledger
and settlement calculations.

The current prototype is still self-contained in `App.tsx` for fast iteration,
with production database structure prepared in `supabase/flairo_rewards_schema.sql`.
Supabase Auth, payment processing, provider payout/collection, and notification
delivery still need live-project configuration before launch.

## Phase 1 plan

See `FLAIRO_PHASE_1_PLATFORM_PLAN.md` for the information architecture, database
schema direction, payment architecture, admin portal structure, and business
decisions that still need to be finalized.
