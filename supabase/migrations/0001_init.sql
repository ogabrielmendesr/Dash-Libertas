-- ============================================================
-- Libertas — Migration 0001 (single-user mode)
-- ============================================================
-- Sem auth, sem RLS. Acesso apenas via service_role do backend.
-- O cruzamento acontece em sales.utm_content = fb_ad_insights.ad_id
-- ============================================================

-- ============================================================
-- 1. fb_connections — credenciais da Meta (1 linha apenas)
-- ============================================================
create table if not exists public.fb_connections (
  id                uuid primary key default gen_random_uuid(),
  access_token      text        not null,       -- token longo (long-lived)
  ad_account_id     text        not null,       -- ex: act_1185920304
  ad_account_name   text,
  token_expires_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 2. fb_ad_insights — insights diários da Meta API
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
  date                date        not null,         -- granularidade diária
  spend               numeric(12,2) not null default 0,
  impressions         integer     not null default 0,
  link_clicks         integer     not null default 0,
  landing_page_views  integer     not null default 0,
  initiate_checkouts  integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- evita duplicatas: cada ad_id tem uma única linha por dia
  unique (ad_id, date)
);

create index if not exists fb_ad_insights_date_idx     on public.fb_ad_insights (date desc);
create index if not exists fb_ad_insights_ad_id_idx    on public.fb_ad_insights (ad_id);
create index if not exists fb_ad_insights_campaign_idx on public.fb_ad_insights (campaign_id);

-- ============================================================
-- 3. sales — vendas vindas do webhook da Hotmart
-- ============================================================
create type sale_status as enum ('approved', 'pending', 'refunded', 'cancelled', 'chargeback');

create table if not exists public.sales (
  id                  uuid          primary key default gen_random_uuid(),
  transaction_id      text          not null unique,   -- chave única (Hotmart transaction)
  status              sale_status   not null,
  product_id          text,
  product_name        text          not null,
  sale_amount         numeric(12,2) not null,
  commission_amount   numeric(12,2),                    -- valor que sobra pro produtor
  currency            text          not null default 'BRL',
  utm_content         text,                             -- ⚠ contém o ad.id (chave do cruzamento)
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_term            text,
  sck                 text,                             -- src/sck personalizado da Hotmart
  buyer_email         text,
  buyer_name          text,
  sale_date           timestamptz   not null,
  webhook_received_at timestamptz   not null default now(),
  raw_payload         jsonb         not null,           -- payload bruto pra auditoria
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

create index if not exists sales_utm_content_idx on public.sales (utm_content);
create index if not exists sales_status_idx      on public.sales (status);
create index if not exists sales_sale_date_idx   on public.sales (sale_date desc);
create index if not exists sales_product_idx     on public.sales (product_id);

-- ============================================================
-- 4. webhook_configs — config do webhook (1 linha apenas)
-- ============================================================
create table if not exists public.webhook_configs (
  id              uuid        primary key default gen_random_uuid(),
  platform        text        not null default 'hotmart',
  webhook_secret  text        not null,        -- usado pra montar a URL pública
  hottok          text,                         -- hottok configurado na Hotmart pra validar postback
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 5. sync_logs — histórico de sincronizações e webhooks recebidos
-- ============================================================
create type sync_type as enum ('facebook_sync', 'webhook_received', 'webhook_replay');
create type sync_status as enum ('success', 'error', 'warning');

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
-- 6. View pronta pro cruzamento (usada pelo dashboard)
-- ============================================================
create or replace view public.ad_performance as
select
  ads.ad_account_id,
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
  coalesce(s.sales_count, 0)   as sales_count,
  coalesce(s.revenue, 0)       as revenue,
  coalesce(s.refunded_count, 0) as refunded_count
from public.fb_ad_insights ads
left join (
  select
    utm_content,
    date_trunc('day', sale_date)::date as sale_day,
    count(*) filter (where status = 'approved')   as sales_count,
    sum(sale_amount) filter (where status = 'approved') as revenue,
    count(*) filter (where status = 'refunded')   as refunded_count
  from public.sales
  where utm_content is not null and utm_content <> ''
  group by utm_content, date_trunc('day', sale_date)::date
) s
  on s.utm_content = ads.ad_id
 and s.sale_day = ads.date;

-- ============================================================
-- 7. Trigger pra manter updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_fb_connections_updated   on public.fb_connections;
drop trigger if exists tr_fb_ad_insights_updated   on public.fb_ad_insights;
drop trigger if exists tr_sales_updated            on public.sales;
drop trigger if exists tr_webhook_configs_updated  on public.webhook_configs;

create trigger tr_fb_connections_updated
  before update on public.fb_connections
  for each row execute function public.touch_updated_at();

create trigger tr_fb_ad_insights_updated
  before update on public.fb_ad_insights
  for each row execute function public.touch_updated_at();

create trigger tr_sales_updated
  before update on public.sales
  for each row execute function public.touch_updated_at();

create trigger tr_webhook_configs_updated
  before update on public.webhook_configs
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 8. Bootstrap — semente do webhook_secret se ainda não existir
-- ============================================================
insert into public.webhook_configs (platform, webhook_secret, is_active)
select 'hotmart', encode(gen_random_bytes(16), 'hex'), true
where not exists (select 1 from public.webhook_configs where platform = 'hotmart');
