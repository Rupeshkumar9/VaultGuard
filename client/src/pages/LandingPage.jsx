import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { marketingAssets } from '../Assets/marketing';
import MarketingHeader from '../components/marketing/MarketingHeader';
import MarketingFooter from '../components/marketing/MarketingFooter';
import VaultPreviewMockup from '../components/marketing/VaultPreviewMockup';
import {
  FAQ_ITEMS,
  GITHUB_REPO_URL,
  HOW_IT_WORKS_STEPS,
  LANDING_FEATURES,
  PLATFORMS,
  SECURITY_BULLETS,
  SECURITY_LAYERS,
} from '../data/marketingContent';

const CAPABILITY_ITEMS = [
  { label: 'Organized vault', iconKey: 'iconDatabaseStrip' },
  { label: 'Password generator', iconKey: 'iconKeyStrip' },
  { label: 'Browser autofill', iconKey: 'iconBrowserStrip' },
  { label: 'Import & export', iconKey: 'iconDownloadStrip' },
];

export default function LandingPage() {
  const { hash } = useLocation();

  useEffect(() => {
    document.title = 'VaultGuard — Zero-Knowledge Password Manager';
  }, []);

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [hash]);

  return (
    <div className="min-h-screen w-full bg-vg-canvas text-vg-text-primary flex flex-col">
      <MarketingHeader variant="product" />

      <main className="flex-1">
        {/* Hero / Marketing statement */}
        <section className="w-full bg-vg-canvas py-12 sm:py-16 lg:py-[88px]">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
            <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.95fr] items-center gap-10 lg:gap-[54px]">
              <div className="flex flex-col items-start gap-3.5">
                <div className="inline-flex h-[32px] items-center gap-2 rounded-full border border-[#20444d] bg-vg-teal-soft pl-[11px] pr-[13px]">
                  <img
                    src={marketingAssets.badgeDot}
                    alt=""
                    width={6}
                    height={6}
                    className="block size-[6px] shrink-0"
                  />
                  <span className="text-[10px] font-semibold text-vg-text-primary whitespace-nowrap">
                    Password manager for everyday life
                  </span>
                </div>

                <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                  YOUR PASSWORDS, ORGANIZED
                </p>

                <h1 className="text-[38px] sm:text-[48px] lg:text-[62px] font-extrabold leading-[1.08] tracking-tight text-vg-text-primary">
                  Your digital life.
                  <span className="block text-vg-teal mt-1">On your terms.</span>
                </h1>

                <p className="max-w-[666px] text-[15px] sm:text-[16px] lg:text-[17px] leading-[1.55] text-vg-text-secondary">
                  Organize credentials, generate passwords, and use autofill across your browsing—with a vault you can manage your way.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <Link
                    to="/register"
                    className="inline-flex h-[46px] min-w-[150px] flex-1 sm:flex-initial items-center justify-center rounded-[12px] bg-vg-teal px-[18px] py-[10px] text-[14px] font-semibold text-vg-canvas hover:brightness-110 transition-all whitespace-nowrap"
                  >
                    Get started
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex h-[46px] min-w-[174px] flex-1 sm:flex-initial items-center justify-center rounded-[12px] border border-vg-border bg-vg-surface px-[18px] py-[10px] text-[14px] font-semibold text-vg-text-primary hover:bg-vg-raised transition-colors whitespace-nowrap"
                  >
                    Explore features
                  </a>
                </div>

                <p className="pt-1 text-[11px] font-medium text-vg-text-muted">
                  Web app &nbsp;·&nbsp; Browser extension &nbsp;·&nbsp; Android
                </p>
              </div>

              <VaultPreviewMockup variant="hero" />
            </div>
          </div>
        </section>

        {/* Capability strip */}
        <section className="w-full bg-vg-surface py-7 md:py-0 md:h-[124px] flex items-center">
          <div className="mx-auto w-full max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase md:max-w-[180px] shrink-0">
                BUILT FOR THE FLOW OF REAL LIFE
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center lg:justify-between gap-4 lg:gap-10 flex-1 max-w-[960px]">
                {CAPABILITY_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-[9px]">
                    <img
                      src={marketingAssets[item.iconKey]}
                      alt=""
                      width={20}
                      height={20}
                      className="block size-[20px] shrink-0"
                    />
                    <span className="text-[12px] font-medium text-vg-text-secondary whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features / Product capabilities */}
        <section id="features" className="w-full bg-vg-canvas py-14 lg:py-[72px] scroll-mt-20">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] space-y-6">
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                WHAT YOU CAN DO
              </p>
              <h2 className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold leading-tight text-vg-text-primary">
                Everything you need. Nothing in the way.
              </h2>
              <p className="text-[14px] lg:text-[15px] text-vg-text-secondary">
                A practical set of tools for organizing and using your credentials.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
              {LANDING_FEATURES.map((feature) => (
                <article
                  key={feature.id}
                  className="flex flex-col items-start gap-2.5 rounded-[16px] border border-vg-border bg-vg-surface p-5 min-h-[176px] lg:min-h-[188px]"
                >
                  <div className="flex size-[42px] items-center justify-center rounded-[12px] border border-[#21444e] bg-vg-teal-soft shrink-0">
                    <img
                      src={marketingAssets[feature.iconKey]}
                      alt=""
                      width={21}
                      height={21}
                      className="block size-[21px]"
                    />
                  </div>
                  <h3 className="text-[17px] lg:text-[18px] font-semibold text-vg-text-primary mt-0.5">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] leading-[1.55] text-vg-text-secondary">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Product preview / Vault interface */}
        <section className="w-full bg-vg-surface py-14 lg:py-[72px]">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] space-y-6">
            <div className="flex flex-col md:items-center md:text-center gap-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                A CALMER WAY TO MANAGE ACCESS
              </p>
              <h2 className="text-[28px] sm:text-[32px] lg:text-[34px] font-bold leading-tight text-vg-text-primary">
                A clear view of what you store.
              </h2>
              <p className="text-[14px] text-vg-text-secondary">
                A simple vault interface with search, categories, and quick access to common tools.
              </p>
            </div>

            <VaultPreviewMockup variant="full" />
          </div>
        </section>

        {/* Security / Architecture */}
        <section id="security" className="w-full bg-vg-canvas-alt py-14 lg:py-[88px] scroll-mt-20">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
            <div className="grid grid-cols-1 md:grid-cols-[0.95fr_1.25fr] items-center gap-10 lg:gap-[52px]">
              <div className="space-y-3.5">
                <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                  SECURITY IS A SYSTEM
                </p>
                <h2 className="text-[28px] sm:text-[33px] lg:text-[37px] font-bold leading-[1.15] text-vg-text-primary">
                  Designed to be understood, not just trusted.
                </h2>
                <p className="text-[14px] lg:text-[15px] leading-[1.55] text-vg-text-secondary max-w-[502px]">
                  VaultGuard includes dedicated cryptography and authentication code, plus controls for managing your vault.
                </p>

                <ul className="pt-1 space-y-2.5">
                  {SECURITY_BULLETS.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2.5">
                      <span className="flex size-[18px] items-center justify-center rounded-[9px] border border-[#26535d] bg-vg-teal-soft shrink-0">
                        <img
                          src={marketingAssets.iconCheckBullet}
                          alt=""
                          width={12}
                          height={12}
                          className="block size-[12px]"
                        />
                      </span>
                      <span className="text-[14px] text-vg-text-secondary">{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  <a
                    href={GITHUB_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-semibold text-vg-teal hover:underline"
                  >
                    Inspect source repository →
                  </a>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[20px] border border-[#29414c] bg-[#101b24] p-4 sm:p-5">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-3 opacity-70"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(38,61,71,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(38,61,71,0.4) 1px, transparent 1px)',
                    backgroundSize: '112px 48px',
                  }}
                />

                <div className="relative z-10 space-y-3.5">
                  <p className="text-[9px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                    SECURITY LAYERS
                  </p>

                  <div className="space-y-4">
                    {SECURITY_LAYERS.map((layer) => (
                      <div
                        key={layer.id}
                        className="flex items-center gap-3 rounded-[10px] border border-[#314a55] bg-[#17232d] px-3.5 py-3"
                      >
                        <img
                          src={marketingAssets[layer.iconKey]}
                          alt=""
                          width={24}
                          height={24}
                          className="block size-[24px] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-vg-text-primary">
                            {layer.title}
                          </p>
                          <p className="text-[10px] text-vg-text-secondary">
                            {layer.subtitle}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works / Three steps */}
        <section className="w-full bg-vg-canvas py-14 lg:py-[68px]">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] space-y-6">
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                GET STARTED
              </p>
              <h2 className="text-[28px] sm:text-[32px] lg:text-[34px] font-bold leading-tight text-vg-text-primary">
                A straightforward path to your vault.
              </h2>
              <p className="text-[13px] text-vg-text-secondary">
                Start with the basics, then make the workflow your own.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HOW_IT_WORKS_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="flex flex-col gap-3 rounded-[16px] border border-vg-border bg-vg-surface p-[22px]"
                >
                  <span className="text-[12px] font-bold text-vg-teal">{item.step}</span>
                  <h3 className="text-[17px] lg:text-[18px] font-semibold text-vg-text-primary">
                    {item.title}
                  </h3>
                  <p className="text-[13px] leading-[1.55] text-vg-text-secondary">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platforms / Where VaultGuard works */}
        <section id="platforms" className="w-full bg-vg-surface py-14 lg:py-[68px] scroll-mt-20">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] space-y-5">
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                MADE TO FIT YOUR FLOW
              </p>
              <h2 className="text-[28px] sm:text-[31px] lg:text-[33px] font-bold leading-tight text-vg-text-primary">
                Access across your everyday tools.
              </h2>
              <p className="text-[13px] text-vg-text-secondary">
                Choose the experience that fits how you work.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.id}
                  className="flex flex-col gap-2.5 rounded-[15px] border border-vg-border bg-vg-canvas p-5"
                >
                  <img
                    src={marketingAssets[platform.iconKey]}
                    alt=""
                    width={26}
                    height={26}
                    className="block size-[26px] shrink-0"
                  />
                  <h3 className="text-[17px] font-semibold text-vg-text-primary mt-0.5">
                    {platform.title}
                  </h3>
                  <p className="text-[13px] leading-[1.55] text-vg-text-secondary">
                    {platform.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ / Common questions */}
        <section id="faq" className="w-full bg-vg-canvas py-14 lg:py-[68px] scroll-mt-20">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] space-y-6">
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                COMMON QUESTIONS
              </p>
              <h2 className="text-[28px] sm:text-[32px] lg:text-[34px] font-bold leading-tight text-vg-text-primary">
                Good to know before you start.
              </h2>
              <p className="text-[13px] text-vg-text-secondary">
                A few basics about the current VaultGuard workflow.
              </p>
            </div>

            <div className="space-y-3">
              {FAQ_ITEMS.map((faq) => (
                <div
                  key={faq.question}
                  className="grid grid-cols-1 md:grid-cols-[38%_1fr] items-start md:items-center gap-2 md:gap-6 rounded-[14px] border border-vg-border bg-vg-surface px-5 py-4 sm:py-5"
                >
                  <h3 className="text-[14px] font-semibold text-vg-text-primary">
                    {faq.question}
                  </h3>
                  <p className="text-[13px] leading-[1.55] text-vg-text-secondary">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA / Start using VaultGuard */}
        <section className="w-full bg-vg-canvas-alt py-10 lg:py-12">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-[22px] border border-[#284650] bg-[#121e27] px-6 sm:px-[34px] py-8 md:py-10 text-center md:text-left">
              <div className="space-y-2.5 max-w-[820px]">
                <h2 className="text-[24px] sm:text-[28px] lg:text-[31px] font-bold leading-tight text-vg-text-primary">
                  Take control of your credentials.
                </h2>
                <p className="text-[14px] text-vg-text-secondary">
                  Start with a clearer way to organize and use your passwords.
                </p>
              </div>
              <Link
                to="/register"
                className="inline-flex h-[46px] w-[150px] shrink-0 items-center justify-center rounded-[12px] bg-vg-teal px-[18px] py-[10px] text-[14px] font-semibold text-vg-canvas hover:brightness-110 transition-all whitespace-nowrap"
              >
                Get started
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter variant="product" />
    </div>
  );
}
