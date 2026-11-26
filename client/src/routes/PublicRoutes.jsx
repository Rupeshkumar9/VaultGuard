import { Route, Routes } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import BlogPage from '../pages/BlogPage';
import BlogPostPage from '../pages/BlogPostPage';

export default function PublicRoutes({ initialPost = null }) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog.html" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage initialPost={initialPost} />} />
    </Routes>
  );
}
