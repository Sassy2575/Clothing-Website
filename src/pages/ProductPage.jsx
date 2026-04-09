import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Star, ChevronRight, Minus, Plus, Loader2, User, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const reviewsRef = useRef(null);
  
  // Product State
  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  //const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState("");
  const [loading, setLoading] = useState(true);
  //const [actionLoading, setActionLoading] = useState(false);
  
  // User & Interaction State
  //const [isWishlisted, setIsWishlisted] = useState(false);
  const [user, setUser] = useState(null);

  // Review State
  const [reviews, setReviews] = useState([]);
  const [newRating, setNewRating] = useState(0); // Default to 0 so user has to click
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoverRating, setHoverRating] = useState(0); // For star hover effect
  const [open, setOpen] = useState(false);

  const sizeChart = [
    { label: "Chest / Bust", XS: 32, S: 34, M: 36, L: 38, XL: 40, XXL: 42, XXXL: 44 },
    { label: "Shoulder", XS: 14, S: 14.5, M: 15, L: 15.5, XL: 16, XXL: 16.5, XXXL: 17 },
    { label: "Waist", XS: 26, S: 28, M: 30, L: 32, XL: 34, XXL: 36, XXXL: 38 },
    { label: "Hips", XS: 34, S: 36, M: 38, L: 40, XL: 42, XXL: 44, XXXL: 46 }
  ];

  const sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

  // --- 1. FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        const { data: productData, error: productError } = await supabase
          .from('Product') 
          .select(`
            *,
            category:Category(name, slug),
            sizes:ProductSize(*),
            images:ProductImage(*)
          `)
          .eq('id', productId)
          .single();

        if (productError) throw productError;

        if (productData) {
          setProduct(productData);
          const primaryImg = productData.images.find(img => img.isMain) || productData.images[0];
          setMainImage(primaryImg ? primaryImg.url : '');

          if (session?.user) {
            const { data: wishlistData } = await supabase
              .from('WishlistItem')
              .select('*')
              .eq('userId', session.user.id)
              .eq('productId', productData.id)
              .maybeSingle();
            setIsWishlisted(!!wishlistData);
          }

          const { data: reviewsData } = await supabase
            .from('Review')
            .select(`
              *,
              user:User(fullName) 
            `)
            .eq('productId', productData.id)
            .order('createdAt', { ascending: false });
          
          setReviews(reviewsData || []);
        }
      } catch (error) {
        console.error("Error loading page:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [productId]);

  // --- 2. HANDLERS ---

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectedSizeObj = product?.sizes?.find(
    (s) => s.id === selectedSize
  );

  const handleWhatsApp = () => {
    if (!product) return;

    const phone = "9885033462"; // replace with owner's number

    const message = `
      Hi, I'm interested in this product:

      Name: ${product.name}
      Category: ${product.category?.name || "N/A"}
      Price: ${formatPrice(product.price)}
      Size: ${selectedSizeObj?.size || "Not selected"}
      Link: ${window.location.href}

      Can I customize this?
          `;

          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    };

    /*const handleAddToCart = async () => {
    if (!product) return;
    if (!user) {
      alert("Please login to add items to your cart.");
      return navigate('/login');
    }
    if (product.sizes.length > 0 && !selectedSize) {
      alert("Please select a size.");
      return;
    }

    try {
      setActionLoading(true);
      const finalSize = selectedSize || "One Size";

      console.log("USER:", user); // 🔥 ADDED

      const { data: existingItem } = await supabase
        .from('CartItem')
        .select('*')
        .eq('userId', user.id)
        .eq('productId', product.id)
        .eq('size', finalSize)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from('CartItem')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);

        console.log("UPDATE ERROR:", error); // 🔥 ADDED
      } else {
        const { error } = await supabase
          .from('CartItem')
          .insert([{ userId: user.id, productId: product.id, quantity: quantity, size: finalSize }]);

        console.log("INSERT ERROR:", error); // 🔥 ADDED
      }

      window.dispatchEvent(new Event('cartUpdated'));
      navigate('/cart');
    } catch (error) {
      console.error("Error adding to cart:", error);
    } finally {
      setActionLoading(false);
    }
  }; 

  const toggleWishlist = async () => {
    if (!user) return navigate('/login');
    const previousState = isWishlisted;
    setIsWishlisted(!previousState);

    try {
      if (previousState) {
        const { error } = await supabase
          .from('WishlistItem')
          .delete()
          .eq('userId', user.id)
          .eq('productId', product.id);

        console.log("DELETE ERROR:", error); // 🔥 ADDED
      } else {
        const { error } = await supabase
          .from('WishlistItem')
          .insert([{ userId: user.id, productId: product.id }]);

        console.log("INSERT ERROR:", error); // 🔥 ADDED
      }
    } catch {
      setIsWishlisted(previousState);
    }
  }; */

  const handleSubmitReview = async (e) => {
  e.preventDefault();

  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = session?.user;

  if (!currentUser) return navigate('/login');

  if (newRating === 0) return alert("Please select a star rating.");
  if (!newComment.trim()) return alert("Please write a comment.");

  try {
    setSubmittingReview(true);

    const { data, error } = await supabase
      .from('Review')
      .insert([{
        userId: currentUser.id,
        productId: product.id,
        rating: newRating,
        comment: newComment.trim()
      }])
      .select('*')
      .single();

    if (error) throw error;

    setReviews((prev) => [data, ...prev]);
    setNewComment("");
    setNewRating(0);

  } catch (error) {
    console.error(error);
    alert("Failed to submit review.");
  } finally {
    setSubmittingReview(false);
  }
};

  const formatPrice = (price) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
  
  // Calculate Avg Rating
  const avgRating = reviews.length 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  if (loading) return <div className="pt-40 text-center text-gray-500">Loading product details...</div>;
  if (!product) return <div className="pt-40 text-center text-red-500">Product not found.</div>;

  const sortSizes = (sizes) => {
    const predefinedOrder = ['XS','S','M','L','XL','XXL','XXXL'];

    return [...sizes].sort((a, b) => {
      const aIndex = predefinedOrder.indexOf(a.size);
      const bIndex = predefinedOrder.indexOf(b.size);

      // If both sizes exist in predefined list
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one exists in list
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Fallback: alphabetical
      return a.size.localeCompare(b.size);
  });
};
  return (
    <div className="bg-white pt-32 pb-20">
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 mb-8 flex items-center text-xs text-gray-500 uppercase tracking-widest">
        <Link to="/" className="hover:text-black">Home</Link>
        <ChevronRight size={12} className="mx-2" />
        <Link to={`/shop/${product.category?.slug}`} className="hover:text-black">{product.category?.name}</Link>
        <ChevronRight size={12} className="mx-2" />
        <span className="text-black font-semibold">{product.name}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* LEFT: Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative group">
            <img src={mainImage} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {product.images && product.images.map((img) => (
              <button key={img.id} onClick={() => setMainImage(img.url)} className={`aspect-[3/4] overflow-hidden border ${mainImage === img.url ? 'border-black' : 'border-transparent'}`}>
                <img src={img.url} className="w-full h-full object-cover" alt="thumbnail" />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Product Details */}
        <div className="lg:pl-10 sticky top-32 h-fit">
          <h1 className="text-3xl md:text-4xl font-serif text-gray-900 mb-2">{product.name}</h1>
          <p className="text-xl text-gray-600 mb-6 font-light">{formatPrice(product.price)}</p>
          
          <div className="flex items-center mb-6 space-x-2">
            <div className="flex text-[#b08d75]">
              <span className="font-bold text-lg mr-2 text-black">{avgRating}</span>
              <Star size={16} fill="currentColor" stroke="none" />
            </div>
            <span className="text-gray-300">|</span>
            <button onClick={scrollToReviews} className="text-sm text-gray-500 hover:text-black underline-offset-4 hover:underline">
              {reviews.length} Customer Reviews
            </button>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed mb-8">{product.description}</p>

          {/* Size Selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest">Size</span>
                <button onClick={() => setOpen(true)}
                className="text-sm underline text-gray-700">Size Guide</button>
                {open && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div className="bg-white p-6 rounded-lg max-w-lg w-full">

                      <h2 className="text-lg font-semibold mb-4">Size Guide</h2>

                      <table className="w-full text-sm border">
                        <thead>
                          <tr>
                            <th className="border p-2"></th>
                            {sizes.map(size => (
                              <th key={size} className="border p-2">{size}</th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {sizeChart.map(row => (
                            <tr key={row.label}>
                              <td className="border p-2 font-medium">{row.label}</td>
                              {sizes.map(size => (
                                <td key={size} className="border p-2">
                                  {row[size]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <button
                        onClick={() => setOpen(false)}
                        className="mt-4 w-full bg-black text-white py-2 rounded"
                      >
                        Close
                      </button>

                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {sortSizes(product.sizes).map((sizeObj) => (
                  <button
                    key={sizeObj.id}
                    onClick={() => setSelectedSize(sizeObj.id)}
                    className={`w-12 h-12 flex items-center justify-center border text-sm transition-all
                      ${selectedSize === sizeObj.id ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-black text-gray-900'}`}
                  >
                    {sizeObj.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add CART CODE HERE
          
          <div className="flex gap-4 mb-8">
            <div className="flex items-center border border-gray-200 w-32 justify-between px-4">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus size={14} /></button>
              <span className="text-sm font-medium">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)}><Plus size={14} /></button>
            </div>
            <button 
              onClick ={handleAddToCart} 
              disabled={(product.sizes.length > 0 && !selectedSize) || actionLoading}
              className={`flex-1 bg-black text-white uppercase tracking-[0.2em] text-xs font-bold transition-colors py-4 flex items-center justify-center gap-2
                ${(product.sizes.length > 0 && !selectedSize) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
            >
              {actionLoading ? <Loader2 className="animate-spin" size={16} /> : (product.sizes.length > 0 && !selectedSize ? 'Select Size' : 'Add to Cart')}
            </button>
    
            <button onClick={toggleWishlist} className={`w-14 flex items-center justify-center border transition-colors ${isWishlisted ? 'border-red-500 text-red-500 bg-red-50' : 'border-gray-200 hover:border-black'}`}>
              <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} />
            </button>
          </div>
            */}

          <div className="mb-8">
            <button
              onClick={handleWhatsApp}
              disabled={product.sizes.length > 0 && !selectedSize}
              className={`w-full border border-green-600 py-4 uppercase tracking-[0.2em] text-xs font-bold transition-colors
                ${product.sizes.length > 0 && !selectedSize 
                  ? 'opacity-50 cursor-not-allowed text-black border-gray-300'
                  : 'text-white bg-green-400 hover:bg-white hover:text-green-700 hover:border-green-700'}`}
            >
              {'Customize on WhatsApp'}
            </button>
          </div>
        </div>
      </div>

      {/* ================= REVIEWS SECTION (REDESIGNED) ================= */}
      <div ref={reviewsRef} className="bg-[#f9f9f9] mt-32 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif text-gray-900 mb-4">Customer Reviews</h2>
            <div className="flex justify-center items-center gap-2">
               <span className="text-5xl font-serif text-gray-900">{avgRating}</span>
               <div className="text-left">
                 <div className="flex text-[#b08d75] mb-1">
                   {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill={i < Math.round(avgRating) ? "currentColor" : "none"} stroke="currentColor" />
                   ))}
                 </div>
                 <p className="text-xs text-gray-500 uppercase tracking-widest">{reviews.length} Reviews</p>
               </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-12">
            
            {/* Review Form (Left Side) */}
            <div className="lg:col-span-4">
              <div className="bg-white p-8 shadow-sm border border-gray-100 sticky top-32">
                <h3 className="text-lg font-serif mb-6">Write a Review</h3>
                
                {user ? (
                  <form onSubmit={handleSubmitReview} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                        How would you rate it?
                      </label>
                      <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            className="transition-transform hover:scale-110 focus:outline-none"
                          >
                            <Star 
                              size={24} 
                              className={
                                (hoverRating || newRating) >= star 
                                  ? "text-[#b08d75] fill-[#b08d75]" 
                                  : "text-gray-300"
                              }
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                        Your Review
                      </label>
                      <textarea 
                        rows="4" 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Share your thoughts..."
                        className="w-full bg-gray-50 border border-gray-200 p-4 text-sm focus:outline-none focus:border-black focus:bg-white transition-colors resize-none"
                      ></textarea>
                    </div>

                    <button 
                      disabled={submittingReview}
                      className="w-full bg-black text-white py-4 uppercase tracking-[0.2em] text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-70"
                    >
                      {submittingReview ? "Submitting..." : "Post Review"}
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="mx-auto text-gray-300 mb-3" size={32} />
                    <p className="text-sm text-gray-500 mb-4">Please log in to share your experience.</p>
                    <Link to="/login" className="inline-block border-b border-black pb-1 text-xs font-bold uppercase tracking-widest hover:text-gray-600">
                      Login to Review
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews List (Right Side) */}
            <div className="lg:col-span-8 space-y-6">
              {reviews.length === 0 ? (
                <div className="bg-white p-12 text-center border border-dashed border-gray-300">
                  <p className="text-gray-400 italic">No reviews yet. Be the first to share your thoughts!</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="bg-white p-8 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-serif font-bold text-lg">
                          {review.user?.fullName?.[0] || "A"}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">
                            {review.user?.fullName || "Anonymous Customer"}
                          </h4>
                          <span className="text-xs text-gray-400">Verified Buyer</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex text-[#b08d75] mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} stroke="currentColor" />
                      ))}
                    </div>

                    <p className="text-gray-700 text-sm leading-relaxed">
                      "{review.comment}"
                    </p>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;