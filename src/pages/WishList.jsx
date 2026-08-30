import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, ShoppingBag, ArrowRight, Heart } from "lucide-react";

const WISHLIST_STORAGE_KEY = "shopify_wishlist";

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */

function getWishlist() {
  try {
    const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read wishlist:", error);

    localStorage.removeItem(WISHLIST_STORAGE_KEY);

    return [];
  }
}

function saveWishlist(items) {
  localStorage.setItem(
    WISHLIST_STORAGE_KEY,
    JSON.stringify(items)
  );

  window.dispatchEvent(
    new Event("wishlistUpdated")
  );
}

function formatPrice(price, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(price || 0));
}

/* -------------------------------------------------------------
   Wishlist Page
------------------------------------------------------------- */

const WishlistPage = () => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  /* -----------------------------------------------------------
     Load wishlist
  ----------------------------------------------------------- */

  useEffect(() => {
    const loadWishlist = () => {
      try {
        const items = getWishlist();

        console.log(
          "WISHLIST PAGE ITEMS:",
          items
        );

        setWishlistItems(items);
      } catch (error) {
        console.error(
          "Error loading wishlist:",
          error
        );

        setWishlistItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadWishlist();

    /* ---------------------------------------------------------
       Listen for wishlist changes from ProductPage
    --------------------------------------------------------- */

    const handleWishlistUpdate = () => {
      loadWishlist();
    };

    window.addEventListener(
      "wishlistUpdated",
      handleWishlistUpdate
    );

    /* Also update if another tab changes localStorage */

    const handleStorageChange = (event) => {
      if (
        event.key === WISHLIST_STORAGE_KEY
      ) {
        loadWishlist();
      }
    };

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    return () => {
      window.removeEventListener(
        "wishlistUpdated",
        handleWishlistUpdate
      );

      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, []);

  /* -----------------------------------------------------------
     Remove item
  ----------------------------------------------------------- */

  const removeFromWishlist = (productId) => {
    const updatedWishlist =
      wishlistItems.filter(
        (item) =>
          item.id !== productId
      );

    setWishlistItems(updatedWishlist);

    saveWishlist(updatedWishlist);
  };

  /* -----------------------------------------------------------
     Clear wishlist
  ----------------------------------------------------------- */

  const clearWishlist = () => {
    setWishlistItems([]);

    saveWishlist([]);
  };

  /* -----------------------------------------------------------
     Loading
  ----------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen pt-40 text-center">
        <Heart
          size={28}
          className="mx-auto mb-4 animate-pulse"
        />

        <p className="text-gray-500">
          Loading your wishlist...
        </p>
      </div>
    );
  }

  /* -----------------------------------------------------------
     Empty Wishlist
  ----------------------------------------------------------- */

  if (wishlistItems.length === 0) {
    return (
      <div className="bg-white min-h-screen pt-40 pb-20 px-4">
        <div className="max-w-3xl mx-auto text-center">

          <Heart
            size={46}
            strokeWidth={1}
            className="mx-auto mb-6 text-gray-300"
          />

          <h1 className="text-3xl font-serif text-gray-900 mb-3">
            My Wishlist
          </h1>

          <p className="text-gray-500 mb-8">
            Your wishlist is currently empty.
          </p>

          <Link
            to="/shop/all"
            className="inline-flex items-center gap-2 border border-black px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition"
          >
            Continue Shopping
            <ArrowRight size={15} />
          </Link>

        </div>
      </div>
    );
  }

  /* -----------------------------------------------------------
     Wishlist
  ----------------------------------------------------------- */

  return (
    <div className="bg-white pt-32 pb-20 min-h-screen">

      <div className="max-w-7xl mx-auto px-4">

        {/* -----------------------------------------------------
            HEADER
        ----------------------------------------------------- */}

        <div className="flex items-center justify-between mb-12">

          <div>
            <h1 className="text-3xl md:text-4xl font-serif text-gray-900 tracking-wide">
              My Wishlist
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              {wishlistItems.length}{" "}
              {wishlistItems.length === 1
                ? "item"
                : "items"}{" "}
              saved
            </p>
          </div>

          {wishlistItems.length > 0 && (
            <button
              type="button"
              onClick={clearWishlist}
              className="text-xs uppercase tracking-widest text-gray-500 hover:text-red-600 transition"
            >
              Clear Wishlist
            </button>
          )}

        </div>

        {/* -----------------------------------------------------
            PRODUCTS
        ----------------------------------------------------- */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">

          {wishlistItems.map((item) => {

            /*
             * The ProductPage stores products using:
             *
             * id
             * handle
             * title
             * price
             * image
             *
             * We support a few possible property names here
             * so older wishlist entries don't break.
             */

            const productId =
              item.id ||
              item.productId;

            const productHandle =
              item.handle ||
              item.productHandle ||
              productId;

            const productTitle =
              item.title ||
              item.name ||
              "Product";

            const productImage =
              item.image ||
              item.imageUrl ||
              item.featuredImage ||
              "";

            const productPrice =
              item.price || 0;

            const currency =
              item.currencyCode ||
              item.currency ||
              "INR";

            return (
              <div
                key={productId}
                className="group relative"
              >

                {/* -------------------------------------------------
                    IMAGE
                ------------------------------------------------- */}

                <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">

                  <Link
                    to={`/product/${productHandle}`}
                    className="block w-full h-full"
                  >

                    {productImage ? (
                      <img
                        src={productImage}
                        alt={productTitle}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        No image
                      </div>
                    )}

                  </Link>

                  {/* -------------------------------------------------
                      REMOVE BUTTON
                  ------------------------------------------------- */}

                  <button
                    type="button"
                    onClick={() =>
                      removeFromWishlist(
                        productId
                      )
                    }
                    aria-label={`Remove ${productTitle} from wishlist`}
                    className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-sm text-gray-700 hover:text-red-600 transition"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>

                {/* -------------------------------------------------
                    DETAILS
                ------------------------------------------------- */}

                <div className="pt-4 text-center">

                  <Link
                    to={`/product/${productHandle}`}
                  >
                    <h3 className="text-sm font-serif font-medium text-gray-900 hover:underline">
                      {productTitle}
                    </h3>
                  </Link>

                  <p className="text-sm text-gray-500 mt-2">
                    {formatPrice(
                      productPrice,
                      currency
                    )}
                  </p>

                  <Link
                    to={`/product/${productHandle}`}
                    className="mt-4 inline-flex items-center justify-center gap-2 w-full border border-black py-3 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition"
                  >
                    View Product
                    <ShoppingBag size={14} />
                  </Link>

                </div>

              </div>
            );
          })}

        </div>

      </div>

    </div>
  );
};

export default WishlistPage;