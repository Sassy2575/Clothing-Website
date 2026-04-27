import React, { useState, useEffect } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom'; 
// Removed REVIEWS import
import { supabase } from '../lib/supabaseClient';

const Home = () => {
  const [current, setCurrent] = useState(0);
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [slides, setSlides] = useState([]);
  
  // 1. New State for Reviews
  const [reviews, setReviews] = useState([]);

  // Static Slides Data (Could be fetched from DB if needed)
  useEffect(() => {
    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from("HeroBanner")
        .select("*")
        .eq("isActive", true)
        .order("order", { ascending: true });

      if (error) {
        console.error("Error fetching banners:", error);
        console.log("ERROR:", error);
        return;
      }

      const formatted = data.map((item) => {
        // 🔥 if storing file name
        return {
          id: item.id,
          image: item.image, // ✅ already full URL
          title: item.title,
          subtitle: item.subtitle,
          buttonText: item.buttonText
        };
      });

      setSlides(formatted);
    };

    fetchBanners();
  }, []);

// Auto-play Slider
  useEffect(() => {
    if (!slides.length) return;

    const timer = setInterval(() => {
      setCurrent(prev =>
        prev === slides.length - 1 ? 0 : prev + 1
      );
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]); // 🔥 key fix
  const goToSlide = (index) => setCurrent(index);



  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from('Category').select('*');
      if (error) console.error('Error fetching categories:', error);
      else setCategories(data);
    };
    fetchCategories();
  }, []);

  // Fetch Featured Products
  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      const { data, error } = await supabase
        .from('Product')
        .select(`
          id,
          name,
          price,
          isFeatured,
          images:ProductImage(url, isMain)
        `)
        .eq('isFeatured', true)
        .limit(8);

      if (error) {
        console.error('Error fetching featured products:', error);
      } else {
        setFeaturedProducts(data);
      }
    };
    fetchFeaturedProducts();
  }, []);

  // 2. Fetch Reviews (New Logic)
  // 2. Fetch Reviews (UPDATED - FIXED AUTH TIMING)
useEffect(() => {
  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('Review')
        .select(`
          id,
          rating,
          comment,
          user:User (fullName),
          product:Product (name)
        `)
        .order('id', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching reviews:', error);
      } else {
        setReviews(data);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  fetchReviews();
}, []);

  
  // Helper: Get Main Image (Safely)
  const getMainImage = (product) => {
    if (!product.images || product.images.length === 0) return null; 
    const main = product.images.find((img) => img.isMain);
    return main ? main.url : product.images[0].url;
  };

  // Helper: Format Price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="w-full bg-white pb-10">
      
      {/* ================= HERO SLIDER ================= */}
      <div className="relative h-[60vh] w-full overflow-hidden bg-gray-900">
        {slides.map((slide, index) => (
          <div 
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <div className={`w-full h-full overflow-hidden`}>
              <img 
                src={slides[current]?.image}
                alt={slides[current]?.title} 
                className={`w-full h-full object-cover object-top lg:object-center transition-transform duration-[6000ms] ease-out ${                  index === current ? 'scale-110' : 'scale-100'
                }`}
              />
            </div>
            <div className="absolute inset-0 bg-black/30"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
              <p className="text-xs md:text-sm tracking-[0.3em] uppercase mb-4 animate-fade-in-up">{slide.subtitle}</p>
              <h1 className="text-4xl md:text-6xl font-serif mb-8 tracking-widest drop-shadow-lg animate-fade-in-up delay-100">{slide.title}</h1>
              <button className="bg-white text-black px-10 py-3 uppercase tracking-[0.2em] text-xs font-bold hover:bg-black hover:text-white transition-all duration-300 animate-fade-in-up delay-200">{slide.buttonText}</button>
            </div>
          </div>
        ))}
        <div className="absolute bottom-10 right-10 z-20 flex space-x-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${index === current ? 'bg-white w-2 scale-125' : 'bg-white/50 hover:bg-white/80'}`}
            />
          ))}
        </div>
      </div>

      {/* ================= SHOP BY CATEGORY ================= */}
      <section className="max-w-7xl mx-auto px-4 pt-20 pb-10">
        <h2 className="text-3xl font-serif text-center mb-12 tracking-wide text-gray-900">Shop by Category</h2>
        {categories.length === 0 ? (
           <p className="text-center text-gray-400">Loading categories...</p>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 md:pb-0 scrollbar-hide">
            {categories.map((cat) => (
              <Link 
                key={cat.id}
                to={`/shop/${cat.slug}`} 
                className="relative flex-shrink-0 w-[85vw] md:w-auto h-[400px] group overflow-hidden cursor-pointer snap-center block"
              >
                <img 
                  src={cat.image} 
                  alt={cat.name} 
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-90"></div>
                <div className="absolute bottom-8 left-0 right-0 text-center">
                  <h3 className="text-white text-xl font-serif tracking-widest uppercase mb-2">{cat.name}</h3>
                  <span className="text-white/80 text-xs uppercase tracking-[0.2em] opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">View Products</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ================= NEW COLLECTION SECTION ================= */}
      <section className="max-w-7xl mx-auto px-4 py-10 border-t border-gray-100">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-2xl md:text-3xl font-serif tracking-wide text-gray-900">
            New Collection
          </h2>
          <Link to="/shop/all" className="text-xs uppercase tracking-widest font-bold border-b border-black pb-1 hover:text-gray-600 transition-colors flex items-center gap-1 cursor-pointer">
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Loading new collection...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-10">
            {featuredProducts.map((product) => (
              <Link to={`/product/${product.id}`} key={product.id} className="group cursor-pointer">
                <div className="relative aspect-[3/4] overflow-hidden mb-4 bg-gray-100">
                  <img 
                    src={getMainImage(product) || null} 
                    alt={product.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300"></div>
                  <button className="absolute bottom-0 left-0 right-0 bg-white text-black py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 text-xs uppercase tracking-widest font-bold">
                    Quick Add
                  </button>
                </div>

                <div className="text-center">
                  <h3 className="text-sm font-medium text-gray-900 font-serif tracking-wide">{product.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{formatPrice(product.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ================= REVIEWS SECTION (UPDATED) ================= */}
      <section className="bg-[#f9f8f6] py-20 mt-10">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-serif text-center text-gray-900 mb-16 tracking-wide">Stories of Love</h2>
          
          {reviews.length === 0 ? (
             <p className="text-center text-gray-400">Loading reviews...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white p-8 border border-gray-100 shadow-sm text-center flex flex-col items-center cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex justify-center mb-4 text-[#b08d75]">
                    {[...Array(5)].map((_, i) => (
                      // Fill star if index < rating
                      <Star 
                        key={i} 
                        size={14} 
                        fill={i < review.rating ? "currentColor" : "none"} 
                        stroke={i < review.rating ? "none" : "currentColor"} 
                      />
                    ))}
                  </div>
                  
                  <h4 className="text-lg font-serif mb-6 italic text-gray-800 leading-relaxed">
                    "{review.comment}"
                  </h4>
                  
                  <div className="mt-auto">
                    <div className="text-xs text-gray-900 font-bold uppercase tracking-widest mb-1">
                      {/* Access joined User data */}
                      {review.user?.fullName || "Verified Customer"}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                      {/* Access joined Product data */}
                      on {review.product?.name || "Product"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default Home;