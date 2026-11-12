/* global window */
/**
 * Публичные настройки лендинга.
 * Компаньон (бэкенд) может править только этот файл после деплоя.
 */
window.AEGIS_CONFIG = {
  siteUrl: "https://aegis-gate.ru",
  cabinetUrl: "",
  support: {
    email: "support@aegis-gate.ru",
    /**
     * Профиль на время теста выдаётся здесь.
     */
    telegram: "https://t.me/Instinct22",
  },
  downloads: {
    windows: "",
    android: "",
    macos: "",
  },
  trial: {
    days: 3,
    enabled: true,
  },
  /**
   * Пинги по странам.
   * Когда будет API — укажите endpoint, ожидаемый JSON:
   * { "fi": 24, "de": 31, "it": 42, "ee": 28 }
   * или { "pings": { ... } }
   */
  pings: {
    endpoint: "",
    values: {
      fi: null,
      de: null,
      it: null,
      ee: null,
    },
  },
  pricing: {
    enabled: true,
    paymentsReady: false,
    currency: "₽",
    plans: [
      {
        id: "trial",
        name: "Пробный период",
        nameKey: "plan.trial.name",
        price: "0",
        note: "3 дня полного доступа — изучите приложение и проверьте его у себя",
        noteKey: "plan.trial.note",
        highlight: true,
      },
      {
        id: "month",
        name: "1 месяц",
        nameKey: "plan.month.name",
        price: "—",
        note: "Оплата появится позже",
        noteKey: "plan.month.note",
      },
      {
        id: "year",
        name: "Долгий доступ",
        nameKey: "plan.year.name",
        price: "—",
        note: "Тарифы уточним при запуске оплаты",
        noteKey: "plan.year.note",
      },
    ],
  },
  legal: {
    teamName: "Aegis Gate team",
    offerDate: "2026-11-04",
  },
};
