// [I18N-01] Real translations, but SCOPED — only the screens listed in
// this file are wired up so far (tab bar, settings, role selection). Every
// other screen (auth forms, home screens, wallet, tracking, etc.) still
// shows English-only text. To extend: import useLanguage() in a screen,
// call t('your.key'), and add the key to both language objects below.

export type Language = 'en' | 'fr';

export const translations = {
  en: {
    tab_home: 'Home',
    tab_jobs: 'Jobs',
    tab_requests: 'Requests',
    tab_wallet: 'Wallet',
    tab_profile: 'Profile',
    settings_title: 'Settings',
    settings_language: 'Language',
    settings_profile: 'Profile',
    settings_notifications: 'Notifications',
    settings_security: 'Account & Security',
    settings_help: 'Help & Support',
    settings_about: 'About, Terms & Privacy',
    settings_logout: 'Log Out',
    role_select_title: 'Welcome to CleanLife',
    role_select_subtitle: 'How would you like to continue?',
    role_select_client_title: 'I need a pickup',
    role_select_client_text: 'Request waste collection for your home or business.',
    role_select_collector_title: 'I collect waste',
    role_select_collector_text: 'Find nearby jobs and get paid for pickups.',
    role_select_no_account_needed: 'No account needed',
    role_select_report_full_bin_title: 'Report a full bin',
    role_select_report_full_bin_text: 'Let us know a community bin needs emptying.',
    role_select_add_bin_title: 'Add a bin',
    role_select_add_bin_text: "Mark a community bin's location on the map.",
  },
  fr: {
    tab_home: 'Accueil',
    tab_jobs: 'Emplois',
    tab_requests: 'Demandes',
    tab_wallet: 'Portefeuille',
    tab_profile: 'Profil',
    settings_title: 'Paramètres',
    settings_language: 'Langue',
    settings_profile: 'Profil',
    settings_notifications: 'Notifications',
    settings_security: 'Compte et sécurité',
    settings_help: 'Aide et support',
    settings_about: 'À propos, conditions et confidentialité',
    settings_logout: 'Déconnexion',
    role_select_title: 'Bienvenue sur CleanLife',
    role_select_subtitle: 'Comment souhaitez-vous continuer ?',
    role_select_client_title: "J'ai besoin d'une collecte",
    role_select_client_text: 'Demandez la collecte des déchets pour votre domicile ou entreprise.',
    role_select_collector_title: 'Je collecte les déchets',
    role_select_collector_text: 'Trouvez des missions à proximité et soyez payé pour vos collectes.',
    role_select_no_account_needed: 'Aucun compte requis',
    role_select_report_full_bin_title: 'Signaler une poubelle pleine',
    role_select_report_full_bin_text: 'Signalez qu\'une poubelle communautaire doit être vidée.',
    role_select_add_bin_title: 'Ajouter une poubelle',
    role_select_add_bin_text: "Indiquez l'emplacement d'une poubelle communautaire sur la carte.",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;