import React, { createContext, useContext, useState } from 'react';

export type SupportedLanguage = 'Русский' | 'English' | 'Ўзбекча' | 'Қазақша' | 'Türkçe' | 'Deutsch';

export interface Translations {
  chats: string;
  wallet: string;
  feed: string;
  profile: string;
  aiAssistant: string;
  orbBalance: string;
  subscriptions: string;
  followers: string;
  languageAndRegion: string;
  platformLanguage: string;
  countryOfResidence: string;
  securityAndRegistration: string;
  emailVerification: string;
  profilePinCode: string;
  confirmed: string;
  confirm: string;
  setPin: string;
  changePin: string;
  pushNotifications: string;
  soundSignals: string;
  darkTheme: string;
  logout: string;
  stories: string;
  addStory: string;
  publishStory: string;
  search: string;
  send: string;
  pause: string;
  continue: string;
}

const dictionaries: Record<SupportedLanguage, Translations> = {
  Русский: {
    chats: 'Чаты',
    wallet: 'Кошелек',
    feed: 'Лента',
    profile: 'Профиль',
    aiAssistant: 'ИИ Ассистент',
    orbBalance: 'Баланс ORB',
    subscriptions: 'Подписки',
    followers: 'Подписчики',
    languageAndRegion: 'Язык & Регион',
    platformLanguage: 'Язык платформы',
    countryOfResidence: 'Страна проживания',
    securityAndRegistration: 'Безопасность & Регистрация',
    emailVerification: 'Подтверждение почты',
    profilePinCode: 'ПИН-код защиты профиля',
    confirmed: 'Подтверждено',
    confirm: 'Подтвердить',
    setPin: 'Установить',
    changePin: 'Изменить',
    pushNotifications: 'Push-уведомления',
    soundSignals: 'Звуковые сигналы',
    darkTheme: 'Тёмная тема',
    logout: 'Выйти из аккаунта',
    stories: 'Истории',
    addStory: '+ История',
    publishStory: 'Опубликовать историю',
    search: 'Поиск',
    send: 'Отправить',
    pause: 'Пауза',
    continue: 'Продолжить',
  },
  English: {
    chats: 'Chats',
    wallet: 'Wallet',
    feed: 'Feed',
    profile: 'Profile',
    aiAssistant: 'AI Assistant',
    orbBalance: 'ORB Balance',
    subscriptions: 'Subscriptions',
    followers: 'Followers',
    languageAndRegion: 'Language & Region',
    platformLanguage: 'Platform Language',
    countryOfResidence: 'Country of Residence',
    securityAndRegistration: 'Security & Registration',
    emailVerification: 'Email Verification',
    profilePinCode: 'Profile PIN Code',
    confirmed: 'Confirmed',
    confirm: 'Confirm',
    setPin: 'Set PIN',
    changePin: 'Change PIN',
    pushNotifications: 'Push Notifications',
    soundSignals: 'Sound Signals',
    darkTheme: 'Dark Theme',
    logout: 'Log Out',
    stories: 'Stories',
    addStory: '+ Story',
    publishStory: 'Publish Story',
    search: 'Search',
    send: 'Send',
    pause: 'Pause',
    continue: 'Continue',
  },
  Ўзбекча: {
    chats: 'Чатлар',
    wallet: 'Хамён',
    feed: 'Лента',
    profile: 'Профил',
    aiAssistant: 'ИИ Ёрдамчи',
    orbBalance: 'ORB Баланси',
    subscriptions: 'Обуналар',
    followers: 'Обуначилар',
    languageAndRegion: 'Тил & Минтақа',
    platformLanguage: 'Платформа тили',
    countryOfResidence: 'Яшаш мамлакати',
    securityAndRegistration: 'Хавфсизлик & Ройхатдан отиш',
    emailVerification: 'Почтани тасдиқлаш',
    profilePinCode: 'ПИН-код',
    confirmed: 'Тасдиқланди',
    confirm: 'Тасдиқлаш',
    setPin: 'Орнатиш',
    changePin: 'Озгартириш',
    pushNotifications: 'Push-билдиришномалар',
    soundSignals: 'Овозли сигналлар',
    darkTheme: 'Тунги режим',
    logout: 'Тизимдан чиқиш',
    stories: 'Тарихлар',
    addStory: '+ Тарих',
    publishStory: 'Тарихни чоп этиш',
    search: 'Қидирув',
    send: 'Юбориш',
    pause: 'Пауза',
    continue: 'Давом эттириш',
  },
  Қазақша: {
    chats: 'Чаттар',
    wallet: 'Әмиян',
    feed: 'Лента',
    profile: 'Профиль',
    aiAssistant: 'ИИ Көмекші',
    orbBalance: 'ORB Балансы',
    subscriptions: 'Жазылымдар',
    followers: 'Оқырмандар',
    languageAndRegion: 'Тіл & Аймақ',
    platformLanguage: 'Платформа тілі',
    countryOfResidence: 'Тұратын елі',
    securityAndRegistration: 'Қауіпсіздік & Тіркелу',
    emailVerification: 'Поштаны растау',
    profilePinCode: 'ПИН-код',
    confirmed: 'Расталды',
    confirm: 'Растау',
    setPin: 'Орнату',
    changePin: 'Өзгерту',
    pushNotifications: 'Push-хабарландырулар',
    soundSignals: 'Дыбыстық сигналдар',
    darkTheme: 'Түнгі режим',
    logout: 'Шығу',
    stories: 'Оқиғалар',
    addStory: '+ Оқиға',
    publishStory: 'Оқиғаны жариялау',
    search: 'Издеу',
    send: 'Жіберу',
    pause: 'Кідіріс',
    continue: 'Жалғастыру',
  },
  Türkçe: {
    chats: 'Sohbetler',
    wallet: 'Cüzdan',
    feed: 'Akış',
    profile: 'Profil',
    aiAssistant: 'Yapay Zeka Asistanı',
    orbBalance: 'ORB Bakiyesi',
    subscriptions: 'Abonelikler',
    followers: 'Takipçiler',
    languageAndRegion: 'Dil & Bölge',
    platformLanguage: 'Platform Dili',
    countryOfResidence: 'Yaşadığı Ülke',
    securityAndRegistration: 'Güvenlik & Kayıt',
    emailVerification: 'E-posta Doğrulama',
    profilePinCode: 'Profil PIN Kodu',
    confirmed: 'Doğrulandı',
    confirm: 'Doğrula',
    setPin: 'PIN Belirle',
    changePin: 'PIN Değiştir',
    pushNotifications: 'Bildirimler',
    soundSignals: 'Sesli Sinyaller',
    darkTheme: 'Karanlık Tema',
    logout: 'Çıkış Yap',
    stories: 'Hikayeler',
    addStory: '+ Hikaye',
    publishStory: 'Hikaye Paylaş',
    search: 'Ara',
    send: 'Gönder',
    pause: 'Duraklat',
    continue: 'Devam Et',
  },
  Deutsch: {
    chats: 'Chats',
    wallet: 'Geldbörse',
    feed: 'Feed',
    profile: 'Profil',
    aiAssistant: 'KI-Assistent',
    orbBalance: 'ORB-Guthaben',
    subscriptions: 'Abonnements',
    followers: 'Follower',
    languageAndRegion: 'Sprache & Region',
    platformLanguage: 'Plattform-Sprache',
    countryOfResidence: 'Wohnsitzland',
    securityAndRegistration: 'Sicherheit & Registrierung',
    emailVerification: 'E-Mail-Bestätigung',
    profilePinCode: 'Profil-PIN',
    confirmed: 'Bestätigt',
    confirm: 'Bestätigen',
    setPin: 'PIN festlegen',
    changePin: 'PIN ändern',
    pushNotifications: 'Push-Benachrichtigungen',
    soundSignals: 'Tonsignale',
    darkTheme: 'Dunkles Design',
    logout: 'Abmelden',
    stories: 'Stories',
    addStory: '+ Story',
    publishStory: 'Story veröffentlichen',
    search: 'Suchen',
    send: 'Senden',
    pause: 'Pause',
    continue: 'Fortsetzen',
  },
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'Русский',
  setLanguage: () => {},
  t: dictionaries['Русский'],
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem('orbit_app_lang') as SupportedLanguage;
    return saved && dictionaries[saved] ? saved : 'Русский';
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('orbit_app_lang', lang);
  };

  const t = dictionaries[language] || dictionaries['Русский'];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
