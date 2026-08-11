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
    contractors: 'Подрядчики',
    supplyRegistry: 'Реестр',
    signatureRequests: 'Запросы на подпись',
    settings: 'Настройки',
    contractor: 'Подрядчик',
    designer: 'Проектировщик',
    account: 'Аккаунт',
    materials: 'Материалы',
    projects: 'Проекты',
    help: 'Помощь',
    primaryNav: 'Основная навигация',
    signIn: 'Войти',
    signOut: 'Выйти',
    signedIn: 'Вы вошли',
    language: 'Язык',
    lang_en: 'English',
    lang_th: 'ไทย',
    lang_ru: 'Русский',
  },
  notifications: {
    title: 'Уведомления',
    ariaLabel: 'Уведомления',
    empty: 'Пока нет уведомлений.',
    markAllRead: 'Прочитать все',
    open: 'Открыть',
    kinds: {
      clientBidSubmittedTitle: 'Получено коммерческое предложение',
      clientBidSubmittedBody:
        '{company} отправил(а) КП по проекту {project} ({amount} THB).',
      clientBidEnrolledTitle: 'Новая заявка на тендер',
      clientBidEnrolledBody:
        '{company} записался претендентом №{n} на {project}.',
      clientClarificationQuestionsTitle: 'Получены уточняющие вопросы',
      clientClarificationQuestionsBody:
        '{company} отправил(а) уточняющие вопросы ({count}) по проекту {project}.',
      clientBidMessageTitle: 'Новое сообщение по проекту',
      clientBidMessageBody: '{project}: {preview}',
      clientTenderDeadlineTitle: 'Срок приёма заявок истёк',
      clientTenderDeadlineBody:
        'Срок приёма заявок по проекту {project} закончился.',
      clientDeclinedProposalTitle: 'Подрядчик отказался от КП',
      clientDeclinedProposalBody:
        '{company} отказался подавать КП по проекту {project}.',
      contractorCounterOfferTitle: 'Получено встречное предложение',
      contractorBidSelectedTitle: 'Вас выбрали',
      contractTermsUpdatedTitle: 'Условия договора обновлены',
      contractTermsUpdatedBody:
        'Условия договора по проекту {project} обновлены. Проверьте и при необходимости подпишите снова.',
      contractCustomFileUpdatedBody:
        'Загружен свой файл договора по проекту {project}. Предыдущие подписи сброшены.',
      contractPartySignedTitle: 'Добавлена подпись к договору',
      contractFullySignedTitle: 'Договор полностью подписан',
      contractAddendumCreatedTitle: 'Создано дополнительное соглашение',
      contractAddendumCreatedBody:
        '«{addendum}» создано по проекту {project}. Сначала подписывает подрядчик.',
      contractAddendumPartySignedTitle: 'Подпись по допсоглашению',
      contractAddendumPartySignedBody:
        'Сторона подписала «{addendum}» по проекту {project}.',
      contractAddendumFullySignedTitle: 'Допсоглашение полностью подписано',
      contractAddendumFullySignedBody:
        '«{addendum}» полностью подписано по проекту {project}.',
      adminSignatureRequestCreatedTitle: 'Запрос на авторизацию подписи',
      adminSignatureRequestCreatedBody:
        '{company} запросил авторизацию подписи по проекту {project}.',
      contractorSignatureRequestApprovedTitle: 'Подписание разрешено',
      contractorSignatureRequestApprovedBody:
        'Вы можете подписать договор по проекту {project}.',
      contractorSignatureRequestRejectedTitle: 'Запрос на подпись отклонён',
      contractorSignatureRequestRejectedBody:
        'Ваш запрос на авторизацию по проекту {project} отклонён.',
      clientProgressClaimSubmittedTitle: 'Получен progress claim',
      clientProgressClaimSubmittedBody:
        '{company} отправил(а) claim #{n} по проекту {project} ({amount} THB).',
      contractorProgressClaimApprovedTitle: 'Progress claim утверждён',
      contractorProgressClaimApprovedBody:
        'Claim #{n} по проекту {project} утверждён ({amount} THB).',
      contractorProgressClaimRejectedTitle: 'Progress claim отклонён',
      contractorProgressClaimRejectedBody:
        'Claim #{n} по проекту {project} отклонён.',
      genericProjectBody: 'Связано с проектом {project}.',
    },
  },
  footer: {
    copyright: '© {year} BuilTHAI. Все права защищены.',
    legalNav: 'Правовая информация',
    privacyPolicy: 'Политика конфиденциальности',
    termsOfService: 'Условия использования',
    clientAgreement: 'Клиентское соглашение',
    contractorAgreement: 'Соглашение подрядчика',
    materials: 'Площадки стройматериалов',
    help: 'Помощь',
  },
  auth: {
    welcomeBack: 'С возвращением',
    createAccount: 'Создайте аккаунт',
    signInSubtitle:
      'Войдите, чтобы управлять проектами и предложениями подрядчиков.',
    signUpSubtitle:
      'Присоединяйтесь к BuilTHAI — публикуйте проекты или участвуйте в тендерах.',
    fullName: 'Полное имя',
    emailPlaceholder: 'you@example.com',
    roleLegend: 'Ваши роли',
    roleHint:
      'Выберите, как вы будете использовать платформу. Позже можно изменить.',
    signingIn: 'Вход…',
    creatingAccount: 'Создание аккаунта…',
    createAccountButton: 'Создать аккаунт',
    newToAnt: 'Впервые в BuilTHAI?',
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
    kicker: 'Маркетплейс BuilTHAI',
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
    roleDesigner: 'Проектировщик',
    roleAdmin: 'Админ',
    contractorHint:
      'Обновить профиль подрядчика и специализации можно в',
    contractorPortal: 'кабинете подрядчика',
    designerHint:
      'Обновить профиль проектировщика и специализации можно в',
    designerPortal: 'кабинете проектировщика',
    emailNotifications: 'Email-уведомления',
    emailNotificationsHint:
      'Выберите, какие письма отправлять на {email}. Всё можно отключить в любой момент.',
    allEmailNotifications: 'Все email-уведомления',
    allEmailNotificationsDesc: 'Главный переключатель писем от BuilTHAI',
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
