import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MarketingHeader from '../components/marketing/MarketingHeader';
import MarketingFooter from '../components/marketing/MarketingFooter';
import BlogCoverArt from '../components/marketing/BlogCoverArt';
import { MarkdownContent } from '../utils/markdown';
import {
  getAllBlogPosts,
  getBlogPostMeta,
  getEmbeddedBlogPost,
  loadBlogPost,
} from '../utils/blogLoader';

function resolveInitialPost(slug, initialPost) {
  if (initialPost && initialPost.slug === slug) return initialPost;
  return getEmbeddedBlogPost(slug);
}

export default function BlogPostPage({ initialPost = null }) {
  const { slug = '' } = useParams();
  const meta = useMemo(() => getBlogPostMeta(slug), [slug]);
  const [loadedPost, setLoadedPost] = useState(() => resolveInitialPost(slug, initialPost));

  const resolvedPost = useMemo(() => {
    if (initialPost && initialPost.slug === slug) return initialPost;
    if (loadedPost && loadedPost.slug === slug) return loadedPost;
    return getEmbeddedBlogPost(slug);
  }, [initialPost, loadedPost, slug]);

  useEffect(() => {
    if (!meta || (resolvedPost && resolvedPost.slug === slug)) {
      return undefined;
    }

    let cancelled = false;
    loadBlogPost(slug)
      .then((post) => {
        if (!cancelled && post) {
          setLoadedPost(post);
        }
      })
      .catch((err) => {
        console.error('Failed to load blog post chunk:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [meta, resolvedPost, slug]);

  useEffect(() => {
    if (meta?.title) {
      document.title = `${meta.title} — VaultGuard Journal`;
    }
    window.scrollTo(0, 0);
  }, [meta?.title, slug]);

  const relatedPosts = useMemo(() => {
    return getAllBlogPosts()
      .filter((item) => item.slug !== slug)
      .slice(0, 2);
  }, [slug]);

  if (!meta) {
    return (
      <div className="min-h-screen w-full bg-vg-canvas text-vg-text-primary flex flex-col">
        <MarketingHeader variant="blog" />
        <main className="flex-1 flex items-center justify-center px-5 py-20">
          <div className="max-w-[520px] text-center space-y-4 rounded-[20px] border border-vg-border bg-vg-surface p-8">
            <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
              THE VAULTGUARD JOURNAL
            </p>
            <h1 className="text-[28px] font-bold text-vg-text-primary">Article not found</h1>
            <p className="text-[14px] text-vg-text-secondary">
              The article you requested could not be found or may have moved.
            </p>
            <Link
              to="/blog"
              className="inline-flex h-[42px] items-center justify-center rounded-[12px] bg-vg-teal px-5 text-[13px] font-semibold text-vg-canvas hover:brightness-110 transition-all"
            >
              ← Back to journal
            </Link>
          </div>
        </main>
        <MarketingFooter variant="blog" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-vg-canvas text-vg-text-primary flex flex-col">
      <MarketingHeader variant="blog" />

      <main className="flex-1">
        {/* Article header */}
        <article>
          <header className="w-full bg-vg-canvas pt-10 pb-10 sm:pt-14 sm:pb-12">
            <div className="mx-auto max-w-[920px] px-5 md:px-10 space-y-6">
              <Link
                to="/blog"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-vg-text-secondary hover:text-vg-teal transition-colors"
              >
                ← Back to journal
              </Link>

              <div className="space-y-3.5">
                <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                  {meta.eyebrow} &nbsp;·&nbsp; {meta.readTime}
                  {meta.publishedAt ? ` · ${meta.publishedAt}` : ''}
                </p>

                <h1 className="text-[32px] sm:text-[42px] lg:text-[46px] font-extrabold leading-[1.12] tracking-tight text-vg-text-primary">
                  {meta.title}
                </h1>

                <p className="text-[16px] sm:text-[17px] leading-[1.6] text-vg-text-secondary">
                  {meta.summary}
                </p>
              </div>

              <BlogCoverArt iconKey={meta.iconKey} badge={meta.badge} size="featured" />
            </div>
          </header>

          {/* Article body */}
          <section className="w-full bg-vg-surface py-12 sm:py-14 border-y border-vg-border-header">
            <div className="mx-auto max-w-[920px] px-5 md:px-10">
              {resolvedPost?.body ? (
                <MarkdownContent content={resolvedPost.body} />
              ) : (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 w-3/4 rounded bg-vg-raised" />
                  <div className="h-4 w-full rounded bg-vg-raised" />
                  <div className="h-4 w-5/6 rounded bg-vg-raised" />
                </div>
              )}
            </div>
          </section>
        </article>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <section className="w-full bg-vg-canvas py-12 lg:py-14">
            <div className="mx-auto max-w-[920px] px-5 md:px-10 space-y-5">
              <p className="text-[10px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                MORE FROM THE JOURNAL
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    to={`/blog/${related.slug}`}
                    className="group flex flex-col justify-between gap-2.5 rounded-[16px] border border-vg-border bg-vg-surface p-5 hover:border-vg-teal/60 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-semibold tracking-[1.1px] text-vg-teal uppercase">
                        {related.eyebrow}
                      </p>
                      <h2 className="text-[17px] font-semibold text-vg-text-primary group-hover:text-vg-teal transition-colors">
                        {related.title}
                      </h2>
                      <p className="text-[12px] leading-[1.55] text-vg-text-secondary">
                        {related.summary}
                      </p>
                    </div>
                    <span className="pt-1 text-[12px] font-semibold text-vg-teal">
                      Read article &nbsp;→
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Conversion CTA */}
        <section className="w-full bg-vg-canvas-alt py-10 lg:py-11">
          <div className="mx-auto max-w-[920px] px-5 md:px-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-[20px] border border-[#284650] bg-[#121e27] px-6 sm:px-[26px] py-7 md:py-9 text-center md:text-left">
              <div className="space-y-2 max-w-[600px]">
                <h2 className="text-[24px] sm:text-[26px] font-bold leading-tight text-vg-text-primary">
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
