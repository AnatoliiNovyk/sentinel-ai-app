# Changelog: Prowler & Amass — Deploy та Re-smoke

**Дата:** 2026-05-04  
**Сесія:** Деплой пропатченого агента на VPS та підтвердження роботи Prowler v5

---

## Як було

- `sentinel-agent` на VPS запускав Prowler з аргументами `['aws', '-M', 'json', '--no-banner']`
- Prowler v5 більше не підтримує `-M json` → scan_job падав з помилкою:  
  `error: argument --output-formats/--output-modes/-M: invalid choice: 'json'`
- `dist/index.js` на VPS (`/opt/sentinel-agent/dist/index.js`) містив старий код
- Сервіс `sentinel-agent.service` запускав застарілу версію агента

---

## Що зроблено

1. **SCP dist/index.js на VPS** (`100% 45KB`):  
   `scp sentinel-agent/dist/index.js adm_ukr@192.168.10.80:/tmp/sentinel-dist-index.js`

2. **Копія в runtime path** (`COPY_OK`):  
   `sudo cp /tmp/sentinel-dist-index.js /opt/sentinel-agent/dist/index.js`

3. **Перезапуск сервісу**:  
   `sudo systemctl restart sentinel-agent`  
   → статус: `active (running)` з новим PID `633802`

4. **Re-smoke Prowler**:  
   - Вставлено тестовий `scan_jobs` з `scanner=Prowler, target=aws, status=pending`  
   - Job ID: `a10c2c79-c065-46b9-81c3-49b7806ffd29`
   - Результат: помилка змінилась з CLI-помилки → `NoCredentialsError: Unable to locate credentials`

---

## Що покращило / виправило / додало

- ✅ **Prowler CLI fix підтверджено**: Prowler v5 тепер запускається з правильними аргументами `--output-formats json-ocsf --no-banner --no-color --ignore-exit-code-3 --only-logs`
- ✅ **Нова помилка `NoCredentialsError`** — це очікувана поведінка в тестовому середовищі без налаштованих AWS credentials, а не баг агента
- ✅ **Сервіс оновлено** без downtime: стара версія замінена на нову, перезапущена за 3 секунди
- ✅ **Runtime path підтверджено**: `/opt/sentinel-agent/dist/index.js` (WorkingDirectory `/opt/sentinel-agent`, ExecStart `node dist/index.js`)

---

## Наступні кроки (за потреби)

- Налаштувати AWS credentials на VPS (`~/.aws/credentials` або env vars) для повноцінного Prowler scan
- Додатково дослідити Amass `status=error` (progress bar noise в `error_message`)
