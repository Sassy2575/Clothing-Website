import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, User, Menu, X, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const logo = "https://dwyuljlhdtpcebfmkfer.supabase.co/storage/v1/object/public/images/logo.png";
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [categories, setCategories] = useState([]);
  
  const navigate = useNavigate(); 

  // 1. Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from('Category').select('*');
      if (error) console.error('Error fetching categories:', error);
      else setCategories(data);
    };
    fetchCategories();
  }, []);

  // 2. Fetch Cart Count from Database
  
  const fetchCartCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setCartCount(0);
        return;
      }

      const { data, error } = await supabase
        .from('CartItem')
        .select('quantity')
        .eq('userId', session.user.id);

      if (error) throw error;

      const total = data.reduce((acc, item) => acc + item.quantity, 0);
      setCartCount(total);

    } catch (error) {
      console.error("Error fetching cart count:", error);
    }
  }; 

  // 3. Setup Listeners
  useEffect(() => {
    fetchCartCount(); // Initial load

    window.addEventListener('cartUpdated', fetchCartCount);
    
    // FIXED: Removed (event, session) since they were unused
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
       fetchCartCount();
    }); 

    return () => {
      window.removeEventListener('cartUpdated', fetchCartCount);
      // FIXED: Added ?. check to prevent crashes on cleanup
      authListener?.subscription?.unsubscribe();
    };
  }, []); 

  const getCategoryUrl = (cat) => {
    return `/shop/${cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')}`;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if(searchQuery.trim()) {
      setIsSearchOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery(""); 
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-800">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <div className="flex-shrink-0 flex items-center justify-center flex-1 md:flex-none md:justify-start">
            <Link to="/">
              <img src={logo} alt="Sapna Munoth" className="h-16 w-auto object-contain" />
            </Link>
          </div>

          <div className="hidden md:flex space-x-8 items-center justify-center flex-1">
            {categories.map((cat) => (
              <Link 
                key={cat.id} 
                to={getCategoryUrl(cat)}
                className="text-gray-700 hover:text-black text-xs font-medium uppercase tracking-widest transition-colors duration-200"
              >
                {cat.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-5 text-gray-700">
            
            {/*
            <Link to="/wishlist" className="hidden sm:block">
              <Heart className="w-5 h-5 hover:text-black" />
            </Link>
            */}

            <Link to="/login" className="hidden sm:block">
              <User className="w-5 h-5 hover:text-black" />
            </Link>
  
           
            <div className="relative">
              <Link to="/cart">
                <ShoppingBag className="w-5 h-5 hover:text-black" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full animate-bounce-short">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
            

          </div>
        </div>
      </div>

      {isSearchOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-gray-200 py-4 px-4 shadow-lg animate-fade-in-down z-40">
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto flex items-center border-b border-black pb-2">
            <Search className="text-gray-400 w-5 h-5 mr-3" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="flex-1 outline-none text-sm placeholder-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button type="submit" className="text-xs font-bold uppercase tracking-widest">Search</button>
          </form>
        </div>
      )}

      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 absolute w-full left-0 shadow-lg">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {categories.map((cat) => (
              <Link 
                key={cat.id} 
                to={getCategoryUrl(cat)}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 uppercase tracking-widest"
              >
                {cat.name}
              </Link>
            ))}
            <Link to="/wishlist" onClick={() => setIsOpen(false)} className="block px-3 py-3 text-sm font-medium hover:bg-gray-50 uppercase tracking-widest border-t border-gray-100 mt-2">
              Wishlist
            </Link>
            <Link to="/login" onClick={() => setIsOpen(false)} className="block px-3 py-3 text-sm font-medium hover:bg-gray-50 uppercase tracking-widest">
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;