import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const WishlistPage = () => {
  const navigate = useNavigate();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Wishlist & Product Details
  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        setLoading(true);

        // A. Check User Session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // If not logged in, we can't show DB wishlist
          setLoading(false);
          return; 
        }

        // B. Fetch Wishlist Items JOINED with Product & Images
        const { data, error } = await supabase
          .from('WishlistItem')
          .select(`
            id,
            product:Product (
              id,
              name,
              price,
              description,
              category:Category(slug),
              images:ProductImage (
                url,
                isMain
              )
            )
          `)
          .eq('userId', session.user.id);

        if (error) throw error;
        setWishlistItems(data || []);

      } catch (error) {
        console.error("Error loading wishlist:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
    
  }, []);

  // 2. Remove Handler
  const removeFromWishlist = async (id) => {
    // Optimistic UI update (remove from screen immediately)
    setWishlistItems(items => items.filter(item => item.id !== id));

    const { error } = await supabase
      .from('WishlistItem')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error removing item:", error);
      // Ideally revert UI here if needed
    }
  };

  // Helper to format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  // Helper to get Main Image
  const getImage = (product) => {
    if (!product.images || product.images.length === 0) return "";
    const main = product.images.find(img => img.isMain);
    return main ? main.url : product.images[0].url;
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 text-center">
        <p className="text-gray-500">Loading your wishlist...</p>
      </div>
    );
  }

  return (
    <div className="bg-white pt-32 pb-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4">
        
        <h1 className="text-3xl font-serif text-center mb-12 tracking-wide text-gray-900">
          My Wishlist
        </h1>

        {wishlistItems.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 border border-gray-100">
            <h3 className="text-lg font-serif mb-2">Your wishlist is empty</h3>
            <p className="text-sm text-gray-500 mb-6">Save items you love to view them here later.</p>
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest border-b border-black pb-1 hover:text-gray-600">
              Continue Shopping <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {wishlistItems.map((item) => {
              // Guard clause: If product was deleted but wishlist item remains
              if (!item.product) return null; 

              return (
                <div key={item.id} className="group relative border border-gray-100 p-4 hover:shadow-lg transition-shadow">
                  {/* Remove Button */}
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromWishlist(item.id);
                    }}
                    className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>

                  {/* Image Link */}
                  <Link to={`/product/${item.product.id}`} className="block relative aspect-[3/4] overflow-hidden bg-gray-100 mb-4">
                    <img 
                      src={getImage(item.product)} 
                      alt={item.product.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </Link>

                  {/* Details */}
                  <div className="text-center">
                    <h3 className="text-sm font-serif font-medium text-gray-900 mb-1">
                      <Link to={`/product/${item.product.id}`}>{item.product.name}</Link>
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">{formatPrice(item.product.price)}</p>
                    
                    <button 
                      onClick={() => navigate(`/product/${item.product.id}`)}
                      className="w-full text-black py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                      View Product <ShoppingBag size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;