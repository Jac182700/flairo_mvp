-- FLAIRO Rewards and provider-settlement schema for Supabase Postgres.
-- Apply in a Supabase migration after Auth is enabled. All exposed tables use RLS.

create extension if not exists pgcrypto;

do $$ begin
  create type public.membership_level as enum ('free', 'plus');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.membership_status as enum ('trial', 'active', 'past_due', 'cancelled', 'expired', 'none');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reward_service_code as enum (
    'recurring_housekeeping',
    'groomer_appointment',
    'dog_walking',
    'pet_sitter_drop_in',
    'move_out_cleaning',
    'moving_service',
    'move_out_touch_up_painting',
    'move_out_full_painting',
    'move_out_deep_cleaning',
    'handyman_work',
    'junk_hauling'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.point_status as enum ('pending', 'available', 'redeemed', 'reversed', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reward_transaction_type as enum (
    'base_earn',
    'completion_bonus',
    'recurring_bonus',
    'redemption',
    'reversal',
    'expiration',
    'manual_adjustment'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ledger_direction as enum ('credit', 'debit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.discount_funding_source as enum ('provider', 'flairo', 'shared', 'referral_fee_offset');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum ('requested', 'scheduled', 'completed', 'cancelled', 'refunded', 'disputed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.settlement_status as enum ('not_started', 'unpaid', 'offset_applied', 'paid', 'disputed', 'written_off');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_type as enum ('completion', 'payment', 'cancellation', 'refund', 'chargeback');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.audit_action as enum ('create', 'update', 'delete', 'manual_adjustment', 'completion_confirmed', 'refund_recorded', 'config_changed');
exception when duplicate_object then null;
end $$;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text not null,
  state text not null,
  zip text,
  active boolean not null default true,
  plus_available boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  unit_number text not null,
  bedrooms numeric(3,1) not null default 1,
  bathrooms numeric(3,1) not null default 1,
  verification_status text not null default 'resident_self_verified',
  duplicate_review boolean not null default false,
  created_at timestamptz not null default now(),
  unique (community_id, unit_number)
);

create table if not exists public.resident_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id),
  unit_id uuid not null references public.units(id),
  first_name text not null,
  last_name text not null,
  email text not null,
  mobile text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_email text,
  contact_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_users (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'provider_admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (provider_id, user_id)
);

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  level public.membership_level not null unique,
  label text not null,
  monthly_fee_cents integer not null default 0 check (monthly_fee_cents >= 0),
  base_points_per_dollar numeric(8,2) not null check (base_points_per_dollar >= 0),
  redemption_threshold_points integer not null check (redemption_threshold_points >= 0),
  benefits jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.resident_memberships (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.resident_profiles(id) on delete cascade,
  plan_level public.membership_level not null default 'free',
  status public.membership_status not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  code public.reward_service_code not null unique,
  title text not null,
  category text not null,
  active boolean not null default true,
  recurring_eligible boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_agreements (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  referral_fee_percent numeric(6,3) not null default 10 check (referral_fee_percent >= 0 and referral_fee_percent <= 100),
  plus_pricing_confirmed boolean not null default false,
  lowest_price_claim_approved boolean not null default false,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  agreement_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_pricing (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  bedrooms numeric(3,1),
  bathrooms numeric(3,1),
  standard_price_cents integer not null check (standard_price_cents >= 0),
  plus_price_cents integer not null check (plus_price_cents >= 0),
  discount_percent numeric(6,3) check (discount_percent is null or discount_percent >= 0),
  discount_cents integer check (discount_cents is null or discount_cents >= 0),
  funding_source public.discount_funding_source not null default 'provider',
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  service_areas jsonb not null default '[]'::jsonb,
  blackout_rules jsonb not null default '[]'::jsonb,
  approved_by uuid references public.admin_users(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (plus_price_cents <= standard_price_cents)
);

create table if not exists public.reward_program_settings (
  id boolean primary key default true check (id),
  point_value_cents numeric(8,4) not null default 1 check (point_value_cents > 0),
  referral_fee_percent numeric(6,3) not null default 10 check (referral_fee_percent >= 0 and referral_fee_percent <= 100),
  redemption_cap_percent_of_subtotal numeric(6,3) not null default 10 check (redemption_cap_percent_of_subtotal >= 0 and redemption_cap_percent_of_subtotal <= 100),
  availability_waiting_days integer not null default 0 check (availability_waiting_days between 0 and 30),
  expiration_months_without_activity integer not null default 18 check (expiration_months_without_activity > 0),
  expiration_reminder_days integer[] not null default array[60, 30],
  updated_by uuid references public.admin_users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_service_rules (
  id uuid primary key default gen_random_uuid(),
  service_code public.reward_service_code not null unique,
  free_completion_bonus_points integer not null check (free_completion_bonus_points >= 0),
  plus_completion_bonus_points integer not null check (plus_completion_bonus_points >= 0),
  recurring_eligible boolean not null default false,
  active boolean not null default true,
  updated_by uuid references public.admin_users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_recurring_milestones (
  id uuid primary key default gen_random_uuid(),
  completed_appointments integer not null unique check (completed_appointments > 0),
  free_bonus_points integer not null check (free_bonus_points >= 0),
  plus_bonus_points integer not null check (plus_bonus_points >= 0),
  active boolean not null default true,
  updated_by uuid references public.admin_users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_id uuid references public.services(id) on delete cascade,
  provider_id uuid references public.providers(id) on delete cascade,
  membership_level public.membership_level,
  multiplier numeric(8,2) not null default 1 check (multiplier >= 0),
  funding_source public.discount_funding_source not null default 'flairo',
  starts_at timestamptz not null,
  ends_at timestamptz,
  limited_availability boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.admin_users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reward_accounts (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null unique references public.resident_profiles(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.resident_profiles(id) on delete cascade,
  provider_id uuid not null references public.providers(id),
  service_id uuid not null references public.services(id),
  community_id uuid not null references public.communities(id),
  unit_id uuid not null references public.units(id),
  provider_pricing_id uuid references public.provider_pricing(id),
  membership_level_at_booking public.membership_level not null,
  status public.booking_status not null default 'requested',
  service_date timestamptz,
  original_eligible_subtotal_cents integer not null check (original_eligible_subtotal_cents >= 0),
  selected_service_price_cents integer not null check (selected_service_price_cents >= 0),
  ineligible_fees_cents integer not null default 0 check (ineligible_fees_cents >= 0),
  resident_credit_cents integer not null default 0 check (resident_credit_cents >= 0),
  points_redeemed integer not null default 0 check (points_redeemed >= 0),
  resident_pays_provider_cents integer not null check (resident_pays_provider_cents >= 0),
  gross_referral_fee_cents integer not null check (gross_referral_fee_cents >= 0),
  credit_offset_cents integer not null default 0 check (credit_offset_cents >= 0),
  net_referral_fee_owed_cents integer not null check (net_referral_fee_owed_cents >= 0),
  provider_retained_after_referral_cents integer not null check (provider_retained_after_referral_cents >= 0),
  completion_confirmed_at timestamptz,
  payment_confirmed_at timestamptz,
  duplicate_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (credit_offset_cents <= gross_referral_fee_cents)
);

create table if not exists public.service_completion_verifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.service_bookings(id) on delete cascade,
  provider_id uuid not null references public.providers(id),
  confirmed_by uuid references auth.users(id),
  verification_type public.verification_type not null,
  payment_confirmed boolean not null default false,
  notes text,
  confirmed_at timestamptz not null default now(),
  unique (booking_id, verification_type)
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  reward_account_id uuid not null references public.reward_accounts(id) on delete cascade,
  resident_id uuid not null references public.resident_profiles(id) on delete cascade,
  booking_id uuid references public.service_bookings(id) on delete set null,
  service_code public.reward_service_code,
  transaction_type public.reward_transaction_type not null,
  direction public.ledger_direction not null,
  status public.point_status not null,
  points integer not null check (points > 0),
  reason text not null,
  source text not null,
  related_reward_transaction_id uuid references public.reward_transactions(id),
  dollar_value_cents integer check (dollar_value_cents is null or dollar_value_cents >= 0),
  plus_additional_points integer not null default 0 check (plus_additional_points >= 0),
  available_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_transaction_id uuid not null unique references public.reward_transactions(id) on delete restrict,
  booking_id uuid not null references public.service_bookings(id) on delete restrict,
  resident_id uuid not null references public.resident_profiles(id) on delete cascade,
  points integer not null check (points > 0),
  service_credit_cents integer not null check (service_credit_cents > 0),
  cap_percent_of_subtotal numeric(6,3) not null,
  status public.point_status not null default 'redeemed',
  created_at timestamptz not null default now()
);

create table if not exists public.provider_fee_transactions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  booking_id uuid references public.service_bookings(id) on delete set null,
  original_eligible_subtotal_cents integer not null check (original_eligible_subtotal_cents >= 0),
  gross_referral_fee_cents integer not null check (gross_referral_fee_cents >= 0),
  resident_credit_offset_cents integer not null default 0 check (resident_credit_offset_cents >= 0),
  net_fee_cents integer not null check (net_fee_cents >= 0),
  status public.settlement_status not null default 'unpaid',
  due_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_settlements (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_referral_fees_cents integer not null default 0 check (gross_referral_fees_cents >= 0),
  reward_credit_offsets_cents integer not null default 0 check (reward_credit_offsets_cents >= 0),
  adjustments_cents integer not null default 0,
  net_amount_due_cents integer not null default 0,
  status public.settlement_status not null default 'unpaid',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.provider_settlement_items (
  settlement_id uuid not null references public.provider_settlements(id) on delete cascade,
  provider_fee_transaction_id uuid not null references public.provider_fee_transactions(id) on delete restrict,
  primary key (settlement_id, provider_fee_transaction_id)
);

create table if not exists public.refunds_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.service_bookings(id) on delete cascade,
  resident_id uuid not null references public.resident_profiles(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  event_type public.verification_type not null,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  reason text not null,
  status text not null default 'open',
  points_reversed integer not null default 0 check (points_reversed >= 0),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  reward_transaction_id uuid not null unique references public.reward_transactions(id) on delete restrict,
  resident_id uuid not null references public.resident_profiles(id) on delete cascade,
  booking_id uuid references public.service_bookings(id) on delete set null,
  admin_user_id uuid not null references public.admin_users(id),
  points_delta integer not null check (points_delta <> 0),
  reason text not null check (length(trim(reason)) >= 8),
  created_at timestamptz not null default now()
);

create table if not exists public.point_expiration_batches (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  cutoff_activity_before timestamptz not null,
  status text not null default 'completed',
  entries_count integer not null default 0 check (entries_count >= 0),
  total_points_expired integer not null default 0 check (total_points_expired >= 0),
  created_by uuid references public.admin_users(id)
);

create table if not exists public.point_expiration_batch_items (
  batch_id uuid not null references public.point_expiration_batches(id) on delete cascade,
  reward_transaction_id uuid not null references public.reward_transactions(id) on delete restrict,
  expiration_transaction_id uuid not null references public.reward_transactions(id) on delete restrict,
  primary key (batch_id, reward_transaction_id)
);

create table if not exists public.reward_notifications (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.resident_profiles(id) on delete cascade,
  reward_transaction_id uuid references public.reward_transactions(id) on delete cascade,
  notification_type text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'scheduled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.resident_profiles(id) on delete cascade,
  provider_id uuid references public.providers(id) on delete cascade,
  booking_id uuid references public.service_bookings(id) on delete cascade,
  code text not null,
  severity text not null check (severity in ('info', 'review', 'block')),
  message text not null,
  status text not null default 'open',
  reviewed_by uuid references public.admin_users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  actor_role text not null,
  action public.audit_action not null,
  table_name text not null,
  record_id uuid,
  resident_id uuid references public.resident_profiles(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  booking_id uuid references public.service_bookings(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create schema if not exists private;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = (select auth.uid())
      and admin_user.active
  );
$$;

create or replace function private.current_user_provider_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select provider_user.provider_id
  from public.provider_users provider_user
  where provider_user.user_id = (select auth.uid())
    and provider_user.active
  limit 1;
$$;

create or replace function private.current_user_resident_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select resident.id
  from public.resident_profiles resident
  where resident.user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function private.current_user_is_admin() from public;
revoke all on function private.current_user_provider_id() from public;
revoke all on function private.current_user_resident_id() from public;
grant execute on function private.current_user_is_admin() to authenticated;
grant execute on function private.current_user_provider_id() to authenticated;
grant execute on function private.current_user_resident_id() to authenticated;

create index if not exists idx_units_community on public.units(community_id);
create index if not exists idx_resident_profiles_user on public.resident_profiles(user_id);
create index if not exists idx_resident_profiles_community_unit on public.resident_profiles(community_id, unit_id);
create index if not exists idx_resident_memberships_resident on public.resident_memberships(resident_id);
create index if not exists idx_provider_users_user on public.provider_users(user_id);
create index if not exists idx_provider_pricing_lookup on public.provider_pricing(provider_id, service_id, community_id, active);
create index if not exists idx_bookings_resident on public.service_bookings(resident_id, created_at desc);
create index if not exists idx_bookings_provider on public.service_bookings(provider_id, status, created_at desc);
create index if not exists idx_reward_accounts_resident on public.reward_accounts(resident_id);
create index if not exists idx_reward_transactions_account_status on public.reward_transactions(reward_account_id, status, created_at desc);
create index if not exists idx_reward_transactions_booking on public.reward_transactions(booking_id);
create index if not exists idx_reward_transactions_expiration on public.reward_transactions(status, expires_at);
create index if not exists idx_provider_fee_transactions_provider on public.provider_fee_transactions(provider_id, status, created_at desc);
create index if not exists idx_risk_flags_status on public.risk_flags(status, severity, created_at desc);
create index if not exists idx_audit_logs_record on public.audit_logs(table_name, record_id, created_at desc);

insert into public.membership_plans (level, label, monthly_fee_cents, base_points_per_dollar, redemption_threshold_points, benefits)
values
  ('free', 'FLAIRO Rewards', 0, 1, 500, '{"pricing":"standard marketplace pricing"}'),
  ('plus', 'FLAIRO PLUS', 500, 2, 250, '{"pricing":"member pricing","promotions":"advance access"}')
on conflict (level) do update set
  label = excluded.label,
  monthly_fee_cents = excluded.monthly_fee_cents,
  base_points_per_dollar = excluded.base_points_per_dollar,
  redemption_threshold_points = excluded.redemption_threshold_points,
  benefits = excluded.benefits,
  updated_at = now();

insert into public.reward_program_settings (id, point_value_cents, referral_fee_percent, redemption_cap_percent_of_subtotal, availability_waiting_days, expiration_months_without_activity, expiration_reminder_days)
values (true, 1, 10, 10, 0, 18, array[60, 30])
on conflict (id) do update set
  point_value_cents = excluded.point_value_cents,
  referral_fee_percent = excluded.referral_fee_percent,
  redemption_cap_percent_of_subtotal = excluded.redemption_cap_percent_of_subtotal,
  availability_waiting_days = excluded.availability_waiting_days,
  expiration_months_without_activity = excluded.expiration_months_without_activity,
  expiration_reminder_days = excluded.expiration_reminder_days,
  updated_at = now();

insert into public.reward_service_rules (service_code, free_completion_bonus_points, plus_completion_bonus_points, recurring_eligible)
values
  ('recurring_housekeeping', 100, 200, true),
  ('groomer_appointment', 25, 50, false),
  ('dog_walking', 10, 20, true),
  ('pet_sitter_drop_in', 10, 20, true),
  ('move_out_cleaning', 100, 200, false),
  ('moving_service', 150, 300, false),
  ('move_out_touch_up_painting', 100, 200, false),
  ('move_out_full_painting', 200, 400, false),
  ('move_out_deep_cleaning', 125, 250, false),
  ('handyman_work', 50, 100, false),
  ('junk_hauling', 75, 150, false)
on conflict (service_code) do update set
  free_completion_bonus_points = excluded.free_completion_bonus_points,
  plus_completion_bonus_points = excluded.plus_completion_bonus_points,
  recurring_eligible = excluded.recurring_eligible,
  updated_at = now();

insert into public.reward_recurring_milestones (completed_appointments, free_bonus_points, plus_bonus_points)
values
  (3, 100, 200),
  (6, 250, 500),
  (12, 500, 1000)
on conflict (completed_appointments) do update set
  free_bonus_points = excluded.free_bonus_points,
  plus_bonus_points = excluded.plus_bonus_points,
  updated_at = now();

alter table public.communities enable row level security;
alter table public.units enable row level security;
alter table public.resident_profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.providers enable row level security;
alter table public.provider_users enable row level security;
alter table public.membership_plans enable row level security;
alter table public.resident_memberships enable row level security;
alter table public.services enable row level security;
alter table public.provider_agreements enable row level security;
alter table public.provider_pricing enable row level security;
alter table public.reward_program_settings enable row level security;
alter table public.reward_service_rules enable row level security;
alter table public.reward_recurring_milestones enable row level security;
alter table public.promotions enable row level security;
alter table public.reward_accounts enable row level security;
alter table public.service_bookings enable row level security;
alter table public.service_completion_verifications enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.provider_fee_transactions enable row level security;
alter table public.provider_settlements enable row level security;
alter table public.provider_settlement_items enable row level security;
alter table public.refunds_disputes enable row level security;
alter table public.admin_adjustments enable row level security;
alter table public.point_expiration_batches enable row level security;
alter table public.point_expiration_batch_items enable row level security;
alter table public.reward_notifications enable row level security;
alter table public.risk_flags enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to authenticated;
grant select on public.communities, public.membership_plans, public.services, public.reward_program_settings, public.reward_service_rules, public.reward_recurring_milestones, public.promotions to authenticated;
grant select, insert, update on public.resident_profiles, public.units, public.resident_memberships, public.service_bookings to authenticated;
grant select on public.reward_accounts, public.reward_transactions, public.reward_redemptions, public.reward_notifications to authenticated;
grant select, insert, update on public.service_completion_verifications, public.refunds_disputes to authenticated;
grant select on public.providers, public.provider_agreements, public.provider_pricing, public.provider_fee_transactions, public.provider_settlements, public.provider_settlement_items to authenticated;
grant select, insert, update, delete on
  public.communities,
  public.admin_users,
  public.providers,
  public.provider_users,
  public.membership_plans,
  public.services,
  public.provider_agreements,
  public.provider_pricing,
  public.reward_program_settings,
  public.reward_service_rules,
  public.reward_recurring_milestones,
  public.promotions,
  public.reward_accounts,
  public.reward_transactions,
  public.reward_redemptions,
  public.provider_fee_transactions,
  public.provider_settlements,
  public.provider_settlement_items,
  public.admin_adjustments,
  public.point_expiration_batches,
  public.point_expiration_batch_items,
  public.reward_notifications,
  public.risk_flags,
  public.audit_logs
to authenticated;

drop policy if exists "public readable active communities" on public.communities;
create policy "public readable active communities"
on public.communities for select to authenticated
using (active or private.current_user_is_admin());

drop policy if exists "admin manage communities" on public.communities;
create policy "admin manage communities"
on public.communities for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "resident can manage own profile" on public.resident_profiles;
create policy "resident can manage own profile"
on public.resident_profiles for all to authenticated
using (user_id = (select auth.uid()) or private.current_user_is_admin())
with check (user_id = (select auth.uid()) or private.current_user_is_admin());

drop policy if exists "resident can read own unit" on public.units;
create policy "resident can read own unit"
on public.units for select to authenticated
using (
  private.current_user_is_admin()
  or exists (
    select 1 from public.resident_profiles resident
    where resident.unit_id = units.id
      and resident.user_id = (select auth.uid())
  )
);

drop policy if exists "resident can create unit during onboarding" on public.units;
create policy "resident can create unit during onboarding"
on public.units for insert to authenticated
with check (true);

drop policy if exists "admin all units" on public.units;
create policy "admin all units"
on public.units for update to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "admin all admin users" on public.admin_users;
create policy "admin all admin users"
on public.admin_users for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider users read own provider" on public.providers;
create policy "provider users read own provider"
on public.providers for select to authenticated
using (private.current_user_is_admin() or id = private.current_user_provider_id());

drop policy if exists "admin manage providers" on public.providers;
create policy "admin manage providers"
on public.providers for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider user membership" on public.provider_users;
create policy "provider user membership"
on public.provider_users for select to authenticated
using (private.current_user_is_admin() or user_id = (select auth.uid()));

drop policy if exists "admin manage provider users" on public.provider_users;
create policy "admin manage provider users"
on public.provider_users for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "reference data read" on public.membership_plans;
create policy "reference data read"
on public.membership_plans for select to authenticated
using (active or private.current_user_is_admin());

drop policy if exists "admin manage membership plans" on public.membership_plans;
create policy "admin manage membership plans"
on public.membership_plans for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "resident memberships visible to owner" on public.resident_memberships;
create policy "resident memberships visible to owner"
on public.resident_memberships for select to authenticated
using (
  private.current_user_is_admin()
  or resident_id = private.current_user_resident_id()
);

drop policy if exists "resident memberships admin write" on public.resident_memberships;
create policy "resident memberships admin write"
on public.resident_memberships for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "active services readable" on public.services;
create policy "active services readable"
on public.services for select to authenticated
using (active or private.current_user_is_admin());

drop policy if exists "admin manage services" on public.services;
create policy "admin manage services"
on public.services for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider agreements visible" on public.provider_agreements;
create policy "provider agreements visible"
on public.provider_agreements for select to authenticated
using (private.current_user_is_admin() or provider_id = private.current_user_provider_id());

drop policy if exists "admin manage provider agreements" on public.provider_agreements;
create policy "admin manage provider agreements"
on public.provider_agreements for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider pricing visible" on public.provider_pricing;
create policy "provider pricing visible"
on public.provider_pricing for select to authenticated
using (active or private.current_user_is_admin() or provider_id = private.current_user_provider_id());

drop policy if exists "admin manage provider pricing" on public.provider_pricing;
create policy "admin manage provider pricing"
on public.provider_pricing for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "reward settings readable" on public.reward_program_settings;
create policy "reward settings readable"
on public.reward_program_settings for select to authenticated
using (true);

drop policy if exists "admin manage reward settings" on public.reward_program_settings;
create policy "admin manage reward settings"
on public.reward_program_settings for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "reward rules readable" on public.reward_service_rules;
create policy "reward rules readable"
on public.reward_service_rules for select to authenticated
using (active or private.current_user_is_admin());

drop policy if exists "admin manage reward rules" on public.reward_service_rules;
create policy "admin manage reward rules"
on public.reward_service_rules for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "recurring milestones readable" on public.reward_recurring_milestones;
create policy "recurring milestones readable"
on public.reward_recurring_milestones for select to authenticated
using (active or private.current_user_is_admin());

drop policy if exists "admin manage recurring milestones" on public.reward_recurring_milestones;
create policy "admin manage recurring milestones"
on public.reward_recurring_milestones for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "promotions readable" on public.promotions;
create policy "promotions readable"
on public.promotions for select to authenticated
using (active or private.current_user_is_admin());

drop policy if exists "admin manage promotions" on public.promotions;
create policy "admin manage promotions"
on public.promotions for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "reward account owner read" on public.reward_accounts;
create policy "reward account owner read"
on public.reward_accounts for select to authenticated
using (private.current_user_is_admin() or resident_id = private.current_user_resident_id());

drop policy if exists "admin manage reward accounts" on public.reward_accounts;
create policy "admin manage reward accounts"
on public.reward_accounts for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "bookings visible by role" on public.service_bookings;
create policy "bookings visible by role"
on public.service_bookings for select to authenticated
using (
  private.current_user_is_admin()
  or resident_id = private.current_user_resident_id()
  or provider_id = private.current_user_provider_id()
);

drop policy if exists "resident can request own booking" on public.service_bookings;
create policy "resident can request own booking"
on public.service_bookings for insert to authenticated
with check (resident_id = private.current_user_resident_id());

drop policy if exists "admin can update booking" on public.service_bookings;
create policy "admin can update booking"
on public.service_bookings for update to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider can verify assigned booking" on public.service_completion_verifications;
create policy "provider can verify assigned booking"
on public.service_completion_verifications for insert to authenticated
with check (
  private.current_user_is_admin()
  or provider_id = private.current_user_provider_id()
);

drop policy if exists "verification visible by role" on public.service_completion_verifications;
create policy "verification visible by role"
on public.service_completion_verifications for select to authenticated
using (
  private.current_user_is_admin()
  or provider_id = private.current_user_provider_id()
  or exists (
    select 1 from public.service_bookings booking
    where booking.id = service_completion_verifications.booking_id
      and booking.resident_id = private.current_user_resident_id()
  )
);

drop policy if exists "reward transactions owner read" on public.reward_transactions;
create policy "reward transactions owner read"
on public.reward_transactions for select to authenticated
using (private.current_user_is_admin() or resident_id = private.current_user_resident_id());

drop policy if exists "admin manage reward transactions" on public.reward_transactions;
create policy "admin manage reward transactions"
on public.reward_transactions for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "redemptions owner read" on public.reward_redemptions;
create policy "redemptions owner read"
on public.reward_redemptions for select to authenticated
using (private.current_user_is_admin() or resident_id = private.current_user_resident_id());

drop policy if exists "admin manage reward redemptions" on public.reward_redemptions;
create policy "admin manage reward redemptions"
on public.reward_redemptions for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider fees visible by provider" on public.provider_fee_transactions;
create policy "provider fees visible by provider"
on public.provider_fee_transactions for select to authenticated
using (private.current_user_is_admin() or provider_id = private.current_user_provider_id());

drop policy if exists "admin manage provider fees" on public.provider_fee_transactions;
create policy "admin manage provider fees"
on public.provider_fee_transactions for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider settlements visible by provider" on public.provider_settlements;
create policy "provider settlements visible by provider"
on public.provider_settlements for select to authenticated
using (private.current_user_is_admin() or provider_id = private.current_user_provider_id());

drop policy if exists "admin manage provider settlements" on public.provider_settlements;
create policy "admin manage provider settlements"
on public.provider_settlements for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "provider settlement items visible by provider" on public.provider_settlement_items;
create policy "provider settlement items visible by provider"
on public.provider_settlement_items for select to authenticated
using (
  private.current_user_is_admin()
  or exists (
    select 1
    from public.provider_settlements settlement
    where settlement.id = provider_settlement_items.settlement_id
      and settlement.provider_id = private.current_user_provider_id()
  )
);

drop policy if exists "admin manage provider settlement items" on public.provider_settlement_items;
create policy "admin manage provider settlement items"
on public.provider_settlement_items for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "refund disputes visible by role" on public.refunds_disputes;
create policy "refund disputes visible by role"
on public.refunds_disputes for select to authenticated
using (
  private.current_user_is_admin()
  or resident_id = private.current_user_resident_id()
  or provider_id = private.current_user_provider_id()
);

drop policy if exists "provider can report refunds" on public.refunds_disputes;
create policy "provider can report refunds"
on public.refunds_disputes for insert to authenticated
with check (
  private.current_user_is_admin()
  or provider_id = private.current_user_provider_id()
);

drop policy if exists "admin only adjustments" on public.admin_adjustments;
create policy "admin only adjustments"
on public.admin_adjustments for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "admin only expiration batches" on public.point_expiration_batches;
create policy "admin only expiration batches"
on public.point_expiration_batches for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "admin only expiration items" on public.point_expiration_batch_items;
create policy "admin only expiration items"
on public.point_expiration_batch_items for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "notifications owner read" on public.reward_notifications;
create policy "notifications owner read"
on public.reward_notifications for select to authenticated
using (private.current_user_is_admin() or resident_id = private.current_user_resident_id());

drop policy if exists "risk flags visible by role" on public.risk_flags;
create policy "risk flags visible by role"
on public.risk_flags for select to authenticated
using (
  private.current_user_is_admin()
  or resident_id = private.current_user_resident_id()
  or provider_id = private.current_user_provider_id()
);

drop policy if exists "admin can manage risk flags" on public.risk_flags;
create policy "admin can manage risk flags"
on public.risk_flags for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "admin reads audit logs" on public.audit_logs;
create policy "admin reads audit logs"
on public.audit_logs for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admin writes audit logs" on public.audit_logs;
create policy "admin writes audit logs"
on public.audit_logs for insert to authenticated
with check (private.current_user_is_admin());

create or replace view public.v_reward_account_balances
with (security_invoker = true)
as
select
  account.id as reward_account_id,
  account.resident_id,
  coalesce(sum(case when tx.direction = 'credit' and tx.status = 'pending' then tx.points else 0 end), 0) as pending_points,
  coalesce(sum(case when tx.direction = 'credit' and tx.status = 'available' then tx.points else 0 end), 0)
    - coalesce(sum(case when tx.direction = 'debit' and tx.status in ('redeemed', 'reversed', 'expired') then tx.points else 0 end), 0) as available_points,
  coalesce(sum(case when tx.direction = 'credit' then tx.points else 0 end), 0) as lifetime_points_earned,
  coalesce(sum(case when tx.status = 'redeemed' then tx.points else 0 end), 0) as redeemed_points,
  coalesce(sum(case when tx.status = 'reversed' then tx.points else 0 end), 0) as reversed_points,
  coalesce(sum(case when tx.status = 'expired' then tx.points else 0 end), 0) as expired_points,
  coalesce(sum(case when tx.status = 'redeemed' then tx.dollar_value_cents else 0 end), 0) as service_credit_redeemed_cents,
  coalesce(sum(case when tx.direction = 'credit' and tx.status = 'available' then tx.points else 0 end), 0) as gross_available_credit_points
from public.reward_accounts account
left join public.reward_transactions tx on tx.reward_account_id = account.id
group by account.id, account.resident_id;

create or replace view public.v_provider_settlement_summary
with (security_invoker = true)
as
select
  provider.id as provider_id,
  provider.business_name,
  coalesce(count(booking.id), 0) as booking_count,
  coalesce(sum(booking.original_eligible_subtotal_cents), 0) as eligible_service_revenue_cents,
  coalesce(sum(booking.gross_referral_fee_cents), 0) as gross_referral_fees_cents,
  coalesce(sum(booking.credit_offset_cents), 0) as reward_credit_offsets_cents,
  coalesce(sum(booking.net_referral_fee_owed_cents), 0) as net_referral_fees_cents,
  coalesce(sum(case when booking.status in ('refunded', 'disputed') then 1 else 0 end), 0) as refunds_or_disputes
from public.providers provider
left join public.service_bookings booking on booking.provider_id = provider.id
group by provider.id, provider.business_name;

create or replace view public.v_rewards_dashboard
with (security_invoker = true)
as
select
  (select count(*) from public.resident_profiles where active) as active_rewards_members,
  (select count(*) from public.resident_memberships where status in ('trial', 'active') and plan_level = 'plus') as active_plus_members,
  (select coalesce(sum(plan.monthly_fee_cents), 0) from public.resident_memberships membership join public.membership_plans plan on plan.level = membership.plan_level where membership.status in ('trial', 'active')) as monthly_membership_revenue_cents,
  (select coalesce(sum(points), 0) from public.reward_transactions where direction = 'credit') as points_issued,
  (select coalesce(sum(points), 0) from public.reward_transactions where status = 'pending') as points_pending,
  (select coalesce(sum(points), 0) from public.reward_transactions where status = 'redeemed') as points_redeemed,
  (select coalesce(sum(points), 0) from public.reward_transactions where status = 'reversed') as points_reversed,
  (select coalesce(sum(points), 0) from public.reward_transactions where status = 'expired') as points_expired,
  (select coalesce(sum(service_credit_cents), 0) from public.reward_redemptions) as service_credits_redeemed_cents,
  (select coalesce(sum(original_eligible_subtotal_cents), 0) from public.service_bookings) as gross_service_revenue_cents,
  (select coalesce(sum(gross_referral_fee_cents), 0) from public.service_bookings) as gross_referral_fees_cents,
  (select coalesce(sum(credit_offset_cents), 0) from public.service_bookings) as reward_credit_offsets_cents,
  (select coalesce(sum(net_referral_fee_owed_cents), 0) from public.service_bookings) as net_referral_revenue_cents;
