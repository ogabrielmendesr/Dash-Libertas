# Setup — Libertas

Guia passo-a-passo para sair de zero até dados reais aparecendo no painel.

---

## ✅ Estado atual

O painel já está rodando em **modo demonstração** (dados mockados) em http://localhost:3000.

Quando você conectar Supabase + Meta + Hotmart, ele automaticamente troca pra dados reais.

---

## 1. Criar projeto Supabase (você)

1. Acesse https://supabase.com/dashboard → **New project**
2. Preencha:
   - **Name:** `dash-libertas`
   - **Database password:** uma senha forte (salve em um lugar seguro)
   - **Region:** `South America (São Paulo)`
   - **Pricing plan:** Free
3. Aguarde ~2 min até provisionar.
4. Vá em **Project Settings → API** e copie:
   - **Project URL** (ex: `https://abcdefg.supabase.co`)
   - **anon public** (chave longa)
   - **service_role secret** ⚠ NUNCA exponha esta

---

## 2. Configurar `.env.local`

Na raiz de `Dash Libertas/`, crie o arquivo `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (a service_role)

NEXT_PUBLIC_APP_URL=http://localhost:3000
USE_MOCK_DATA=false
```

> **`.env.local` está no `.gitignore`** — nunca commita.

Reinicie o `npm run dev` para o Next pegar as novas variáveis.

---

## 3. Rodar a migration SQL

1. No painel do Supabase, vá em **SQL Editor → New query**
2. Abra o arquivo `supabase/migrations/0001_init.sql` deste projeto
3. Cole o conteúdo inteiro no editor e clique em **Run**

Vai criar:
- 5 tabelas (`fb_connections`, `fb_ad_insights`, `sales`, `webhook_configs`, `sync_logs`)
- 1 view (`ad_performance`) — onde acontece o cruzamento
- Índices e triggers
- Uma linha em `webhook_configs` com um `webhook_secret` gerado automaticamente

Depois disso, recarregue http://localhost:3000 — o banner amarelo "modo demonstração" some.

---

## 4. Conectar o Meta Ads

1. Pegue um **Access Token** com permissão `ads_read` (ou `ads_management`):
   - **Opção A — Token rápido pra testar:** https://developers.facebook.com/tools/explorer/
   - **Opção B — Token longo (recomendado):** crie um System User no Business Manager
2. Vá em `/configuracoes` → aba **Meta Ads**
3. Cole o token e clique em **Validar token**
4. Selecione sua conta de anúncios
5. Clique em **Salvar conexão**
6. Vá na aba **Sincronização** → **Sincronizar agora**

Em ~30 segundos os dados aparecem no painel.

---

## 5. Conectar o webhook da Hotmart

1. Vá em `/configuracoes` → aba **Hotmart · Webhook**
2. Copie a **URL do webhook** (algo tipo `https://app.libertas.dev/api/webhook/hotmart/a7f29c0e...`)

> Se ainda está rodando local, use `ngrok` ou similar para expor a porta 3000.
> Ex: `ngrok http 3000` → use a URL `https://xxx.ngrok-free.app/api/webhook/hotmart/{secret}`

3. No painel da Hotmart:
   - Vá em **Ferramentas → Postback → Adicionar Postback**
   - Cole a URL
   - Marque os eventos: **PURCHASE_APPROVED**, **PURCHASE_REFUNDED**, **PURCHASE_CHARGEBACK**, **PURCHASE_DELAYED**
   - (Opcional) Copie o **Hottok** da Hotmart e cole no campo correspondente no painel pra ativar validação

4. ⚠ **Crítico — configure o `utm_content` nos seus anúncios:**

   No Meta Ads Manager, no nível do anúncio, preencha o campo **Parâmetros de URL** com:

   ```
   utm_source=facebook
   utm_medium=paid
   utm_campaign={{campaign.name}}
   utm_term={{adset.name}}
   utm_content={{ad.id}}
   ```

   **É o `{{ad.id}}` no `utm_content` que torna o cruzamento possível.** Sem isso, vendas chegam mas não conseguem vincular ao anúncio.

5. Clique em **Enviar teste** na Hotmart pra confirmar que o webhook está recebendo.

---

## 6. Pronto

Daqui pra frente:
- O painel sincroniza automaticamente os insights do Meta a cada 30 minutos (a fazer: Vercel Cron).
- Toda venda na Hotmart aparece em tempo real no feed.
- ROAS, CPA, lucro — tudo calculado pelo cruzamento `sales.utm_content = fb_ad_insights.ad_id`.

---

## Resolução de problemas

**"Modo demonstração" continua aparecendo**
→ Verifique se `.env.local` tem as variáveis preenchidas e reinicie `npm run dev`.

**Conta de anúncios não aparece após validar token**
→ Verifique se o token tem a permissão `ads_read`. Tokens da Marketing API Explorer expiram em 1h.

**Vendas chegam mas aparecem como "sem vínculo"**
→ O `utm_content` não está sendo enviado, ou está com valor diferente do `ad.id`. Confira o campo "Parâmetros de URL" do anúncio no Meta.

**Webhook retorna 401**
→ A URL não bate com o `webhook_secret`. Use o botão **Regenerar secret** e atualize na Hotmart.

**Webhook retorna 422 / "payload inválido"**
→ Confira que está enviando o formato Postback 2.0 da Hotmart (com `event` e `data.purchase`).

---

## Estrutura do projeto

```
Dash Libertas/
├── app/
│   ├── page.tsx                    # Painel principal
│   ├── campanhas/page.tsx          # Drill-down de campanhas
│   ├── vendas/page.tsx             # Lista de vendas
│   ├── configuracoes/page.tsx      # Setup do Meta + Hotmart
│   └── api/
│       ├── webhook/hotmart/[secret]/route.ts   # ⚠ Endpoint da Hotmart
│       ├── webhook/config/route.ts             # Config + log de eventos
│       ├── facebook/validate-token/route.ts
│       ├── facebook/connect/route.ts
│       ├── facebook/sync/route.ts              # Importa insights do Meta
│       ├── dashboard/route.ts
│       ├── campaigns/route.ts
│       └── sales/route.ts
├── components/                     # UI
├── lib/
│   ├── supabase.ts                 # Cliente server-side
│   ├── meta.ts                     # API do Meta
│   ├── hotmart.ts                  # Parser do payload
│   ├── data.ts                     # Camada de dados (real OU mock)
│   ├── mockData.ts                 # Dados de demo
│   └── mockApi.ts                  # Fallback das APIs
└── supabase/
    └── migrations/0001_init.sql    # Schema do banco
```
