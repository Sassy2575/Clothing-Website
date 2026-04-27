import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const CategoryPage = () => {
  const { categoryId } = useParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const limit = 12; // Products per page

  // Reset page on category change
  useEffect(() => {
    setPage(1);
  }, [categoryId]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setProducts([]);

      try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
          .from('Product')
          .select(`
            id,
            name,
            price,
            category:Category!inner(name, slug),
            images:ProductImage!inner(url, isMain)
          `, { count: 'exact' }) // 🔥 count added
          .range(from, to);

        if (categoryId !== 'all') {
          query = query.eq('category.slug', categoryId);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        if (data) {
          setProducts(data);
          setTotalCount(count || 0);

          if (categoryId === 'all') {
            setCategoryName("Full");
          } else if (data.length > 0) {
            setCategoryName(data[0].category.name);
          } else {
            setCategoryName(categoryId.replace("-", " "));
          }
        }
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    window.scrollTo(0, 0);
  }, [categoryId, page]);

  const totalPages = Math.ceil(totalCount / limit);

  const getMainImage = (product) => {
    if (!product.images || product.images.length === 0) return "";
    const main = product.images.find((img) => img.isMain);
    return main ? main.url : product.images[0].url;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="pt-32 px-4 max-w-7xl mx-auto min-h-screen">
      
      {/* Title */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-serif capitalize tracking-wide text-gray-900">
          {categoryName} Collection
        </h1>
        <div className="w-16 h-1 bg-[#b08d75] mx-auto mt-4"></div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">
            No products found in this category.
          </p>
          <Link to="/" className="text-black underline mt-4 block">
            Go back home
          </Link>
        </div>
      ) : (
        <>
          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {products.map((product) => (
              <Link
                to={`/product/${product.id}`}
                key={product.id}
                className="group cursor-pointer"
              >
                <div className="relative overflow-hidden mb-4 bg-gray-100 aspect-[3/4]">
                  <img
                    src={getMainImage(product)}
                    alt={product.name}
                    loading = "lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="text-center">
                  <h3 className="text-sm font-medium text-gray-900 font-serif tracking-wide">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatPrice(product.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center mt-12 gap-4 items-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 border text-sm disabled:opacity-50"
              disabled={page === 1}
            >
              Previous
            </button>

            <span className="px-4 py-2 text-sm">
              Page {page} of {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 border text-sm disabled:opacity-50"
              disabled={page >= totalPages} // 🔥 DISABLED NEXT
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Scroll to Top */}
      <button
        onClick={() =>
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        className="fixed bottom-6 right-6 bg-black text-white px-4 py-3 rounded-full shadow-lg hover:bg-gray-800 transition"
      >
        ↑
      </button>
    </div>
  );
};

export default CategoryPage;