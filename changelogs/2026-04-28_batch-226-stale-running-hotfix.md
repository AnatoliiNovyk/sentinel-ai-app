# Batch 226: Hotfix для застряглих running scan/job

## Як було
- У проді накопичилися застряглі записи зі статусом `running`.
- Частина scan залишалась у `running` годинами без завершення.
- Це блокувало коректну картину в UI і створювало ризик черги.

## Що зроблено
- Через Supabase REST (service role) виконано cleanup тільки для застарілих записів (older than 180 minutes):
  - `scan_jobs`: `running` -> `error`, `error_message='stale timeout auto-fail'`, `completed_at=now()`.
  - пов’язані `scans` (лише де ще `running`): `running` -> `failed`, `completed_at=now()`.
- Підсумок операції:
  - `staleJobsFound`: 18
  - `jobsUpdated`: 18
  - `scansUpdated`: 6

## Що покращило
- Прибрано "вічні" running-стани в UI.
- Розблоковано queue/state consistency для наступних запусків сканів.
- Відновлено коректну операційну картину по active/failed scan.
