import React, { useState, useEffect } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getShopifyProducts,
  getShopifyCollections
} from '../lib/shopifyClient';

const Home = () => {
  const [current, setCurrent] = useState(0);
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [slides, setSlides] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // ================= SHOPIFY PRODUCTS =================
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await getShopifyProducts(20);

        const formattedProducts = products.map((product) => ({
          id: product.id,
          handle: product.handle,
          name: product.title,
          price: Number(
            product.variants?.nodes?.[0]?.price?.amount || 0
          ),
          images:
            product.images?.nodes?.map((image) => ({
              url: image.url,
              isMain:
                image.url === product.featuredImage?.url,
            })) || [],
          featuredImage: product.featuredImage?.url || null,
          availableForSale:
            product.variants?.nodes?.some(
              (variant) => variant.availableForSale
            ) || false,
        }));

        setFeaturedProducts(formattedProducts);
      } catch (error) {
        console.error(
          "Error fetching Shopify products:",
          error
        );
      }
    };

    fetchProducts();
  }, []);

  // ================= HERO BANNERS =================
  // These images are hosted directly on Shopify CDN.
  useEffect(() => {
    setSlides([
      {
        image:
          "https://cdn.shopify.com/s/files/1/0998/2466/4865/files/IMG_2970.jpg?v=1787931455",
        subtitle: "NEW ARRIVALS",
        title: "Block Print Dresses",
        buttonText: "SHOP NOW",
        link: "/shop/block-print-dresses",
      },
      {
        image:
          "https://cdn.shopify.com/s/files/1/0998/2466/4865/files/IMG_4815.jpg?v=1787851190",
        subtitle: "LIMITED EDITION",
        title: "Festive Edit",
        buttonText: "EXPLORE",
        link: "/shop/suits",
      },
      {
        image:
          "https://cdn.shopify.com/s/files/1/0998/2466/4865/files/IMG_3758.jpg?v=1787929786",
        subtitle: "Signature Block Prints and embroidery on sustainable fabrics",
        title: "Sapna Munoth",
        buttonText: "SHOP NOW",
        link: "/shop/all",
      },
    ]);
  }, []);

  // ================= AUTO PLAY SLIDER =================
  useEffect(() => {
    if (!slides.length) return;

    const timer = setInterval(() => {
      setCurrent((prev) =>
        prev === slides.length - 1 ? 0 : prev + 1
      );
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const goToSlide = (index) => {
    setCurrent(index);
  };

  // ================= SHOPIFY COLLECTIONS =================
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const collections = await getShopifyCollections(20);

        const formattedCategories = collections.map((collection) => ({
          id: collection.id,
          name: collection.title,
          slug: collection.handle,
          image: collection.image?.url || null,
        }));

        setCategories(formattedCategories);
      } catch (error) {
        console.error(
          "Error fetching Shopify collections:",
          error
        );
      }
    };

    fetchCategories();
  }, []);

  // ================= REVIEWS =================
  // Fetch the latest published product reviews from Judge.me.
  useEffect(() => {
    let cancelled = false;

    const fetchReviews = async () => {
      const shopDomain =
        import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;

      const publicToken =
        import.meta.env.VITE_JUDGEME_PUBLIC_TOKEN;

      if (!shopDomain || !publicToken) {
        console.error(
          "Missing Judge.me configuration for homepage reviews."
        );
        setReviewsLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          shop_domain: shopDomain,
          api_token: publicToken,
          page: "1",
          per_page: "6",
          json_request: "true",
        });

        const response = await fetch(
          `https://judge.me/api/v1/widgets/all_reviews_page?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(
            `Judge.me reviews request failed (${response.status})`
          );
        }

        const data = await response.json();

        if (cancelled) return;

        const latestReviews = Array.isArray(data?.reviews)
          ? data.reviews
              .filter((review) => review?.product_title)
              .sort(
                (a, b) =>
                  new Date(b.created_at || 0) -
                  new Date(a.created_at || 0)
              )
              .slice(0, 6)
          : [];

        setReviews(latestReviews);
      } catch (error) {
        console.error(
          "Error fetching Judge.me homepage reviews:",
          error
        );

        if (!cancelled) {
          setReviews([]);
        }
      } finally {
        if (!cancelled) {
          setReviewsLoading(false);
        }
      }
    };

    fetchReviews();

    return () => {
      cancelled = true;
    };
  }, []);

  // ================= MAIN IMAGE =================
  const getMainImage = (product) => {
    if (product.featuredImage) {
      return product.featuredImage;
    }

    if (!product.images || product.images.length === 0) {
      return null;
    }

    const main = product.images.find(
      (image) => image.isMain
    );

    return main ? main.url : product.images[0].url;
  };

  // ================= FORMAT PRICE =================
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="w-full bg-white pb-10">

      {/* ================= HERO SLIDER ================= */}
      <div className="relative h-[60vh] w-full overflow-hidden bg-gray-900">

        {slides.length > 0 && (
          <div className="absolute inset-0">

            {/* HERO IMAGE */}
            <div className="w-full h-full overflow-hidden">
              <img
                src={slides[current]?.image}
                alt={slides[current]?.title}
                className="w-full h-full object-cover object-center transition-transform duration-[6000ms] ease-out scale-105"
              />
            </div>

            {/* DARK OVERLAY */}
            <div className="absolute inset-0 bg-black/30"></div>

            {/* HERO TEXT */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">

              <p className="text-xs md:text-sm tracking-[0.3em] uppercase mb-4 animate-fade-in-up">
                {slides[current]?.subtitle}
              </p>

              <h1 className="text-4xl md:text-6xl font-serif mb-8 tracking-widest drop-shadow-lg animate-fade-in-up">
                {slides[current]?.title}
              </h1>

              {/* HERO BUTTON */}
              <Link
                to={slides[current]?.link || "/shop/all"}
                className="bg-white text-black px-10 py-3 uppercase tracking-[0.2em] text-xs font-bold hover:bg-black hover:text-white transition-all duration-300"
              >
                {slides[current]?.buttonText}
              </Link>

            </div>
          </div>
        )}

        {/* SLIDER DOTS */}
        <div className="absolute bottom-10 right-10 z-20 flex space-x-3">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === current
                  ? 'bg-white scale-125'
                  : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ================= SHOP BY CATEGORY ================= */}
      <section className="max-w-7xl mx-auto px-4 pt-20 pb-10">

        <h2 className="text-3xl font-serif text-center mb-12 tracking-wide text-gray-900">
          Shop by Category
        </h2>

        {categories.length === 0 ? (
          <p className="text-center text-gray-400">
            Loading categories...
          </p>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 md:pb-0 scrollbar-hide">

            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/shop/${cat.slug}`}
                className="relative flex-shrink-0 w-[85vw] md:w-auto h-[400px] group overflow-hidden cursor-pointer snap-center block"
              >

                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-90"></div>

                <div className="absolute bottom-8 left-0 right-0 text-center">

                  <h3 className="text-white text-xl font-serif tracking-widest uppercase mb-2">
                    {cat.name}
                  </h3>

                  <span className="text-white/80 text-xs uppercase tracking-[0.2em] opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                    View Products
                  </span>

                </div>
              </Link>
            ))}

          </div>
        )}
      </section>

      {/* ================= NEW COLLECTION ================= */}
      <section className="max-w-7xl mx-auto px-4 py-10 border-t border-gray-100">

        <div className="flex justify-between items-end mb-8">

          <h2 className="text-2xl md:text-3xl font-serif tracking-wide text-gray-900">
            New Collection
          </h2>

          <Link
            to="/shop/all"
            className="text-xs uppercase tracking-widest font-bold border-b border-black pb-1 hover:text-gray-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            View All
            <ArrowRight size={14} />
          </Link>

        </div>

        {featuredProducts.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            Loading new collection...
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-10">

            {featuredProducts.map((product) => (

              <Link
                to={`/product/${product.handle}`}
                key={product.id}
                className="group cursor-pointer"
              >

                <div className="relative aspect-[3/4] overflow-hidden mb-4 bg-gray-100">

                  <img
                    src={getMainImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300"></div>

                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="absolute bottom-0 left-0 right-0 bg-white text-black py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 text-xs uppercase tracking-widest font-bold"
                  >
                    Quick Add
                  </button>

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
        )}

      </section>

      {/* ================= REVIEWS ================= */}
      <section className="bg-[#f9f8f6] py-20 mt-10">

        <div className="max-w-7xl mx-auto px-4">

          <h2 className="text-3xl font-serif text-center text-gray-900 mb-16 tracking-wide">
            Stories of Love
          </h2>

          {reviewsLoading ? (
            <p className="text-center text-gray-400">
              Loading customer reviews...
            </p>
          ) : reviews.length === 0 ? (
            <p className="text-center text-gray-400">
              Reviews coming soon...
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

              {reviews.map((review) => {
                const productPath = review.product_url
                  ? review.product_url.replace(
                      /^\/products\//,
                      "/product/"
                    )
                  : null;

                const reviewerName =
                  review.reviewer_name ||
                  "Anonymous";

                const reviewDate = review.created_at
                  ? new Date(
                      review.created_at
                    ).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null;

                const card = (
                  <>
                    {review.product_variant_image_url && (
                      <img
                        src={review.product_variant_image_url}
                        alt={review.product_title || "Product"}
                        className="w-16 h-20 object-cover mb-5"
                        loading="lazy"
                      />
                    )}

                    <div className="flex justify-center mb-4 text-[#b08d75]">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          fill={
                            star <= Number(review.rating || 0)
                              ? "currentColor"
                              : "none"
                          }
                          stroke={
                            star <= Number(review.rating || 0)
                              ? "none"
                              : "currentColor"
                          }
                        />
                      ))}
                    </div>

                    {review.title && (
                      <h4 className="text-lg font-serif italic text-gray-800 mb-3">
                        “{review.title}”
                      </h4>
                    )}

                    {review.body && (
                      <p className="text-sm text-gray-600 leading-relaxed mb-6">
                        {review.body}
                      </p>
                    )}

                    <div className="mt-auto">
                      <div className="text-xs text-gray-900 font-bold uppercase tracking-widest mb-1">
                        {reviewerName}
                      </div>

                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                        {review.product_title}
                      </div>

                      {reviewDate && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          {reviewDate}
                        </div>
                      )}
                    </div>
                  </>
                );

                return productPath ? (
                  <Link
                    key={review.uuid || review.id}
                    to={productPath}
                    className="bg-white p-8 border border-gray-100 shadow-sm text-center flex flex-col items-center hover:shadow-md transition-shadow"
                  >
                    {card}
                  </Link>
                ) : (
                  <div
                    key={review.uuid || review.id}
                    className="bg-white p-8 border border-gray-100 shadow-sm text-center flex flex-col items-center"
                  >
                    {card}
                  </div>
                );
              })}

            </div>
          )}

        </div>

      </section>

      {/* ================= STYLES ================= */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

    </div>
  );
};

export default Home;