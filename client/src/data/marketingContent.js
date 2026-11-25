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

export const FEATURED_ARTICLE = {
  slug: 'password-routine-real-life',
  topicId: 'security-guides',
  badge: 'SECURITY GUIDES',
  eyebrow: 'FEATURED GUIDE',
  title: 'Build a password routine that works in real life.',
  summary: 'A practical starting point for creating, organizing, and maintaining the credentials you rely on every day.',
  ctaLabel: 'Explore the security guides',
  readTime: '5 min read',
  iconKey: 'iconKeyCover',
  body: [
    'A sustainable password routine does not require memorizing dozens of complex strings. It starts with one strong, unique master password and a clear structure for everything else.',
    'Organize high-priority accounts first—primary email, banking, developer tools, and identity providers—so recovery paths stay protected. Use generated, unique credentials for every new sign-up instead of reusing familiar variations.',
    'With VaultGuard, you can group entries by category, star your most frequent logins as favorites, and rely on browser extension or Android autofill so good security stays effortless every day.',
  ],
};

export const JOURNAL_ARTICLES = [
  {
    slug: 'practical-guide-to-safer-passwords',
    topicId: 'security-guides',
    badge: 'SECURITY GUIDES',
    eyebrow: 'SECURITY GUIDE',
    title: 'A practical guide to safer passwords',
    summary: 'Simple habits for creating, organizing, and maintaining credentials you use every day.',
    readTime: '4 min read',
    iconKey: 'iconShieldCover',
    body: [
      'Strong credentials come down to length, uniqueness, and isolation. When every site has its own generated secret, a breach on one service cannot cascade into your email or work accounts.',
      'Use VaultGuard’s built-in password generator directly when updating older logins, and keep recovery notes or card details neatly separated inside your encrypted vault categories.',
    ],
  },
  {
    slug: 'whats-changing-in-vaultguard',
    topicId: 'product-updates',
    badge: 'PRODUCT NOTES',
    eyebrow: 'PRODUCT UPDATES',
    title: "What's changing in VaultGuard",
    summary: 'A clear place for release notes, workflow improvements, and new capabilities.',
    readTime: '3 min read',
    iconKey: 'iconRefreshCover',
    body: [
      'Recent updates across the VaultGuard web dashboard, browser extension, and Android client focus on faster credential lookup, cleaner domain matching for autofill, and smoother import/export controls.',
      'We continue refining the zero-knowledge authentication and client-side encryption lifecycle so every platform stays consistent and predictable.',
    ],
  },
  {
    slug: 'explore-the-code-behind-vaultguard',
    topicId: 'open-source',
    badge: 'OPEN SOURCE',
    eyebrow: 'OPEN SOURCE',
    title: 'Explore the code behind VaultGuard',
    summary: 'A guided look at the client, security services, and ways to contribute.',
    readTime: '6 min read',
    iconKey: 'iconCodeCover',
    body: [
      'VaultGuard is built to be inspected. Client-side cryptography, OPAQUE zero-knowledge authentication, and vault state management live in dedicated, readable modules inside the repository.',
      'Whether you are auditing how master keys are derived locally or contributing UI and autofill improvements across web, extension, and Android, the codebase is structured to make each layer easy to follow.',
    ],
  },
];
