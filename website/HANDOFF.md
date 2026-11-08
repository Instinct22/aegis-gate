# Aegis Gate — передача лендинга на сервер

Домен: **https://aegis-gate.ru/**  
Сейчас на домене заглушка «Сайт готовится» — её нужно заменить содержимым из `deploy/`.

## Что отдать компаньону

Архив **`aegis-gate-landing-deploy.zip`** (лежит рядом с этой папкой `website/`)  
или папку **`website/deploy/`**.

Внутри — только то, что кладётся в web-root (Nginx/Caddy):

```text
index.html
styles.css
script.js
site.js
config.js          ← сюда правки ссылок без вёрстки
robots.txt
sitemap.xml
site.webmanifest
assets/            favicon, og-image, иконки
legal/
  offer.html
  privacy.html
HANDOFF.md
```

Не нужно заливать: `logos/`, `variants/`, скрипты упаковки, designer-pack.

## Что сделать на сервере

1. Положить файлы в корень сайта (например `/var/www/aegis-gate/`).
2. Nginx/Caddy: `root` на эту папку, `index index.html`, HTTPS (Let's Encrypt).
3. Открыть https://aegis-gate.ru/ — должен открыться лендинг.
4. Заполнить **`config.js`**:
   - `downloads.windows|android|macos` — URL файлов релизов;
   - `cabinetUrl` — кабинет / Mini App;
   - `support.telegram` — ссылка на поддержку;
   - `legal.teamName` / `legal.offerDate` — исполнитель в текстах условий;
   - `trial.days` — пробный период (сейчас 3);
   - `pricing.paymentsReady` — когда оплата заработает.
5. Положить бинарники релизов, например в `/downloads/` и прописать пути в `config.js`.

Пример Nginx:

```nginx
server {
  server_name aegis-gate.ru www.aegis-gate.ru;
  root /var/www/aegis-gate;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /downloads/ {
    alias /var/www/aegis-gate-downloads/;
    add_header Content-Disposition attachment;
  }
}
```

## Что ещё нужно для «полного» релиза продукта

| Блок | Кто | Статус |
|---|---|---|
| Лендинг на домене | компаньон (сервер) | готово к выкладке |
| HTTPS / DNS A-запись на VPS | компаньон | домен уже есть |
| Релизы Windows/Android/macOS | вы / сборка | ссылки в config.js |
| Личный кабинет + оплата | компаньон | отдельный сервис |
| Условия / privacy | вы | исполнитель: Aegis Gate team |
| Почта support@aegis-gate.ru | DNS MX / почтовый ящик | желательно до продаж |
| Telegram поддержки | вы | в config.js |

Кабинет и оплата — **не** в этом zip. Лендинг только витрина + юридические страницы + кнопки.

## Быстрая проверка после деплоя

- [ ] https://aegis-gate.ru/ открывается, не «Сайт готовится»
- [ ] /legal/offer.html и /legal/privacy.html открываются
- [ ] favicon виден
- [ ] после заполнения config.js кнопки «Скачать» ведут на файлы
