import React, { useEffect, useRef, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from 'react-router-dom';

import { handleShopifyCallback } from './lib/shopifyAuth';

// Components
import Navbar from './components/Navbar';
import AnnouncementBar from './components/Announcement';

// Pages
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import ProductPage from './pages/ProductPage';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishList';
import SearchPage from './pages/SearchPage';


// --------------------------------------------------
// Shopify OAuth Callback
// --------------------------------------------------

function ShopifyCallback() {
  const navigate = useNavigate();
  const hasRun = useRef(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    // Prevent React StrictMode from processing
    // the OAuth callback twice during development.
    if (hasRun.current) {
      return;
    }

    hasRun.current = true;

    async function processCallback() {
      try {
        await handleShopifyCallback();

        // Authentication successful.
        // Send the customer back to the home page.
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Shopify callback failed:', err);

        setError(
          err?.message || 'Shopify authentication failed.'
        );
      }
    }

    processCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold mb-4">
            Sign in failed
          </h1>

          <p className="text-gray-600 mb-6">
            {error}
          </p>

          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-black text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}


// --------------------------------------------------
// App
// --------------------------------------------------

function App() {
  return (
    <Router>

      <div className="flex flex-col min-h-screen font-sans relative">

        <AnnouncementBar />

        <div className="absolute top-0 left-0 w-full z-50">
          <Navbar />
        </div>

        <main className="flex-grow">

          <Routes>

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/shop/:categoryId"
              element={<CategoryPage />}
            />

            <Route
              path="/product/:productId"
              element={<ProductPage />}
            />

            <Route
              path="/login"
              element={<AuthPage />}
            />

            {/* Shopify Customer Account OAuth callback */}
            <Route
              path="/auth/callback"
              element={<ShopifyCallback />}
            />

            <Route
              path="/cart"
              element={<CartPage />}
            />

            <Route
              path="/search"
              element={<SearchPage />}
            />

            <Route
              path="/wishlist"
              element={<WishlistPage />}
            />

          </Routes>

        </main>

        <footer className="bg-black text-white py-4 text-center text-sm border-t border-gray-800">
          <p>
            &copy; 2025 Sapna Munoth Label. All rights reserved.
          </p>
        </footer>

      </div>

    </Router>
  );
}

export default App;