export const GITHUB_REPO_URL = 'https://github.com/rupeshkumar9';

export const VAULT_DEMO_ITEMS = [
  {
    id: 'email',
    glyph: 'G',
    title: 'Email account',
    subtitle: 'you@example.com',
    category: 'all',
    favorite: true,
    glyphColor: 'bg-[#5fa8ff] text-[#0b0f14]',
  },
  {
    id: 'work',
    glyph: 'W',
    title: 'Work account',
    subtitle: 'work profile',
    category: 'all',
    favorite: true,
    glyphColor: 'bg-[#f4b942] text-[#0b0f14]',
  },
  {
    id: 'developer',
    glyph: 'D',
    title: 'Developer account',
    subtitle: 'developer profile',
    category: 'all',
    favorite: false,
    glyphColor: 'bg-[#1ad5e6] text-[#0b0f14]',
  },
  {
    id: 'social',
    glyph: 'S',
    title: 'Social account',
    subtitle: 'social profile',
    category: 'all',
    favorite: false,
    glyphColor: 'bg-[#8d84f8] text-[#0b0f14]',
  },
];

export const LANDING_FEATURES = [
  {
    id: 'organized',
    iconKey: 'iconDatabaseFeature',
    title: 'A vault that stays organized',
    description: 'Group logins, cards, and notes with categories, favorites, and search.',
  },
  {
    id: 'generator',
    iconKey: 'iconKeyFeature',
    title: 'Password generation',
    description: 'Create passwords within the vault workflow when you need new credentials.',
  },
  {
    id: 'autofill',
    iconKey: 'iconBrowserFeature',
    title: 'Browser autofill',
    description: "Use the extension's site-matching and autofill-related credential flows.",
  },
  {
    id: 'architecture',
    iconKey: 'iconShieldFeature',
    title: 'Security-minded architecture',
    description: 'Explore the authentication and cryptography code paths in the project.',
  },
  {
    id: 'android',
    iconKey: 'iconPhoneFeature',
    title: 'Android support',
    description: 'Use the native Android client and its dedicated autofill integration.',
  },
  {
    id: 'import-export',
    iconKey: 'iconDownloadFeature',
    title: 'Import and export',
    description: 'Find credential import and backup/export options in Settings.',
  },
];

export const SECURITY_BULLETS = [
  'Explore the cryptography specification',
  'Review account and security preferences',
  'Inspect the project implementation on GitHub',
];

export const SECURITY_LAYERS = [
  {
    id: 'auth',
    iconKey: 'iconLockLayer',
    title: 'Authentication flow',
    subtitle: 'Account sign-in services',
  },
  {
    id: 'crypto',
    iconKey: 'iconShieldLayer',
    title: 'Cryptography layer',
    subtitle: 'Client crypto services',
  },
  {
    id: 'controls',
    iconKey: 'iconCheckLayer',
    title: 'Vault controls',
    subtitle: 'Lock and security preferences',
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Set up your account',
    description: 'Register to create an account and enter the vault workflow.',
  },
  {
    step: '02',
    title: 'Bring your credentials',
    description: 'Add entries or use the available import options in Settings.',
  },
  {
    step: '03',
    title: 'Use your vault',
    description: 'Organize, generate, and autofill credentials on supported clients.',
  },
];

export const PLATFORMS = [
  {
    id: 'web',
    iconKey: 'iconGlobePlatform',
    title: 'Web app',
    description: 'Access the vault through the web client.',
  },
  {
    id: 'extension',
    iconKey: 'iconBrowserPlatform',
    title: 'Browser extension',
    description: 'Match credentials to the active site and use autofill-related flows.',
  },
  {
    id: 'android',
    iconKey: 'iconPhonePlatform',
    title: 'Android app',
    description: 'Use the native Android client and its autofill integration.',
  },
];

export const FAQ_ITEMS = [
  {
    question: 'What can I organize in VaultGuard?',
    answer: 'The vault supports credential categories, including login-related entries, cards, and secure notes.',
  },
  {
    question: 'Does VaultGuard support autofill?',
    answer: 'The browser extension and Android client include autofill-related flows.',
  },
  {
    question: 'Can I import or export credentials?',
    answer: 'Settings includes credential import and data backup/export options.',
  },
  {
    question: 'Is there a password generator?',
    answer: 'Yes. The password generator is available directly from the vault interface.',
  },
];

export const BLOG_TOPICS = [
  { id: 'security-guides', label: 'Security guides' },
  { id: 'product-updates', label: 'Product updates' },
  { id: 'open-source', label: 'Open source' },
];
