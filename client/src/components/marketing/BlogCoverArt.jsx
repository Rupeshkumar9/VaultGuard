import { marketingAssets } from '../../Assets/marketing';

export default function BlogCoverArt({
  iconKey = 'iconKeyCover',
  badge = 'SECURITY GUIDES',
  size = 'card',
}) {
  const iconSrc = marketingAssets[iconKey] || marketingAssets.iconKeyCover;
  const isFeatured = size === 'featured';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[14px] border border-[#2b424f] bg-[#101a24] ${
        isFeatured ? 'h-[220px] sm:h-[280px] lg:h-[330px]' : 'h-[142px]'
      }`}
    >
      {/* Subtle blueprint grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(39,67,78,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(39,67,78,0.4) 1px, transparent 1px)',
          backgroundSize: isFeatured ? '85px 96px' : '57px 34px',
        }}
      />

      {/* Centered concentric orbit rings + icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex size-[136px] items-center justify-center">
          <img
            src={marketingAssets.coverOrbitOuter}
            alt=""
            width={136}
            height={136}
            className="pointer-events-none absolute block size-[136px]"
          />
          <img
            src={marketingAssets.coverOrbitInner}
            alt=""
            width={96}
            height={96}
            className="pointer-events-none absolute block size-[96px]"
          />
          <img
            src={iconSrc}
            alt=""
            width={47}
            height={47}
            className="relative z-10 block size-[47px]"
          />
        </div>
      </div>

      {/* Category label pill */}
      <div className="absolute bottom-3.5 left-4 z-10 inline-flex h-[24px] items-center rounded-[12px] border border-[#2a4853] bg-[#172731] px-2.5">
        <span className="text-[8px] font-bold tracking-[0.8px] text-vg-teal uppercase whitespace-nowrap">
          {badge}
        </span>
      </div>
    </div>
  );
}
