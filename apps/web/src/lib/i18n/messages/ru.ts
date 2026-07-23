import type { Messages } from './en';
import { ruExtended } from './ru-extended';

const { homePage, common: commonExtended, ...extendedNamespaces } = ruExtended;

export const ru: Messages = {
  common: {
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    pleaseWait: 'Подождите…',
    close: 'Закрыть',
    loading: 'Загрузка…',
    email: 'Email',
    password: 'Пароль',
    home: 'Главная',
    optional: 'Необязательно',
    saved: 'Сохранено',
    dash: '—',
    ...commonExtended,
  },
  header: {
    admin: 'Админ',
    contractor: 'Подрядчик',
    account: 'Аккаунт',
    signIn: 'Войти',
    signOut: 'Выйти',
    signedIn: 'Вы вошли',
    language: 'Язык',
    lang_en: 'English',
    lang_th: 'ไทย',
    lang_ru: 'Русский',
  },
  footer: {
    copyright: '© {year} Ant. Все права защищены.',
    legalNav: 'Правовая информация',
    privacyPolicy: 'Политика конфиденциальности',
    termsOfService: 'Условия использования',
    clientAgreement: 'Клиентское соглашение',
    contractorAgreement: 'Соглашение подрядчика',
  },
  auth: {
    welcomeBack: 'С возвращением',
    createAccount: 'Создайте аккаунт',
    signInSubtitle:
      'Войдите, чтобы управлять проектами и предложениями подрядчиков.',
    signUpSubtitle:
      'Присоединяйтесь к Ant — публикуйте проекты или участвуйте в тендерах.',
    fullName: 'Полное имя',
    emailPlaceholder: 'you@example.com',
    roleLegend: 'Ваши роли',
    roleHint:
      'Выберите, как вы будете использовать платформу. Позже можно изменить.',
    signingIn: 'Вход…',
    creatingAccount: 'Создание аккаунта…',
    createAccountButton: 'Создать аккаунт',
    newToAnt: 'Впервые в Ant?',
    createAnAccount: 'Создать аккаунт',
    alreadyHaveAccount: 'Уже есть аккаунт?',
    signInFailed: 'Не удалось войти',
    signUpFailed: 'Не удалось зарегистрироваться',
    forgotPasswordLink: 'Забыли пароль?',
    forgotPasswordTitle: 'Сброс пароля',
    forgotPasswordSubtitle:
      'Укажите email — мы отправим ссылку для выбора нового пароля.',
    sendResetLink: 'Отправить ссылку',
    sendingResetLink: 'Отправка…',
    forgotPasswordSent:
      'Если аккаунт с таким email существует, вы получите ссылку для сброса пароля. Проверьте почту и папку «Спам».',
    forgotPasswordFailed:
      'Не удалось отправить письмо для сброса пароля. Попробуйте позже.',
    rememberedPassword: 'Вспомнили пароль?',
    verifyEmailDefault:
      'Аккаунт создан. Проверьте почту и подтвердите адрес перед входом.',
    roleClient: 'Заказчик',
    roleContractor: 'Подрядчик',
    roleDesigner: 'Дизайнер',
    acceptPrivacyPrefix: 'Я принимаю',
    acceptTermsPrefix: 'Я принимаю',
    acceptClientAgreementPrefix: 'Я принимаю',
    acceptContractorAgreementPrefix: 'Я принимаю',
    acceptLegalRequired:
      'Чтобы создать аккаунт, примите Политику конфиденциальности и соглашение(я) для выбранной роли.',
  },
  home: {
    kicker: 'Маркетплейс Ant',
    title: 'Строительные проекты',
    lead:
      'Просматривайте ремонт и строительство. Публикуйте проект, получайте ориентировочные сметы и собирайте предложения подрядчиков.',
    addProject: 'Добавить проект',
    signInToPublish: 'Войти, чтобы опубликовать',
    contractorPortal: 'Кабинет подрядчика',
    ...homePage,
  },
  account: {
    title: 'Ваш аккаунт',
    breadcrumb: 'Аккаунт',
    signInPrompt: 'Войдите, чтобы управлять аккаунтом и уведомлениями.',
    loadFailed: 'Не удалось загрузить настройки',
    saveFailed: 'Не удалось сохранить',
    profile: 'Профиль',
    companyName: 'Название компании',
    name: 'Имя',
    role: 'Роль',
    roleClient: 'Заказчик',
    roleContractor: 'Подрядчик',
    roleAdmin: 'Админ',
    contractorHint:
      'Обновить профиль подрядчика и специализации можно в',
    contractorPortal: 'кабинете подрядчика',
    emailNotifications: 'Email-уведомления',
    emailNotificationsHint:
      'Выберите, какие письма отправлять на {email}. Всё можно отключить в любой момент.',
    allEmailNotifications: 'Все email-уведомления',
    allEmailNotificationsDesc: 'Главный переключатель писем от Ant',
    bidsOnProjects: 'Ставки по моим проектам',
    bidsOnProjectsDesc:
      'Новые заявки, предложения и сообщения от подрядчиков',
    myBidActivity: 'Моя активность в тендерах',
    myBidActivityDesc:
      'Сообщения заказчика, встречные предложения и итоги тендера',
    matchingProjects: 'Подходящие новые проекты',
    matchingProjectsDesc:
      'Проекты по вашим специализациям (до {cap} писем в день)',
  },
  ...extendedNamespaces,
};
