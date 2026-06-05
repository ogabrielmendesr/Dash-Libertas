-- ============================================================
-- Libertas — Migration 0002 (campaign budgets)
-- ============================================================
-- Armazena budgets das campanhas vindos da Meta Graph API.
-- Atualizado durante o sync e ao editar budget pelo dash.
-- ============================================================

create table if not exists public.fb_campaign_budgets (
  campaign_id       text          primary key,
  ad_account_id     text          not null,
  daily_budget      numeric(12,2),            -- em unidade da moeda (ex: 100.00 = R$100)
  lifetime_budget   numeric(12,2),
  budget_remaining  numeric(12,2),
  configured_status text,                     -- ACTIVE, PAUSED, etc.
  budget_type       text          not null default 'CBO',  -- CBO ou ABO
  updated_at        timestamptz   not null default now()
);

create index if not exists fb_campaign_budgets_account_idx
  on public.fb_campaign_budgets (ad_account_id);

alter table public.fb_campaign_budgets enable row level security;

-- Trigger pra manter updated_at
drop trigger if exists tr_fb_campaign_budgets_updated on public.fb_campaign_budgets;
create trigger tr_fb_campaign_budgets_updated
  before update on public.fb_campaign_budgets
  for each row execute function public.touch_updated_at();
