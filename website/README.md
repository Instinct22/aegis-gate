# Aegis Gate — публичный лендинг

Сайт **без авторизации** для домена [aegis-gate.ru](https://aegis-gate.ru/).

## Локальный просмотр

Откройте `index.html` в браузере **или** (надёжнее):

```bash
cd website
python -m http.server 8765
```

→ http://127.0.0.1:8765/

Пути относительные — тема и скрипты работают и через `file://`, и с сервера.

## Что править перед релизом

Файл **`config.js`**: ссылки на скачивание, кабинет, Telegram, тексты условий.

## Docker (как у converter)

```bash
docker build -t aegis-gate-landing .
docker run --rm -p 8088:80 aegis-gate-landing
```

## GitHub Actions → Docker Hub

В репозитории уже есть `.github/workflows/docker-publish.yml`.

Secrets (Settings → Secrets and variables → Actions):

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

При push в `main` собирается образ `{REGISTRY}/aegis-gate-landing:latest`.

Деплой на VPS (SSH / Caddy) настраивает компаньон по аналогии с converter.

## Структура для git

В репозиторий класть корень этой папки `website/` (или содержимое без служебного):

- `index.html`, `styles.css`, `script.js`, `site.js`, `config.js`
- `assets/`, `legal/`
- `Dockerfile`, `nginx.conf`, `docker-compose.yml`
- `.github/workflows/docker-publish.yml`

Не обязательно в git: `logos/`, `variants/`, `deploy/`, архивы (см. `.gitignore`).
