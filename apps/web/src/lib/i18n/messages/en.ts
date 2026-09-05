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
    contractors: 'Contractors',
    supplyRegistry: 'Supply registry',
    signatureRequests: 'Signature requests',
    settings: 'Settings',
    ads: 'Ads',
    projectsTable: 'Projects table',
    clients: 'Clients',
    contractor: 'Contractor',
    designer: 'Designer',
    account: 'Account',
    materials: 'Materials',
    projects: 'Projects',
    help: 'Help',
    contactUs: 'Contact us',
    contactDialogLead:
      'Reach our team by email or send a message from the form below.',
    contactSendEmail: 'Send email',
    contactOrSendForm: 'Or send us a message',
    contactFormContact: 'Your email or phone',
    contactFormContactPlaceholder: 'you@example.com or +66 ...',
    contactFormMessage: 'Message',
    contactFormMessagePlaceholder: 'How can we help?',
    contactFormSubmit: 'Send message',
    contactFormSent: 'Message sent. We will get back to you soon.',
    contactFormSendFailed: 'Failed to send message',
    primaryNav: 'Primary',
    menu: 'Menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    createProject: 'Create project',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signedIn: 'Signed in',
    language: 'Language',
    lang_en: 'English',
    lang_th: 'Thai',
    lang_ru: 'Russian',
  },
  notifications: {
    title: 'Notifications',
    ariaLabel: 'Notifications',
    empty: 'No notifications yet.',
    markAllRead: 'Mark all read',
    open: 'Open',
    kinds: {
      clientBidSubmittedTitle: 'Commercial proposal received',
      clientBidSubmittedBody:
        '{company} submitted a proposal on {project} ({amount} THB).',
      clientBidEnrolledTitle: 'New tender application',
      clientBidEnrolledBody:
        '{company} enrolled as contender #{n} on {project}.',
      clientClarificationQuestionsTitle: 'Clarification questions received',
      clientClarificationQuestionsBody:
        '{company} submitted {count} clarification question(s) on {project}.',
      clientBidMessageTitle: 'New message on your project',
      clientBidMessageBody: '{project}: {preview}',
      clientTenderDeadlineTitle: 'Application deadline reached',
      clientTenderDeadlineBody:
        'The application deadline for {project} has passed.',
      clientDeclinedProposalTitle: 'Contractor declined to propose',
      clientDeclinedProposalBody:
        '{company} declined to submit a proposal on {project}.',
      contractorCounterOfferTitle: 'Counter-offer received',
      contractorBidSelectedTitle: 'You were selected',
      contractTermsUpdatedTitle: 'Contract terms updated',
      contractTermsUpdatedBody:
        'Contract terms were updated on {project}. Review and sign again if needed.',
      contractCustomFileUpdatedBody:
        'A custom contract file was uploaded for {project}. Previous signatures were cleared.',
      contractPartySignedTitle: 'Contract signature added',
      contractFullySignedTitle: 'Contract fully signed',
      contractAddendumCreatedTitle: 'Additional agreement created',
      contractAddendumCreatedBody:
        '“{addendum}” was created on {project}. The contractor signs first.',
      contractAddendumPartySignedTitle: 'Additional agreement signed',
      contractAddendumPartySignedBody:
        'A party signed “{addendum}” on {project}.',
      contractAddendumFullySignedTitle: 'Additional agreement fully signed',
      contractAddendumFullySignedBody:
        '“{addendum}” is fully signed on {project}.',
      adminSignatureRequestCreatedTitle: 'Signature authorization request',
      adminSignatureRequestCreatedBody:
        '{company} requested authorization to sign on {project}.',
      contractorSignatureRequestApprovedTitle: 'Signature authorized',
      contractorSignatureRequestApprovedBody:
        'You can sign the contract on {project}.',
      contractorSignatureRequestRejectedTitle: 'Signature request rejected',
      contractorSignatureRequestRejectedBody:
        'Your authorization request for {project} was rejected.',
      clientProgressClaimSubmittedTitle: 'Progress claim received',
      clientProgressClaimSubmittedBody:
        '{company} submitted progress claim #{n} on {project} ({amount} THB).',
      contractorProgressClaimApprovedTitle: 'Progress claim approved',
      contractorProgressClaimApprovedBody:
        'Claim #{n} on {project} was approved ({amount} THB).',
      contractorProgressClaimRejectedTitle: 'Progress claim rejected',
      contractorProgressClaimRejectedBody:
        'Claim #{n} on {project} was rejected.',
      contractorAdvancePaymentSlipAttachedTitle: 'Advance payment slips attached',
      contractorAdvancePaymentSlipAttachedBody:
        'The client sent {count} advance payment slip(s) on {project} ({amount} THB).',
      contractorProgressClaimPaymentSlipAttachedTitle: 'Payment slips attached',
      contractorProgressClaimPaymentSlipAttachedBody:
        'The client sent {count} payment slip(s) for claim #{n} on {project} ({amount} THB).',
      contractorDefectReportedTitle: 'Defect reported',
      contractorDefectReportedBody:
        'Defect #{n} was reported on {project}.',
      contractorDefectResubmittedTitle: 'Defect resubmitted',
      contractorDefectResubmittedBody:
        'Defect #{n} was resubmitted on {project}.',
      contractorDefectCompletionRejectedTitle: 'Defect fix rejected',
      contractorDefectCompletionRejectedBody:
        'Fix for defect #{n} on {project} was rejected.',
      contractorDefectClosedTitle: 'Defect closed',
      contractorDefectClosedBody:
        'Defect #{n} on {project} was closed.',
      clientDefectDeclinedTitle: 'Defect declined',
      clientDefectDeclinedBody:
        'Defect #{n} on {project} was declined.',
      clientDefectAcceptedTitle: 'Defect accepted',
      clientDefectAcceptedBody:
        'Defect #{n} on {project} was accepted for work.',
      clientDefectCompletedTitle: 'Defect marked complete',
      clientDefectCompletedBody:
        'Defect #{n} on {project} was marked complete.',
      clientProjectCompletionRequestedTitle: 'Client requested project completion',
      clientProjectCompletionRequestedBody:
        'The client requested to complete {project}. Confirm on the project page.',
      contractorProjectCompletionRequestedTitle: 'Contractor requested project completion',
      contractorProjectCompletionRequestedBody:
        'The contractor requested to complete {project}. Confirm on the project page.',
      clientProjectCompletionConfirmedTitle: 'Client confirmed project completion',
      clientProjectCompletionConfirmedBody:
        'The client confirmed completion of {project}. The project is now closed.',
      contractorProjectCompletionConfirmedTitle: 'Contractor confirmed project completion',
      contractorProjectCompletionConfirmedBody:
        'The contractor confirmed completion of {project}. The project is now closed.',
      genericProjectBody: 'Related to {project}.',
    },
  },
  footer: {
    copyright: '© {year} BuilTHAI. All rights reserved.',
    legalNav: 'Legal',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    clientAgreement: 'Client Agreement',
    contractorAgreement: 'Contractor Agreement',
    materials: 'Materials marketplaces',
    help: 'Help',
    forClients: 'For clients',
    forContractors: 'For contractors',
  },
  auth: {
    welcomeBack: 'Welcome back',
    createAccount: 'Create your account',
    signInSubtitle: 'Sign in to manage projects and contractor bids.',
    signUpSubtitle: 'Join BuilTHAI to publish projects or respond to tenders.',
    fullName: 'Full name',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    emailPlaceholder: 'you@example.com',
    roleLegend: 'Your roles',
    roleHint: 'Select one or more roles. You can change them later.',
    signingIn: 'Signing in…',
    creatingAccount: 'Creating account…',
    createAccountButton: 'Create account',
    newToAnt: 'New to BuilTHAI?',
    createAnAccount: 'Create an account',
    alreadyHaveAccount: 'Already have an account?',
    signInFailed: 'Sign in failed',
    signUpFailed: 'Sign up failed',
    forgotPasswordLink: 'Forgot password?',
    forgotPasswordTitle: 'Reset your password',
    forgotPasswordSubtitle:
      'Enter your email and we will send a link to choose a new password.',
    sendResetLink: 'Send reset link',
    sendingResetLink: 'Sending…',
    forgotPasswordSent:
      'If an account exists for that email, you will receive a password reset link shortly. Check your inbox and spam folder.',
    forgotPasswordFailed: 'Could not send a password reset email. Try again later.',
    rememberedPassword: 'Remembered your password?',
    verifyEmailDefault:
      'Account created. Check your email and verify your address before signing in.',
    roleClient: 'Client',
    roleContractor: 'Contractor',
    roleDesigner: 'Designer',
    roleClientDesc: 'I want to publish my project and hire professionals.',
    roleContractorDesc: 'I want to find projects and submit proposals.',
    roleDesignerDesc: 'I want to offer design and permit services.',
    acceptPrivacyPrefix: 'I agree to the',
    acceptTermsPrefix: 'I agree to the',
    acceptClientAgreementPrefix: 'I agree to the',
    acceptContractorAgreementPrefix: 'I agree to the',
    acceptLegalRequired:
      'Please accept the Privacy Policy and the agreement(s) for your selected role(s) to create an account.',
  },
  home: {
    kicker: 'BuilTHAI marketplace',
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
    roleDesigner: 'Designer',
    roleAdmin: 'Admin',
    contractorHint: 'Update contractor profile and specialties on the',
    contractorPortal: 'Contractor portal',
    designerHint: 'Update designer profile and specialties on the',
    designerPortal: 'Designer portal',
    emailNotifications: 'Email notifications',
    emailNotificationsHint:
      'Choose which updates we send to {email}. You can turn everything off at any time.',
    allEmailNotifications: 'All email notifications',
    allEmailNotificationsDesc: 'Master switch for BuilTHAI emails',
    bidsOnProjects: 'Bids on my projects',
    bidsOnProjectsDesc:
      'New applications, proposals, and messages from contractors',
    myBidActivity: 'My bid activity',
    myBidActivityDesc: 'Client messages, counter-offers, and tender outcomes',
    matchingProjects: 'Matching new projects',
    matchingProjectsDesc:
      'Projects that match your specialties (up to {cap} emails per day)',
    rolesHeading: 'Your roles',
    rolesHint:
      'Add another role to publish projects as a client or bid as a contractor/designer.',
    becomeClient: 'Become a client',
    becomeContractor: 'Become a contractor',
    becomeDesigner: 'Become a designer',
    becomeClientTitle: 'Become a client',
    becomeContractorTitle: 'Become a contractor',
    becomeDesignerTitle: 'Become a designer',
    becomeClientLead:
      'Publish projects, receive proposals, and manage contracts. Accept the Client Agreement to continue.',
    becomeContractorLead:
      'Bid on construction projects after you set up your company profile and verification. Accept the Contractor Agreement to continue.',
    becomeDesignerLead:
      'Bid on design projects after you set up your company profile and verification. Accept the Contractor Agreement to continue.',
    becomeRoleConfirm: 'Add role',
    becomeRoleAcceptRequired: 'Please accept the agreement to continue.',
    becomeRoleFailed: 'Could not add this role. Please try again.',
    roleAdded: 'Role added',
    allRolesEnabled: 'You already have all available roles.',
  },
  emailUnsubscribe: {
    brand: 'BuilTHAI',
    titleLoading: 'Unsubscribe',
    titleOk: 'Unsubscribed',
    titleError: 'Unsubscribe failed',
    loading: 'Unsubscribing…',
    missingToken: 'This unsubscribe link is missing or invalid.',
    success:
      'You will no longer receive matching project alert emails. You can turn them back on anytime in Account → Notifications.',
    genericError:
      'Unable to unsubscribe right now. Please try again later.',
    expiredError:
      'Unable to unsubscribe. The link may have expired.',
    openAccount: 'Open account settings',
    home: 'Home',
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
