-- ============================================================
-- Libertas — Migration 0001 (schema completo)
-- ============================================================
-- Consolidação do schema em produção. Single-user, sem auth.
-- Acesso via service_role do backend; RLS habilitado em todas as tabelas
-- públicas (sem policies — bloqueia anon/authenticated por padrão).
-- Cruzamento: sales.utm_content = fb_ad_insights.ad_id
-- ============================================================

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type sale_status as enum ('approved', 'pending', 'refunded', 'cancelled', 'chargeback');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sync_type as enum ('facebook_sync', 'webhook_received', 'webhook_replay');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sync_status as enum ('success', 'error', 'warning');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 1. fb_connections — credenciais da Meta (1 linha apenas)
-- ============================================================
create table if not exists public.fb_connections (
  id                uuid        primary key default gen_random_uuid(),
  access_token      text        not null,
  token_expires_at  timestamptz,
  fb_user_id        text,
  fb_user_name      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 2. fb_ad_accounts — catálogo de contas de anúncio (multi-conta)
-- ============================================================
create table if not exists public.fb_ad_accounts (
  id              uuid        primary key default gen_random_uuid(),
  ad_account_id   text        not null unique,    -- ex: act_1185920304
  name            text        not null,
  currency        text,                            -- BRL, USD, MXN, CLP, etc
  is_active       boolean     not null default true,   -- ativa no Meta
  is_enabled      boolean     not null default false,  -- habilitada pelo usuário
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists fb_ad_accounts_enabled_idx on public.fb_ad_accounts (is_enabled);

-- ============================================================
-- 3. fb_ad_insights — insights diários da Meta API
-- ============================================================
create table if not exists public.fb_ad_insights (
  id                  uuid        primary key default gen_random_uuid(),
  ad_account_id       text        not null,
  campaign_id         text        not null,
  campaign_name       text        not null,
  adset_id            text        not null,
  adset_name          text        not null,
  ad_id               text        not null,         -- ⚠ chave do cruzamento
  ad_name             text        not null,
  date                date        not null,
  spend               numeric(12,2) not null default 0,
  impressions         integer     not null default 0,
  link_clicks         integer     not null default 0,
  landing_page_views  integer     not null default 0,
  initiate_checkouts  integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (ad_id, date)
);

create index if not exists fb_ad_insights_date_idx     on public.fb_ad_insights (date desc);
create index if not exists fb_ad_insights_ad_id_idx    on public.fb_ad_insights (ad_id);
create index if not exists fb_ad_insights_campaign_idx on public.fb_ad_insights (campaign_id);

-- ============================================================
-- 4. sales — vendas vindas do webhook da Hotmart
-- ============================================================
create table if not exists public.sales (
  id                  uuid          primary key default gen_random_uuid(),
  transaction_id      text          not null unique,
  status              sale_status   not null,
  product_id          text,
  product_name        text          not null,
  sale_amount         numeric(12,2) not null,
  commission_amount   numeric(12,2),
  currency            text          not null default 'BRL',
  -- valores do produtor convertidos pela Hotmart (preferidos quando presentes)
  producer_amount_usd numeric(12,2),
  producer_amount_brl numeric(12,2),
  producer_fx_rate    numeric(12,6),
  payment_method      text,
  placement           text,
  traffic_source      text,
  utm_content         text,                             -- ⚠ contém o ad.id
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_term            text,
  sck                 text,
  buyer_email         text,
  buyer_name          text,
  sale_date           timestamptz   not null,
  webhook_received_at timestamptz   not null default now(),
  raw_payload         jsonb         not null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

create index if not exists sales_utm_content_idx    on public.sales (utm_content);
create index if not exists sales_status_idx         on public.sales (status);
create index if not exists sales_sale_date_idx      on public.sales (sale_date desc);
create index if not exists sales_product_idx        on public.sales (product_id);
create index if not exists sales_payment_method_idx on public.sales (payment_method);
create index if not exists sales_placement_idx      on public.sales (placement);
create index if not exists sales_traffic_source_idx on public.sales (traffic_source);

-- ============================================================
-- 5. app_settings — preferências do app (1 linha apenas)
-- ============================================================
create table if not exists public.app_settings (
  id                  uuid        primary key default gen_random_uuid(),
  display_currency    text        not null default 'BRL',
  fx_usd_brl          numeric(12,4) not null default 5.20,
  fx_rate_updated_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- 6. fx_rates — tabela de câmbio (currency → USD rate)
-- ============================================================
create table if not exists public.fx_rates (
  currency    text          primary key,
  usd_rate    numeric(12,6) not null,            -- 1 USD = X moeda
  updated_at  timestamptz   not null default now()
);

-- ============================================================
-- 7. webhook_configs — config do webhook (1 linha apenas)
-- ============================================================
create table if not exists public.webhook_configs (
  id              uuid        primary key default gen_random_uuid(),
  platform        text        not null default 'hotmart',
  webhook_secret  text        not null,
  hottok          text,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 8. sync_logs — histórico de sincronizações e webhooks
-- ============================================================
create table if not exists public.sync_logs (
  id                  uuid        primary key default gen_random_uuid(),
  type                sync_type   not null,
  status              sync_status not null,
  records_processed   integer     not null default 0,
  message             text,
  metadata            jsonb,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create index if not exists sync_logs_started_idx on public.sync_logs (started_at desc);
create index if not exists sync_logs_type_idx    on public.sync_logs (type);

-- ============================================================
-- 9. View ad_performance — cruzamento pronto pro dashboard
-- ============================================================
create or replace view public.ad_performance as
select
  ads.ad_account_id,
  acc.currency                                  as ad_account_currency,
  ads.campaign_id,
  ads.campaign_name,
  ads.adset_id,
  ads.adset_name,
  ads.ad_id,
  ads.ad_name,
  ads.date,
  ads.spend,
  ads.impressions,
  ads.link_clicks,
  ads.landing_page_views,
  ads.initiate_checkouts,
  coalesce(brl.sales_count, 0)        as brl_sales_count,
  coalesce(brl.revenue, 0)            as brl_revenue,
  coalesce(usd.sales_count, 0)        as usd_sales_count,
  coalesce(usd.revenue, 0)            as usd_revenue,
  coalesce(all_curr.sales_count, 0)   as total_sales_count,
  coalesce(all_curr.revenue_usd, 0)   as total_revenue_usd,
  coalesce(all_curr.refunded_count, 0) as total_refunded_count
from public.fb_ad_insights ads
join public.fb_ad_accounts acc
  on acc.ad_account_id = ads.ad_account_id
 and acc.is_enabled = true
left join (
  select
    utm_content,
    date_trunc('day', sale_date)::date as sale_day,
    count(*) filter (where status = 'approved')           as sales_count,
    sum(sale_amount) filter (where status = 'approved')   as revenue
  from public.sales
  where currency = 'BRL' and utm_content is not null and utm_content <> ''
  group by utm_content, date_trunc('day', sale_date)::date
) brl on brl.utm_content = ads.ad_id and brl.sale_day = ads.date
left join (
  select
    utm_content,
    date_trunc('day', sale_date)::date as sale_day,
    count(*) filter (where status = 'approved')           as sales_count,
    sum(sale_amount) filter (where status = 'approved')   as revenue
  from public.sales
  where currency = 'USD' and utm_content is not null and utm_content <> ''
  group by utm_content, date_trunc('day', sale_date)::date
) usd on usd.utm_content = ads.ad_id and usd.sale_day = ads.date
left join (
  select
    s.utm_content,
    date_trunc('day', s.sale_date)::date as sale_day,
    count(*) filter (where s.status = 'approved')         as sales_count,
    sum(case when s.status = 'approved'
              then s.sale_amount / nullif(coalesce(r.usd_rate, 1), 0)
              else 0 end)                                 as revenue_usd,
    count(*) filter (where s.status = 'refunded')         as refunded_count
  from public.sales s
  left join public.fx_rates r on r.currency = s.currency
  where s.utm_content is not null and s.utm_content <> ''
  group by s.utm_content, date_trunc('day', s.sale_date)::date
) all_curr on all_curr.utm_content = ads.ad_id and all_curr.sale_day = ads.date;

alter view public.ad_performance set (security_invoker = true);

-- ============================================================
-- 10. Trigger pra manter updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_fb_connections_updated   on public.fb_connections;
drop trigger if exists tr_fb_ad_accounts_updated   on public.fb_ad_accounts;
drop trigger if exists tr_fb_ad_insights_updated   on public.fb_ad_insights;
drop trigger if exists tr_sales_updated            on public.sales;
drop trigger if exists tr_app_settings_updated     on public.app_settings;
drop trigger if exists tr_webhook_configs_updated  on public.webhook_configs;

create trigger tr_fb_connections_updated  before update on public.fb_connections  for each row execute function public.touch_updated_at();
create trigger tr_fb_ad_accounts_updated  before update on public.fb_ad_accounts  for each row execute function public.touch_updated_at();
create trigger tr_fb_ad_insights_updated  before update on public.fb_ad_insights  for each row execute function public.touch_updated_at();
create trigger tr_sales_updated           before update on public.sales           for each row execute function public.touch_updated_at();
create trigger tr_app_settings_updated    before update on public.app_settings    for each row execute function public.touch_updated_at();
create trigger tr_webhook_configs_updated before update on public.webhook_configs for each row execute function public.touch_updated_at();

-- ============================================================
-- 11. RLS — habilita em todas as tabelas (sem policies).
-- Backend usa service_role, que bypassa RLS. anon/authenticated ficam bloqueadas.
-- ============================================================
alter table public.fb_connections   enable row level security;
alter table public.fb_ad_accounts   enable row level security;
alter table public.fb_ad_insights   enable row level security;
alter table public.sales            enable row level security;
alter table public.app_settings     enable row level security;
alter table public.fx_rates         enable row level security;
alter table public.webhook_configs  enable row level security;
alter table public.sync_logs        enable row level security;

-- ============================================================
-- 12. Bootstrap — semente do webhook_secret e do app_settings
-- ============================================================
insert into public.webhook_configs (platform, webhook_secret, is_active)
select 'hotmart', encode(gen_random_bytes(16), 'hex'), true
where not exists (select 1 from public.webhook_configs where platform = 'hotmart');

insert into public.app_settings (display_currency, fx_usd_brl)
select 'BRL', 5.20
where not exists (select 1 from public.app_settings);
