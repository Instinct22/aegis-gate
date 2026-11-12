# Статический лендинг Aegis Gate (публичный, без авторизации)
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# В образ кладём только то, что нужно отдавать с домена
COPY index.html faq.html styles.css script.js site.js config.js i18n.js \
     robots.txt sitemap.xml site.webmanifest /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY legal /usr/share/nginx/html/legal

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
