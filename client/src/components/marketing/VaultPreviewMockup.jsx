import { useMemo, useState } from 'react';
import { marketingAssets } from '../../Assets/marketing';
import { VAULT_DEMO_ITEMS } from '../../data/marketingContent';

export default function VaultPreviewMockup({ variant = 'hero' }) {
  const [activeNav, setActiveNav] = useState('all');
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return VAULT_DEMO_ITEMS.filter((item) => {
      if (activeNav === 'favorites' && !item.favorite) return false;
      if (activeNav === 'trash') return false;
      if (!normalized) return true;
      return (
        item.title.toLowerCase().includes(normalized) ||
        item.subtitle.toLowerCase().includes(normalized)
      );
    });
  }, [activeNav, query]);

  const isHero = variant === 'hero';

  const navItems = [
    { id: 'all', label: 'All items', group: 'vault' },
    { id: 'favorites', label: 'Favorites', group: 'vault' },
    { id: 'trash', label: 'Trash', group: 'vault' },
  ];

  const renderBrowserWindow = () => (
    <div className="relative w-full overflow-hidden rounded-[16px] border border-[#344551] bg-vg-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)]">
      {/* Browser chrome */}
      <div className="flex h-[40px] sm:h-[42px] items-center justify-between border-b border-[#2a3844] bg-[#151d27] px-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-[5px]">
            <img src={marketingAssets.windowDotCoral} alt="" width={6} height={6} className="block size-[6px]" />
            <img src={marketingAssets.windowDotAmber} alt="" width={6} height={6} className="block size-[6px]" />
            <img src={marketingAssets.windowDotTeal} alt="" width={6} height={6} className="block size-[6px]" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.8px] text-vg-text-secondary">
            VAULTGUARD
          </span>
        </div>
        {!isHero && (
          <span className="text-[10px] font-medium text-vg-text-muted">
            Local preview / Vault
          </span>
        )}
      </div>

      {/* Vault body */}
      <div className="flex min-h-[280px] sm:min-h-[328px]">
        {/* Sidebar rail */}
        <aside className="w-[96px] sm:w-[130px] lg:w-[164px] shrink-0 border-r border-vg-border bg-[#0f151d] p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="px-1 text-[8px] font-semibold tracking-[0.7px] text-vg-text-muted">
                YOUR VAULT
              </p>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const selected = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveNav(item.id)}
                      className={`w-full flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-[9px] transition-colors ${
                        selected
                          ? 'bg-[#10343c] font-medium text-vg-text-primary'
                          : 'font-normal text-vg-text-secondary hover:bg-white/5'
                      }`}
                    >
                      {item.id === 'all' && (
                        <img
                          src={marketingAssets.iconDatabaseActive}
                          alt=""
                          width={13}
                          height={13}
                          className="block size-[13px] shrink-0"
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="px-1 text-[8px] font-semibold tracking-[0.7px] text-vg-text-muted">
                TOOLS
              </p>
              <div className="space-y-1">
                <div className="px-2 py-1 text-[9px] text-vg-text-secondary">Generator</div>
                <div className="px-2 py-1 text-[9px] text-vg-text-secondary">Settings</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main vault content + optional helper panel */}
        <div className={`flex-1 min-w-0 p-3 sm:p-4 ${!isHero ? 'lg:grid lg:grid-cols-[1fr_268px] lg:gap-4' : ''}`}>
          <div className="min-w-0 space-y-2.5">
            <p className={`${isHero ? 'text-[13px]' : 'text-[15px] sm:text-[17px]'} font-semibold text-vg-text-primary`}>
              {isHero ? 'Vault overview' : activeNav === 'favorites' ? 'Favorites' : activeNav === 'trash' ? 'Trash' : 'All items'}
            </p>

            {/* Search input */}
            <label className="flex h-[27px] items-center gap-2 rounded-[7px] border border-[#2a3945] bg-[#0d131b] px-2.5 focus-within:border-vg-teal/60">
              <img
                src={marketingAssets.iconSearch}
                alt=""
                width={12}
                height={12}
                className="block size-[12px] shrink-0"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search credentials..."
                aria-label="Search preview credentials"
                className="w-full bg-transparent text-[9px] text-vg-text-primary placeholder:text-vg-text-muted focus:outline-none"
              />
            </label>

            {/* Credential rows */}
            <div className="space-y-1.5">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex h-[45px] items-center justify-between gap-2.5 rounded-[7px] border border-[#283844] bg-[#17212b] px-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${item.glyphColor}`}
                      >
                        {item.glyph}
                      </span>
                      <div className="min-w-0">
                        <p className={`truncate font-semibold text-vg-text-primary ${isHero ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'}`}>
                          {item.title}
                        </p>
                        <p className="truncate text-[8px] text-vg-text-secondary">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    {!isHero && (
                      <img
                        src={marketingAssets.iconShieldRow}
                        alt=""
                        width={13}
                        height={13}
                        className="block size-[13px] shrink-0"
                      />
                    )}
                  </div>
                ))
              ) : (
                <div className="flex h-[96px] items-center justify-center rounded-[7px] border border-dashed border-[#283844] bg-[#17212b]/50 px-3 text-center text-[10px] text-vg-text-muted">
                  {activeNav === 'trash'
                    ? 'Trash is empty in local preview.'
                    : 'No matching preview credentials.'}
                </div>
              )}
            </div>
          </div>

          {/* Helper panel (full product preview on desktop/tablet) */}
          {!isHero && (
            <div className="mt-4 lg:mt-8 hidden md:flex flex-col justify-between rounded-[12px] border border-[#2c424d] bg-[#101a23] p-3.5 h-fit space-y-4">
              <div className="space-y-2.5">
                <img
                  src={marketingAssets.iconShieldHelper}
                  alt=""
                  width={27}
                  height={27}
                  className="block size-[27px]"
                />
                <div className="space-y-1">
                  <p className="text-[12px] font-semibold text-vg-text-primary">
                    A clearer vault
                  </p>
                  <p className="text-[10px] leading-relaxed text-vg-text-secondary">
                    Keep credentials organized with search, categories, and favorites.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex h-[29px] items-center gap-2 rounded-[7px] border border-[#2b4650] bg-[#17252e] px-2.5">
                  <img
                    src={marketingAssets.iconKeyHelper}
                    alt=""
                    width={13}
                    height={13}
                    className="block size-[13px] shrink-0"
                  />
                  <span className="text-[9px] font-medium text-vg-text-primary">
                    Password generator
                  </span>
                </div>
                <div className="flex h-[29px] items-center gap-2 rounded-[7px] border border-[#2b4650] bg-[#17252e] px-2.5">
                  <img
                    src={marketingAssets.iconDownloadHelper}
                    alt=""
                    width={13}
                    height={13}
                    className="block size-[13px] shrink-0"
                  />
                  <span className="text-[9px] font-medium text-vg-text-primary">
                    Import &amp; export
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!isHero) {
    return <div className="w-full max-w-[1020px] mx-auto">{renderBrowserWindow()}</div>;
  }

  return (
    <div className="relative w-full rounded-[24px] border border-[#263e49] bg-[#0f1a23] p-4 sm:p-5 overflow-hidden">
      {/* Subtle technical grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(37,64,74,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,64,74,0.35) 1px, transparent 1px)',
          backgroundSize: '34px 42px',
        }}
      />

      {/* Aura rings top-right */}
      <img
        src={marketingAssets.auraRingLarge}
        alt=""
        width={220}
        height={220}
        className="pointer-events-none absolute -top-9 -right-9 size-[220px] opacity-90"
      />
      <img
        src={marketingAssets.auraRingInner}
        alt=""
        width={155}
        height={155}
        className="pointer-events-none absolute -top-1 -right-1 size-[155px] opacity-90"
      />

      {/* Vault preview window */}
      <div className="relative z-10 pb-4 sm:pb-5">{renderBrowserWindow()}</div>

      {/* Floating autofill card */}
      <div className="relative z-20 ml-auto -mt-8 sm:-mt-10 mr-1 flex h-[56px] w-[152px] items-center gap-2.5 rounded-[12px] border border-[#37515b] bg-[#17232d] px-2.5 shadow-xl">
        <img
          src={marketingAssets.iconBrowserAutofill}
          alt=""
          width={20}
          height={20}
          className="block size-[20px] shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-vg-text-primary leading-tight">
            Autofill
          </p>
          <p className="text-[8px] text-vg-text-secondary leading-tight mt-0.5">
            Browser extension
          </p>
        </div>
      </div>
    </div>
  );
}
