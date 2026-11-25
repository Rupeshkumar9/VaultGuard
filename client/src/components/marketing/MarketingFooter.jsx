import { Link } from 'react-router-dom';
import { marketingAssets } from '../../Assets/marketing';
import { GITHUB_REPO_URL } from '../../data/marketingContent';

export default function MarketingFooter({ variant = 'product' }) {
  if (variant === 'blog') {
    return (
      <footer className="w-full border-t border-[#202a33] bg-vg-footer">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] py-7 flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <Link to="/" className="flex items-center gap-[9px] w-fit">
              <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-vg-teal-soft border border-[#24525b] shrink-0">
                <img
                  src={marketingAssets.iconShieldBrand}
                  alt=""
                  width={22}
                  height={22}
                  className="block size-[22px]"
                />
              </span>
              <span className="text-[19px] font-bold text-vg-text-primary">VaultGuard</span>
            </Link>

            <p className="text-[12px] font-medium text-vg-text-secondary">
              Guides &nbsp;·&nbsp; Product updates &nbsp;·&nbsp; Open source
            </p>

            <nav aria-label="Footer navigation" className="flex items-center gap-5 text-[12px] font-medium text-vg-text-secondary">
              <Link to="/" className="hover:text-vg-text-primary transition-colors">
                Product
              </Link>
              <Link to="/blog" className="hover:text-vg-text-primary transition-colors">
                Blog
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-vg-text-primary transition-colors"
              >
                GitHub
              </a>
            </nav>
          </div>

          <div className="h-px w-full bg-[#25303a]" />

          <p className="text-[10px] text-vg-text-muted">
            VaultGuard · Blog design concept
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full border-t border-[#202a33] bg-vg-footer">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] pt-8 pb-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1fr_1fr] gap-8">
          <div className="space-y-3 max-w-[436px]">
            <Link to="/" className="flex items-center gap-[9px] w-fit">
              <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-vg-teal-soft border border-[#24525b] shrink-0">
                <img
                  src={marketingAssets.iconShieldBrand}
                  alt=""
                  width={22}
                  height={22}
                  className="block size-[22px]"
                />
              </span>
              <span className="text-[19px] font-bold text-vg-text-primary">VaultGuard</span>
            </Link>
            <p className="text-[12px] leading-relaxed text-vg-text-secondary">
              A focused password manager for organizing credentials and using them across supported clients.
            </p>
          </div>

          <div className="grid grid-cols-3 md:contents gap-6">
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal">
                PRODUCT
              </p>
              <a href="#features" className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors">
                Features
              </a>
              <a href="#security" className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors">
                Security
              </a>
              <a href="#platforms" className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors">
                Platforms
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal">
                RESOURCES
              </p>
              <Link to="/blog" className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors">
                Blog
              </Link>
              <a href="#faq" className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors">
                Help &amp; FAQ
              </a>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors"
              >
                GitHub
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal">
                ACCOUNT
              </p>
              <Link to="/register" className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors">
                Get started
              </Link>
              <Link to="/login" className="text-[12px] font-medium text-vg-text-secondary hover:text-vg-text-primary transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-[#25303a]" />

        <p className="text-[10px] text-vg-text-muted">
          VaultGuard · Product design concept
        </p>
      </div>
    </footer>
  );
}
