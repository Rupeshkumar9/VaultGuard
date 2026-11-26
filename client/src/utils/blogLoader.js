import blogIndex from 'virtual:blog-index';
import { parseMarkdownDocument } from './frontmatter';

// Lazy per-post chunks: Vite splits each .md file into its own chunk on build.
const markdownLoaders = import.meta.glob('../content/blog/*.md', {
  query: '?raw',
  import: 'default',
});

export function getAllBlogPosts() {
  return blogIndex;
}

export function getFeaturedBlogPost() {
  return blogIndex.find((post) => post.featured) || blogIndex[0] || null;
}

export function getArchiveBlogPosts() {
  const featured = getFeaturedBlogPost();
  if (!featured) return blogIndex;
  return blogIndex.filter((post) => post.slug !== featured.slug);
}

export function getBlogPostMeta(slug) {
  return blogIndex.find((post) => post.slug === slug) || null;
}

export function getEmbeddedBlogPost(slug) {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('__VG_BLOG_POST__');
  if (!el || !el.textContent) return null;

  try {
    const parsed = JSON.parse(el.textContent);
    if (parsed && parsed.slug === slug && typeof parsed.body === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function loadBlogPost(slug) {
  const meta = getBlogPostMeta(slug);
  if (!meta) return null;

  const loaderKey = `../content/blog/${meta.fileName}`;
  const loader = markdownLoaders[loaderKey];
  if (!loader) return null;

  const rawMarkdown = await loader();
  const { body } = parseMarkdownDocument(rawMarkdown);
  return { ...meta, body };
}
