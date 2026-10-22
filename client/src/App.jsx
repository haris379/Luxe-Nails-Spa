import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import Gallery from './pages/Gallery';
import Booking from './pages/Booking';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import { GuestOnly, RequireAdmin } from './components/AdminGuard';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="booking" element={<Booking />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        {/* The old AR Preview page was replaced by About Us */}
        <Route path="ar-preview" element={<Navigate to="/about" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Admin area: separate from the public layout, no public navbar/footer, not linked from the site */}
      <Route element={<GuestOnly />}>
        <Route path="/admin/login" element={<AdminLogin />} />
      </Route>
      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
      {/* Any other /admin/... URL goes to the dashboard, which sends visitors who are not signed in to the login page */}
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
