import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { marketingAssets } from '../../Assets/marketing';
import { GITHUB_REPO_URL } from '../../data/marketingContent';

export default function MarketingHeader({ variant = 'product' }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks =
    variant === 'blog'
      ? [
          { label: 'Product', to: '/', type: 'route' },
          { label: 'Security', to: '/#security', type: 'anchor' },
          { label: 'Blog', to: '/blog', type: 'route', active: true },
          { label: 'GitHub', href: GITHUB_REPO_URL, type: 'external' },
        ]
      : [
          { label: 'Features', href: '#features', type: 'hash' },
          { label: 'Security', href: '#security', type: 'hash' },
          { label: 'Platforms', href: '#platforms', type: 'hash' },
          { label: 'Blog', to: '/blog', type: 'route' },
        ];

  const closeMenu = () => setMobileMenuOpen(false);

  const renderNavItem = (item, isMobile = false) => {
    const baseClass = isMobile
      ? 'block py-2.5 text-[14px] font-medium transition-colors'
      : 'text-[13px] font-medium transition-colors whitespace-nowrap';
    const colorClass = item.active
      ? 'text-vg-text-primary'
      : 'text-vg-text-secondary hover:text-vg-text-primary';

    if (item.type === 'route') {
      return (
        <Link
          key={item.label}
          to={item.to}
          onClick={closeMenu}
          className={`${baseClass} ${colorClass}`}
        >
          {item.label}
        </Link>
      );
    }

    if (item.type === 'external') {
      return (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
          className={`${baseClass} ${colorClass}`}
        >
          {item.label}
        </a>
      );
    }

    return (
      <a
        key={item.label}
        href={item.href || item.to}
        onClick={closeMenu}
        className={`${baseClass} ${colorClass}`}
      >
        {item.label}
      </a>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-vg-canvas/95 backdrop-blur-md border-b border-vg-border-header">
      <div className="mx-auto flex h-[68px] md:h-[76px] lg:h-[82px] max-w-[1440px] items-center justify-between px-5 md:px-10 lg:px-[78px]">
        <Link
          to="/"
          onClick={closeMenu}
          className="flex items-center gap-[9px] shrink-0 focus:outline-none"
        >
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-vg-teal-soft border border-[#24525b] shrink-0">
            <img
              src={marketingAssets.iconShieldBrand}
              alt=""
              width={22}
              height={22}
              className="block size-[22px]"
            />
          </span>
          <span className="text-[18px] lg:text-[19px] font-bold tracking-tight text-vg-text-primary whitespace-nowrap">
            VaultGuard
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center justify-between gap-8 lg:gap-12"
        >
          {navLinks.map((item) => renderNavItem(item, false))}
        </nav>

        <div className="hidden md:flex items-center gap-[21px] shrink-0">
          <Link
            to="/login"
            className="text-[13px] font-medium text-vg-text-primary hover:text-vg-teal transition-colors whitespace-nowrap"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex h-[42px] lg:h-[46px] min-w-[138px] lg:w-[150px] items-center justify-center rounded-[12px] bg-vg-teal px-[18px] py-[10px] text-[14px] font-semibold text-vg-canvas hover:brightness-110 transition-all whitespace-nowrap"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden inline-flex items-center justify-center rounded-lg p-1.5 text-vg-text-primary hover:bg-vg-surface transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="size-[24px] text-vg-text-primary" />
          ) : (
            <img
              src={marketingAssets.iconMenu}
              alt=""
              width={27}
              height={27}
              className="block size-[27px]"
            />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-vg-border-header bg-vg-canvas px-5 py-4 space-y-2">
          <nav aria-label="Mobile navigation" className="flex flex-col divide-y divide-vg-border-header/60">
            {navLinks.map((item) => renderNavItem(item, true))}
          </nav>
          <div className="pt-3 flex flex-col gap-2.5">
            <Link
              to="/login"
              onClick={closeMenu}
              className="inline-flex h-[42px] items-center justify-center rounded-[12px] border border-vg-border bg-vg-surface px-4 text-[14px] font-semibold text-vg-text-primary"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={closeMenu}
              className="inline-flex h-[44px] items-center justify-center rounded-[12px] bg-vg-teal px-4 text-[14px] font-semibold text-vg-canvas"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
