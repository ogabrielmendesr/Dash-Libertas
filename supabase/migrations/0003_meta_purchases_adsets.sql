-- ============================================================
-- Libertas — Migration 0003 (compras do Meta + conjuntos)
-- ============================================================
-- 1) Compras e valor de compra que o PRÓPRIO Facebook atribuiu a cada
--    anúncio/dia (pixel + API de conversões). Servem pra comparar com as
--    vendas da Hotmart e saber se o rastreamento está chegando no Meta.
-- 2) Orçamento e status dos conjuntos (ABO) e status das campanhas.
-- ============================================================

alter table public.fb_ad_insights
  add column if not exists meta_purchases      integer       not null default 0,
  add column if not exists meta_purchase_value numeric(12,2) not null default 0;

alter table public.fb_campaign_budgets
  add column if not exists effective_status text;

create table if not exists public.fb_adset_budgets (
  adset_id          text          primary key,
  campaign_id       text          not null,
  ad_account_id     text          not null,
  daily_budget      numeric(12,2),            -- em unidade da moeda da conta
  lifetime_budget   numeric(12,2),
  effective_status  text,                     -- ACTIVE, PAUSED, CAMPAIGN_PAUSED...
  updated_at        timestamptz   not null default now()
);

create index if not exists fb_adset_budgets_campaign_idx
  on public.fb_adset_budgets (campaign_id);

alter table public.fb_adset_budgets enable row level security;

drop trigger if exists tr_fb_adset_budgets_updated on public.fb_adset_budgets;
create trigger tr_fb_adset_budgets_updated
  before update on public.fb_adset_budgets
  for each row execute function public.touch_updated_at();
