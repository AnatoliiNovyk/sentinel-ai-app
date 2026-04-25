# Batch 74 — Real nmap implementation + VPS deploy fix

## Як було

- `runNmap()` в `sentinel-agent/src/index.ts` була заглушкою: завжди повертала хардкодований finding `{ title: 'Port Scan Result', severity: 'info' }` незалежно від таргету. Реального сканування не відбувалось.
- `setup-vps.sh` при оновленні (`git pull`) не оновлював `package.json` і `tsconfig.json` — тільки `src/`. При зміні залежностей (`dependencies`) це призводило до помилок компіляції (`TS2307: Cannot find module 'axios'`).

## Що зроблено

### `sentinel-agent/src/index.ts`
- Додано `import { execFile } from 'child_process'` та `import { promisify } from 'util'`.
- Реалізовано `sanitizeTarget(target)` — whitelist-валідація через regex `^[a-zA-Z0-9.\-:/\[\]]+$`. При shell-метасимволах (`;`, `|`, `$`, `&` тощо) кидає `Error`. Захист від command injection.
- Реалізовано `portSeverity(port, service)` — маппінг порту/сервісу на severity: critical (telnet, ftp, tftp, rsh), high (ssh, smtp, rdp, smb, vnc), medium (http, MySQL, PostgreSQL, Redis, MongoDB), low/info для решти.
- Реалізовано `parseNmapXml(xml, target)` — regex-based парсинг XML-виводу nmap (`-oX -`): витягує `<port>` блоки, фільтрує тільки `state="open"`, читає service/product/version/extrainfo атрибути, конвертує у `Finding[]` з описом і remediation.
- Замінено `runNmap()` заглушку на реальний виклик `execFileAsync('nmap', ['-sV', '-T4', '--open', '-oX', '-', safeTarget])` з timeout 5 хв, maxBuffer 10MB. При `ENOENT` — чітке повідомлення "nmap is not installed".

### `sentinel-agent/setup-vps.sh`
- Виправлено блок "clone/update": тепер при оновленні копіюються `src/`, `package.json` і `tsconfig.json` з repo.
- Замінено `npm ci --omit=dev` на `rm -rf node_modules && npm install` — гарантує чисту установку всіх залежностей включно з devDependencies для білду.
- Додано `git config --global --add safe.directory` перед `git pull` — фікс "dubious ownership" помилки.

## Що покращило / виправило / додало

- **Реальне сканування**: при запущеному nmap на VPS агент повертає реальні знахідки відкритих портів замість хардкоду.
- **Безпека**: `sanitizeTarget` захищає від command injection при передачі user-provided таргетів в shell.
- **VPS deploy**: `setup-vps.sh` тепер правильно оновлює всі файли агента — більше не потрібно вручну копіювати `package.json` після кожного деплою.
- **TypeScript**: обидва — локально (`npx tsc --noEmit`) і на VPS (`npm run build`) — компілюються без помилок.
