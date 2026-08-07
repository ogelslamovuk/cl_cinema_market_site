# Запуск PoC

PoC состоит из одного Python-процесса, SQLite-файла и статического dashboard.
Docker и отдельные сервисы не используются.

## Сбор

```powershell
python market.py run
```

Процесс самостоятельно:

- обновляет расписание ByCard;
- снимает данные перед stop-sale;
- пишет их в `data/market.sqlite3`;
- атомарно обновляет `docs/data/market.json`.

Остановка: `Ctrl+C`. Перед завершением runner ещё раз экспортирует JSON.

## Dashboard

Dashboard — обычные статические файлы в `docs/`. Для локальной проверки можно
использовать любой простой HTTP-сервер, например:

```powershell
python -m http.server 8000 --directory docs
```

GitHub Pages публикует папку `docs/` стандартным workflow после push в `main`.
Рабочий Pages URL: `https://ogelslamovuk.github.io/cl_cinema_parcer/`.

## Silver Screen

После согласования query read-only CSV выгружается с явным диапазоном дат:

```powershell
python scripts/export_silver_screen.py `
  --env-file C:\path\config.env `
  --date-from 2026-08-03 `
  --date-to-exclusive 2026-08-04 `
  --output tmp\silver_screen_2026-08-03.csv
```

Полученный CSV загружается в staging:

```powershell
python market.py silver-stage --file approved_export.csv
```

До согласования бизнес-смысла полей staged-данные не участвуют в KPI.

## Закрытие дня

После завершения дневного сбора можно одной командой собрать итоговый dashboard:

```powershell
python scripts/close_market_day.py `
  --date 2026-08-06 `
  --mysql-config-yaml D:\JetBrains\cl_payments_reports\config.yaml `
  --publish
```

Команда выполняет весь дневной flow:

- read-only делает snapshot SQLite с VPS через `phylex-vps`, не трогая systemd-сборщик;
- запускает согласованный mooon query за диапазон `[date; date + 1 day)`;
- при неуспехе mooon query повторяет попытку;
- staging + approval делает с утверждёнными метриками `net_ticket_quantity` и `net_gross_amount`;
- пересобирает `docs/data/market.json`;
- запускает `verify.py`;
- с флагом `--publish` коммитит и пушит только обновлённый JSON dashboard.

Для dry-run без публикации уберите `--publish`. Для проверки на уже скопированной SQLite БД используйте
`--no-pull-vps-db --db path\to\market.sqlite3`.

Постоянный runner для автоматического закрытия каждого завершённого дня:

```powershell
python scripts/daily_close_runner.py `
  --time 02:30 `
  --mysql-config-yaml D:\JetBrains\cl_payments_reports\config.yaml `
  --publish
```

Runner не трогает ByCard-сборщик. Он раз в сутки вызывает `close_market_day.py` за предыдущую дату Минска.
