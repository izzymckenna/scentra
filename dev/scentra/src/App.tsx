import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { ExplorePage } from "./components/ExplorePage";
import { ProductPage } from "./components/ProductPage";
import { AboutPage } from "./components/AboutPage";
import { NotesPage } from "./components/NotesPage";
import { ForumPage } from "./components/ForumPage";
import { PerfumesPage } from "./components/PerfumesPage";
import { SignInPage } from "./components/SignInPage";
import { AuthProvider } from "./lib/auth";

export default function App() {
  const location = useLocation();

  return (
    <AuthProvider>
      <div className="min-h-screen bg-bg font-body text-text">
        <Header />
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/perfumes" element={<PerfumesPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/wishlist" element={<Navigate to="/explore" replace />} />
          <Route path="/bag" element={<Navigate to="/explore" replace />} />
          <Route path="/quiz" element={<Navigate to="/explore" replace />} />
        </Routes>
        <Footer />
      </div>
    </AuthProvider>
  );
}
