# Changelog: Спроба деплою sentinel-agent на VPS

Дата: 2026-05-04

## Як було
- Потрібно оновити `sentinel-agent` на VPS `95.67.75.146` через SSH (`git pull`, `docker-compose up -d --build`).

## Що зроблено
- Виконано перевірку SSH підключення:
  - `ssh user@95.67.75.146 "hostname; pwd; ls -la"` → timeout
- Виконано мережеву діагностику:
  - `Test-NetConnection 95.67.75.146 -Port 22` → `TcpTestSucceeded: False`
  - `Test-NetConnection 95.67.75.146 -Port 2222` → `TcpTestSucceeded: False`
  - Ping також не проходить (`TimedOut`).

## Що покращило / виправило / додало
- Підтверджено, що з поточного середовища доступ до VPS відсутній на мережевому рівні (не проблема команди деплою).
- Звузило область проблеми: потрібно відкрити доступ (фаєрвол/SG/NAT/VPS стан) або надати інший reachable endpoint/порт/VPN bastion.

## Наступний крок
Після відновлення доступу виконати:
1. `ssh <user>@95.67.75.146`
2. `cd <path-to-sentinel-agent>`
3. `git pull`
4. `docker-compose down`
5. `docker-compose up -d --build`
6. `docker-compose ps`
7. `docker-compose logs --tail=100 sentinel-agent`
