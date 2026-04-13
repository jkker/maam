import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'
import { initReactI18next, I18nextProvider } from 'react-i18next'

void i18n
  .use(HttpBackend)
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    // debug: import.meta.env.MODE === 'development',
    fallbackLng: 'en',
    load: 'languageOnly',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  })

export const ReactI18nextProvider = ({ children }: React.PropsWithChildren) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)
