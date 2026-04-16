/**
 * Lightweight i18n module for werewolf-cf
 * Progressive enhancement: if this fails to load, original hardcoded text remains as fallback
 */
const I18n = (() => {
  const SUPPORTED_LOCALES = ['zh-TW', 'ja', 'en'];
  const DEFAULT_LOCALE = 'zh-TW';
  let currentLocale = localStorage.getItem('locale') || DEFAULT_LOCALE;
  let translations = {};

  /**
   * Initialize i18n: load locale file and replace all data-i18n elements
   */
  async function init() {
    try {
      const resp = await fetch(`/locales/${currentLocale}.json`);
      if (!resp.ok) {
        console.warn(`I18n: Failed to load locale ${currentLocale}, using fallback`);
        return;
      }
      translations = await resp.json();
    } catch (e) {
      console.warn('I18n: Failed to initialize, using fallback text', e);
      return;
    }

    // Replace all [data-i18n] elements text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      if (translated !== key) {
        el.textContent = translated;
      }
    });

    // Replace all [data-i18n-placeholder] elements
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translated = t(key);
      if (translated !== key) {
        el.placeholder = translated;
      }
    });

    // Replace all [data-i18n-title] elements
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translated = t(key);
      if (translated !== key) {
        el.title = translated;
      }
    });

    // Update document title if data-i18n-page-title exists
    const pageTitleEl = document.querySelector('[data-i18n-page-title]');
    if (pageTitleEl) {
      document.title = t(pageTitleEl.getAttribute('data-i18n-page-title'));
    }

    // Update html lang attribute
    document.documentElement.lang = currentLocale;
  }

  /**
   * Translate a key with optional interpolation parameters
   * @param {string} key - Translation key (dot-notation)
   * @param {Object} params - Interpolation parameters e.g. { count: 5 }
   * @returns {string} Translated string, or key as fallback
   */
  function t(key, params = {}) {
    let str = translations[key] || key;
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return str;
  }

  /**
   * Switch locale and reload the page
   * @param {string} locale - Target locale code
   */
  function setLocale(locale) {
    if (SUPPORTED_LOCALES.includes(locale)) {
      localStorage.setItem('locale', locale);
      currentLocale = locale;
      location.reload();
    }
  }

  /**
   * Get current locale
   * @returns {string} Current locale code
   */
  function getLocale() {
    return currentLocale;
  }

  return { init, t, setLocale, getLocale, SUPPORTED_LOCALES };
})();
