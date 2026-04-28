# Implementation Plan — 2026-04-28

## Мета
Стабілізувати production scan pipeline (dispatch -> queue -> result) і зробити його прозорим для діагностики без суперечливого UX.

## Scope
- In scope:
  - Lifecycle-логування в `scan-dispatch` і `scan-result` через `agent_logs`.
  - Уніфікація операційної спостережуваності ключових подій pipeline.
  - Валідація якості (`lint`, `build`) і деплой edge functions.
- Out of scope:
  - Великий рефакторинг state management.
  - Повний перехід на нову queue-платформу.
  - RAG/AI покращення до стабілізації ядра.

## P0 (Негайно)
1. Додати non-blocking helper `insertAgentLog` у `scan-dispatch`.
2. Логувати: `request accepted`, `rate-limited`, `job queued`, `dispatch failed`.
3. Додати non-blocking helper `insertAgentLog` у `scan-result`.
4. Логувати: `result received`, `scan failed`, `chat response completed`, `scan completed with N findings`.
5. Переконатися, що лог-фейли не блокують основний flow (тільки `console.warn`).
6. Запустити локальні перевірки якості.
7. Задеплоїти `scan-dispatch` і `scan-result` у Supabase.

## P1 (Після P0)
1. Додати retry/backoff policy для transient error path у результатах агента.
2. Додати audit trail подій scan lifecycle у `audit_logs` через `AuditService`.
3. Ввести базові operational алерти (Slack/Teams webhook) по `scan_failed`/rate-limit spikes.
4. Додати smoke e2e чек у release workflow для запуску одного реального скану.

## P2 (Після P1)
1. Еволюція job queue до стійкішої моделі при масштабуванні.
2. Розширена observability (SLO/latency dashboard, MTTR метрики).
3. Після стабілізації ядра — RAG/AI enhancements.

## Залежності
1. `agent_logs` table + RLS вже мають бути застосовані (migration `20260425120000_create_agent_logs.sql`).
2. Supabase CLI має бути залогінений і прив'язаний до прод-проєкту.
3. AGENT_SECRET у проді має відповідати агенту.

## Команди верифікації
1. `npm run lint -- --max-warnings=0`
2. `npm run build`
3. `supabase functions deploy scan-dispatch`
4. `supabase functions deploy scan-result`

## Критерії приймання
1. Edge functions повертають попередні API-відповіді без змін контракту.
2. У `agent_logs` з'являються події lifecycle для успіху й помилки.
3. Локальні перевірки `lint/build` проходять.
4. Після деплою прод-сценарій запуску скану не деградує.
