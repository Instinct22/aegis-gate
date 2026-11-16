/* global window */
/**
 * Публичные настройки сайта. После деплоя достаточно поправить этот файл.
 */
window.AEGIS_CONFIG = {
  siteUrl: 'https://aegis-gate.ru',
  telegram: 'https://t.me/Instinct22',
  email: 'support@aegis-gate.ru',

  /**
   * Актуальная версия приложения. nginx проксирует этот путь на
   * https://api.aegis-gate.ru/api/app/latest (тот же API, что у автообновления).
   */
  latestApi: '/api/app/latest',
  /** Снимки VirusTotal. Ключ — SHA-256 файла, который отдаёт latest. */
  trustUrl: '/trust.json',
  channel: 'stable',

  /** Запасные ссылки, если API не ответил. */
  downloads: {
    version: '1.3.6',
    windows: 'https://api.aegis-gate.ru/api/app/download/AegisGate-1.3.6-windows-amd64-setup.exe',
    android: {
      arm64: 'https://api.aegis-gate.ru/api/app/download/AegisGate-1.3.6-android-arm64.apk',
      arm: 'https://api.aegis-gate.ru/api/app/download/AegisGate-1.3.6-android-arm.apk',
      x64: 'https://api.aegis-gate.ru/api/app/download/AegisGate-1.3.6-android-x64.apk',
    },
    sha256: {
      windows: 'f93a2e58544343762fa317aab33627ccf289895b34260810797be7b0eae9d40d',
      android: {
        arm64: '42dc20634dc4ef142e7ce53a4d4a6dba744c306e6ecbb3120b5b1bb6ce9eae91',
        arm: '2f2d9109415e4d2c6184e442c0cf5ec18932a62ce57e6a5ca59043b107399cac',
        x64: '8a0982225a9afdfae8656d0508a90b30400c9075c7ddf4d95766025ac0cf1e35',
      },
    },
  },
};
