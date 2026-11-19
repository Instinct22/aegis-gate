/* global window */
/**
 * Публичные настройки сайта. После деплоя достаточно поправить этот файл.
 */
window.AEGIS_CONFIG = {
  siteUrl: 'https://aegis-gate.ru',
  email: 'support@aegis-gate.ru',

  /**
   * Актуальная версия приложения. nginx проксирует этот путь на
   * https://api.aegis-gate.ru/api/app/latest (тот же API, что у автообновления).
   */
  latestApi: '/api/app/latest',
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
  },
};
