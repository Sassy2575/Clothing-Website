import React from 'react';
import { BrowserRouter as Router, Routes, Route,useLocation } from 'react-router-dom';

// Import Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import ProductPage from './pages/ProductPage';
import AnnouncementBar from './components/Announcement';  
import AuthPage from './pages/AuthPage';
//import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishList';
import SearchPage from './pages/SearchPage';

const Layout = ({ children }) => {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login';

  return (
    <div className="relative font-sans text-gray-900">
      {!hideNavbar && (
        <div className="absolute top-0 left-0 w-full z-50">
          <Navbar />
        </div>
      )}
      {children}
    </div>
  );
};

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen font-sans relative">
        {<AnnouncementBar />}
        <div className="absolute top-0 left-0 w-full z-50">
          <Navbar />
        </div>
      
        
        {/* Main Content changes based on URL */}
        <main className="flex-grow">
          <Routes> 
            <Route path="/" element={<Home />} /> 
            <Route path="/shop/:categoryId" element={<CategoryPage />} />
            <Route path="/product/:productId" element={<ProductPage />} />
            <Route path="/login" element={<AuthPage />} />
            {/* <Route path="/cart" element={<CartPage />} /> */}
            <Route path="/search" element={<SearchPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
          </Routes>
        </main>
        
        
        <footer className="bg-black text-white py-4 text-center text-sm border-t border-gray-800">
          <p>&copy; 2025 Sapna Munoth Label. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;