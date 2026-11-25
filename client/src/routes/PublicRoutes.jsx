import { Route, Routes } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import BlogPage from '../pages/BlogPage';

export default function PublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog.html" element={<BlogPage />} />
    </Routes>
  );
}
