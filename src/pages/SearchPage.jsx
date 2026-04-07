import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q'); // Get the "q" from URL
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSearchResults = async () => {
      setLoading(true);
      try {
        if (!query) return;

        // Perform a case-insensitive search on the 'name' column
        const { data, error } = await supabase
          .from('Product')
          .select(`
            *,
            images:ProductImage(url, isMain)
          `)
          .ilike('name', `%${query}%`); // % allows partial matches

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]);

  // Helper for Main Image
  const getMainImage = (product) => {
    if (!product.images || product.images.length === 0) return "";
    const main = product.images.find((img) => img.isMain);
    return main ? main.url : product.images[0].url;
  };

  // Helper for Price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="pt-32 px-4 max-w-7xl mx-auto min-h-screen">
      <div className="text-center mb-16">
        <h1 className="text-3xl font-serif text-gray-900">
          Search Results
        </h1>
        <p className="text-gray-500 mt-2 italic">
          for "{query}"
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Searching...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No products found matching "{query}".</p>
          <Link to="/" className="text-black underline mt-4 block">View all collections</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {products.map((product) => (
            <Link to={`/product/${product.id}`} key={product.id} className="group cursor-pointer">
              <div className="relative overflow-hidden mb-4 bg-gray-100 aspect-[3/4]">
                <img 
                  src={getMainImage(product)} 
                  alt={product.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-900 font-serif tracking-wide">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{formatPrice(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchPage;