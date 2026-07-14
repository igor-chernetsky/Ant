import { enExtended } from './en-extended';

const { homePage, common: commonExtended, ...extendedNamespaces } = enExtended;

export const en = {
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    pleaseWait: 'Please wait…',
    close: 'Close',
    loading: 'Loading…',
    email: 'Email',
    password: 'Password',
    home: 'Home',
    optional: 'Optional',
    saved: 'Saved',
    dash: '—',
    ...commonExtended,
  },
  header: {
    admin: 'Admin',
    contractor: 'Contractor',
    account: 'Account',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signedIn: 'Signed in',
    language: 'Language',
    lang_en: 'English',
    lang_th: 'Thai',
    lang_ru: 'Russian',
  },
  footer: {
    copyright: '© {year} Ant. All rights reserved.',
    legalNav: 'Legal',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
  },
  auth: {
    welcomeBack: 'Welcome back',
    createAccount: 'Create your account',
    signInSubtitle: 'Sign in to manage projects and contractor bids.',
    signUpSubtitle: 'Join Ant to publish projects or respond to tenders.',
    fullName: 'Full name',
    emailPlaceholder: 'you@example.com',
    roleLegend: 'I am a…',
    roleHint: 'Choose how you will use the platform. You can update this later.',
    signingIn: 'Signing in…',
    creatingAccount: 'Creating account…',
    createAccountButton: 'Create account',
    newToAnt: 'New to Ant?',
    createAnAccount: 'Create an account',
    alreadyHaveAccount: 'Already have an account?',
    signInFailed: 'Sign in failed',
    signUpFailed: 'Sign up failed',
    verifyEmailDefault:
      'Account created. Check your email and verify your address before signing in.',
    roleClient: 'Client',
    roleContractor: 'Contractor',
    roleDesigner: 'Designer',
    acceptPrivacyPrefix: 'I agree to the',
    acceptTermsPrefix: 'I agree to the',
    acceptLegalRequired:
      'Please accept the Privacy Policy and Terms of Service to create an account.',
  },
  home: {
    kicker: 'Ant marketplace',
    title: 'Construction projects',
    lead:
      'Browse renovation and build opportunities. Publish your project, receive ballpark estimates, and collect contractor proposals.',
    addProject: 'Add project',
    signInToPublish: 'Sign in to publish',
    contractorPortal: 'Contractor portal',
    ...homePage,
  },
  account: {
    title: 'Your account',
    breadcrumb: 'Account',
    signInPrompt: 'Sign in to manage your account and notifications.',
    loadFailed: 'Failed to load settings',
    saveFailed: 'Failed to save',
    profile: 'Profile',
    companyName: 'Company name',
    name: 'Name',
    role: 'Role',
    roleClient: 'Client',
    roleContractor: 'Contractor',
    roleAdmin: 'Admin',
    contractorHint: 'Update contractor profile and specialties on the',
    contractorPortal: 'Contractor portal',
    emailNotifications: 'Email notifications',
    emailNotificationsHint:
      'Choose which updates we send to {email}. You can turn everything off at any time.',
    allEmailNotifications: 'All email notifications',
    allEmailNotificationsDesc: 'Master switch for Ant emails',
    bidsOnProjects: 'Bids on my projects',
    bidsOnProjectsDesc:
      'New applications, proposals, and messages from contractors',
    myBidActivity: 'My bid activity',
    myBidActivityDesc: 'Client messages, counter-offers, and tender outcomes',
    matchingProjects: 'Matching new projects',
    matchingProjectsDesc:
      'Projects that match your specialties (up to {cap} emails per day)',
  },
  ...extendedNamespaces,
} as const;

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>;
};

export type Messages = DeepStringRecord<typeof en>;

export type MessageKey = {
  [K in keyof Messages]: Messages[K] extends string
    ? K
    : {
        [P in keyof Messages[K]]: Messages[K][P] extends string
          ? `${K & string}.${P & string}`
          : never;
      }[keyof Messages[K]];
}[keyof Messages];
