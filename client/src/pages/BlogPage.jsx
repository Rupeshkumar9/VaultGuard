import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingHeader from '../components/marketing/MarketingHeader';
import MarketingFooter from '../components/marketing/MarketingFooter';
import BlogCoverArt from '../components/marketing/BlogCoverArt';
import { BLOG_TOPICS } from '../data/marketingContent';
import { getArchiveBlogPosts, getFeaturedBlogPost } from '../utils/blogLoader';

export default function BlogPage() {
  const [selectedTopic, setSelectedTopic] = useState('all');

  const featuredArticle = useMemo(() => getFeaturedBlogPost(), []);
  const archiveArticles = useMemo(() => getArchiveBlogPosts(), []);

  const visibleArticles = useMemo(() => {
    if (selectedTopic === 'all') return archiveArticles;
    return archiveArticles.filter((article) => article.topicId === selectedTopic);
  }, [archiveArticles, selectedTopic]);

  useEffect(() => {
    document.title = 'The VaultGuard Journal — Security Guides & Product Updates';
  }, []);

  const handleTopicClick = (topicId) => {
    setSelectedTopic((prev) => (prev === topicId ? 'all' : topicId));
  };

  return (
    <div className="min-h-screen w-full bg-vg-canvas text-vg-text-primary flex flex-col">
      <MarketingHeader variant="blog" />

      <main className="flex-1">
        {/* Blog / Editorial introduction */}
        <section className="w-full bg-vg-canvas py-14 sm:py-16 lg:py-[72px]">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
            <div className="flex flex-col items-start gap-3">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                THE VAULTGUARD JOURNAL
              </p>
              <h1 className="text-[34px] sm:text-[44px] lg:text-[52px] font-extrabold leading-[1.1] tracking-tight text-vg-text-primary max-w-[1100px]">
                Security, explained without the noise.
              </h1>
              <p className="text-[15px] lg:text-[16px] leading-[1.55] text-vg-text-secondary max-w-[770px]">
                Practical guidance, product notes, and open-source insights for a more considered digital life.
              </p>
            </div>
          </div>
        </section>

        {/* Blog / Featured story */}
        {featuredArticle && (
          <section className="w-full bg-vg-surface py-12 lg:py-[76px]">
            <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
              <div className="grid grid-cols-1 md:grid-cols-[44%_1fr] items-center gap-7 lg:gap-12">
                <BlogCoverArt
                  iconKey={featuredArticle.iconKey}
                  badge={featuredArticle.badge}
                  size="featured"
                />

                <div className="flex flex-col items-start gap-3.5">
                  <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                    {featuredArticle.eyebrow}
                  </p>
                  <h2 className="text-[26px] sm:text-[30px] lg:text-[35px] font-bold leading-[1.18] text-vg-text-primary">
                    {featuredArticle.title}
                  </h2>
                  <p className="text-[14px] leading-[1.55] text-vg-text-secondary max-w-[684px]">
                    {featuredArticle.summary}
                  </p>
                  <Link
                    to={`/blog/${featuredArticle.slug}`}
                    className="pt-1 text-[12px] font-semibold text-vg-teal hover:underline"
                  >
                    {featuredArticle.ctaLabel || 'Read article'} &nbsp;→
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Blog / Topic navigation */}
        <section className="w-full bg-vg-canvas py-9 lg:py-[44px]">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-[18px]">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase md:w-[155px] shrink-0">
                BROWSE BY TOPIC
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-[14px]">
                {BLOG_TOPICS.map((topic) => {
                  const isActive = selectedTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleTopicClick(topic.id)}
                      aria-pressed={isActive}
                      className={`inline-flex h-[36px] items-center justify-center rounded-full border px-5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'border-vg-teal bg-vg-teal text-vg-canvas'
                          : 'border-[#244954] bg-vg-teal-soft text-vg-teal hover:border-vg-teal/70'
                      }`}
                    >
                      {topic.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSelectedTopic('all')}
                  className={`text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap px-1 ${
                    selectedTopic === 'all'
                      ? 'text-vg-text-primary'
                      : 'text-vg-text-secondary hover:text-vg-text-primary'
                  }`}
                >
                  Browse all articles &nbsp;→
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Blog / Article archive */}
        <section className="w-full bg-vg-surface py-12 lg:py-[56px]">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px] space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                FROM THE JOURNAL
              </p>
              <h2 className="text-[28px] sm:text-[32px] lg:text-[34px] font-bold leading-tight text-vg-text-primary">
                Ideas worth keeping close.
              </h2>
              <p className="text-[13px] text-vg-text-secondary">
                Guides, product notes, and open-source updates.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
              {visibleArticles.map((article) => (
                <article
                  key={article.slug}
                  className="flex flex-col justify-between gap-3 rounded-[16px] border border-vg-border bg-vg-surface p-[18px]"
                >
                  <div className="flex flex-col gap-3">
                    <BlogCoverArt
                      iconKey={article.iconKey}
                      badge={article.badge}
                      size="card"
                    />
                    <p className="pt-1 text-[9px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                      {article.eyebrow}
                    </p>
                    <h3 className="text-[18px] font-semibold leading-snug text-vg-text-primary">
                      {article.title}
                    </h3>
                    <p className="text-[12px] leading-[1.55] text-vg-text-secondary">
                      {article.summary}
                    </p>
                  </div>

                  <Link
                    to={`/blog/${article.slug}`}
                    className="pt-2 w-fit text-[12px] font-semibold text-vg-teal hover:underline"
                  >
                    Read article &nbsp;→
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Blog / Conversion CTA */}
        <section className="w-full bg-vg-canvas-alt py-10 lg:py-11">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10 lg:px-[78px]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-[20px] border border-[#284650] bg-[#121e27] px-6 sm:px-[26px] py-7 md:py-9 text-center md:text-left">
              <div className="space-y-2 max-w-[834px]">
                <h2 className="text-[24px] sm:text-[26px] lg:text-[28px] font-bold leading-tight text-vg-text-primary">
                  Build a better password routine.
                </h2>
                <p className="text-[13px] text-vg-text-secondary">
                  Put VaultGuard&apos;s vault and everyday tools to work for you.
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

      <MarketingFooter variant="blog" />
    </div>
  );
}
