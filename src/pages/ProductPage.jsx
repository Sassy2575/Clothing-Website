import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Star,
  MessageSquare,
  Heart,
} from "lucide-react";

import {
  useNavigate,
  useParams,
  Link,
} from "react-router-dom";

import {
  getShopifyProductByHandle,
} from "../lib/shopifyClient";

/* ============================================================
   CONSTANTS
============================================================ */

const CART_STORAGE_KEY = "shopify_cart";
const WISHLIST_STORAGE_KEY = "shopify_wishlist";

const SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
];

/*
 * Size chart used when the customer opens Size Guide.
 *
 * You can change these measurements later if your brand
 * uses different measurements.
 */
const SIZE_CHART = [
  {
    label: "Chest / Bust",
    XS: 32,
    S: 34,
    M: 36,
    L: 38,
    XL: 40,
    XXL: 42,
    XXXL: 44,
  },
  {
    label: "Shoulder",
    XS: 14,
    S: 14.5,
    M: 15,
    L: 15.5,
    XL: 16,
    XXL: 16.5,
    XXXL: 17,
  },
  {
    label: "Waist",
    XS: 26,
    S: 28,
    M: 30,
    L: 32,
    XL: 34,
    XXL: 36,
    XXXL: 38,
  },
  {
    label: "Hips",
    XS: 34,
    S: 36,
    M: 38,
    L: 40,
    XL: 42,
    XXL: 44,
    XXXL: 46,
  },
];

/* ============================================================
   SHOPIFY API
============================================================ */

async function shopifyRequest(query, variables = {}) {
  const domain =
    import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;

  const apiVersion =
    import.meta.env.VITE_SHOPIFY_API_VERSION || "2026-07";

  const storefrontToken =
    import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

  if (!domain) {
    throw new Error(
      "Missing VITE_SHOPIFY_STORE_DOMAIN in .env"
    );
  }

  if (!storefrontToken) {
    throw new Error(
      "Missing VITE_SHOPIFY_STOREFRONT_TOKEN in .env"
    );
  }

  const response = await fetch(
    `https://${domain}/api/${apiVersion}/graphql.json`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token":
          storefrontToken,
      },

      body: JSON.stringify({
        query,
        variables,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.errors
        ?.map((error) => error.message)
        .join(", ") ||
        `Shopify request failed (${response.status})`
    );
  }

  if (result?.errors?.length) {
    throw new Error(
      result.errors
        .map((error) => error.message)
        .join(", ")
    );
  }

  return result.data;
}

/* ============================================================
   SHOPIFY CART - CREATE
============================================================ */

async function createShopifyCart(
  variantId,
  quantity
) {
  const mutation = `
    mutation CreateCart($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) {
        cart {
          id
          checkoutUrl
          totalQuantity

          cost {
            subtotalAmount {
              amount
              currencyCode
            }
          }

          lines(first: 100) {
            edges {
              node {
                id
                quantity

                merchandise {
                  ... on ProductVariant {
                    id
                    title

                    product {
                      id
                      title
                      handle
                    }

                    image {
                      url
                      altText
                    }

                    price {
                      amount
                      currencyCode
                    }

                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }

        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyRequest(
    mutation,
    {
      lines: [
        {
          merchandiseId: variantId,
          quantity,
        },
      ],
    }
  );

  const errors =
    data?.cartCreate?.userErrors || [];

  if (errors.length) {
    throw new Error(
      errors
        .map((error) => error.message)
        .join(", ")
    );
  }

  return data?.cartCreate?.cart;
}

/* ============================================================
   SHOPIFY CART - ADD TO EXISTING
============================================================ */

async function addToExistingShopifyCart(
  cartId,
  variantId,
  quantity
) {
  const mutation = `
    mutation AddCartLines(
      $cartId: ID!
      $lines: [CartLineInput!]!
    ) {
      cartLinesAdd(
        cartId: $cartId
        lines: $lines
      ) {
        cart {
          id
          checkoutUrl
          totalQuantity

          cost {
            subtotalAmount {
              amount
              currencyCode
            }
          }

          lines(first: 100) {
            edges {
              node {
                id
                quantity

                merchandise {
                  ... on ProductVariant {
                    id
                    title

                    product {
                      id
                      title
                      handle
                    }

                    image {
                      url
                      altText
                    }

                    price {
                      amount
                      currencyCode
                    }

                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }

        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyRequest(
    mutation,
    {
      cartId,

      lines: [
        {
          merchandiseId: variantId,
          quantity,
        },
      ],
    }
  );

  const errors =
    data?.cartLinesAdd?.userErrors || [];

  if (errors.length) {
    throw new Error(
      errors
        .map((error) => error.message)
        .join(", ")
    );
  }

  return data?.cartLinesAdd?.cart;
}

/* ============================================================
   WISHLIST HELPERS
============================================================ */

function getWishlist() {
  try {
    const saved =
      localStorage.getItem(
        WISHLIST_STORAGE_KEY
      );

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function saveWishlist(wishlist) {
  localStorage.setItem(
    WISHLIST_STORAGE_KEY,
    JSON.stringify(wishlist)
  );

  window.dispatchEvent(
    new Event("wishlistUpdated")
  );
}

/* ============================================================
   PRICE FORMATTER
============================================================ */

function formatPrice(
  price,
  currency = "INR"
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }
  ).format(Number(price || 0));
}

/* ============================================================
   PRODUCT PAGE
============================================================ */

const ProductPage = () => {
  const { productId } = useParams();

  const navigate = useNavigate();

  const reviewsRef = useRef(null);

  /* ----------------------------------------------------------
     PRODUCT STATE
  ---------------------------------------------------------- */

  const [product, setProduct] =
    useState(null);

  const [
    selectedVariantId,
    setSelectedVariantId,
  ] = useState(null);

  const [quantity, setQuantity] =
    useState(1);

  const [mainImage, setMainImage] =
    useState("");

  const [activeMedia, setActiveMedia] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  
  const [judgeMeReviews, setJudgeMeReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(0);

  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [reviewWebsite, setReviewWebsite] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState("");
/* ----------------------------------------------------------
     SIZE GUIDE
  ---------------------------------------------------------- */

  const [
    sizeGuideOpen,
    setSizeGuideOpen,
  ] = useState(false);

  /* ----------------------------------------------------------
     WISHLIST
  ---------------------------------------------------------- */

  const [
    isWishlisted,
    setIsWishlisted,
  ] = useState(false);

  /* ==========================================================
     LOAD PRODUCT
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    const fetchProduct = async () => {
      if (!productId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const handle =
          decodeURIComponent(productId).trim();

        const productData =
          await getShopifyProductByHandle(
            handle
          );

        if (cancelled) return;

        if (!productData) {
          console.error(
            `Shopify returned no product for handle: "${handle}"`
          );

          setProduct(null);

          return;
        }

        setProduct(productData);

        const shopifyMedia =
          productData.media?.nodes || [];

        const firstMedia =
          shopifyMedia.find(
            (item) =>
              item?.__typename === "MediaImage" ||
              item?.__typename === "Video"
          );

        if (firstMedia?.__typename === "MediaImage") {
          setMainImage(firstMedia.image?.url || "");
        } else if (firstMedia?.__typename === "Video") {
          const source =
            firstMedia.sources?.find((item) =>
              item?.mimeType?.startsWith("video/")
            ) || firstMedia.sources?.[0];

          setMainImage(source?.url || "");
        } else {
          setMainImage(
            productData.featuredImage?.url ||
              productData.images?.nodes?.[0]?.url ||
              ""
          );
        }

        setActiveMedia(0);

        const variants =
          productData.variants?.nodes || [];

        const firstAvailableVariant =
          variants.find(
            (variant) =>
              variant.availableForSale
          ) ||
          variants[0] ||
          null;

        setSelectedVariantId(
          firstAvailableVariant?.id ||
            null
        );
      } catch (error) {
        console.error(
          "ERROR LOADING SHOPIFY PRODUCT:",
          error
        );

        if (!cancelled) {
          setProduct(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    window.scrollTo(0, 0);

    return () => {
      cancelled = true;
    };
  }, [productId]);

  /* ==========================================================
     CHECK WISHLIST
  ========================================================== */

  useEffect(() => {
    if (!product) return;

    const wishlist =
      getWishlist();

    const exists =
      wishlist.some(
        (item) =>
          item.id === product.id ||
          item.handle === product.handle
      );

    setIsWishlisted(exists);
  }, [product]);

  /* ==========================================================
     DERIVED DATA
  ========================================================== */

  const variants =
    product?.variants?.nodes || [];

  const images =
    product?.images?.nodes || [];

  /*
   * Shopify's media connection is intentionally used as-is.
   * This preserves the exact order of images/videos uploaded
   * under the product in Shopify.
   */
  const productMedia = useMemo(() => {
    const shopifyMedia = product?.media?.nodes || [];

    if (shopifyMedia.length > 0) {
      return shopifyMedia
        .map((item) => {
          if (item?.__typename === "MediaImage" && item.image?.url) {
            return {
              id: item.id,
              type: "image",
              url: item.image.url,
              altText: item.image.altText || product?.title || "",
            };
          }

          if (item?.__typename === "Video") {
            const source =
              item.sources?.find((source) =>
                source?.mimeType?.startsWith("video/")
              ) || item.sources?.[0];

            if (source?.url) {
              return {
                id: item.id,
                type: "video",
                url: source.url,
                poster: item.previewImage?.url || "",
                altText:
                  item.previewImage?.altText ||
                  product?.title ||
                  "",
              };
            }
          }

          return null;
        })
        .filter(Boolean);
    }

    /*
     * Fallback for products that have not returned media yet.
     */
    return images.map((image, index) => ({
      id: image.id || `image-${index}`,
      type: "image",
      url: image.url,
      altText: image.altText || product?.title || "",
    }));
  }, [product, images]);

  const selectedVariant =
    variants.find(
      (variant) =>
        variant.id === selectedVariantId
    ) ||
    variants[0] ||
    null;

  /* ==========================================================
     SIZE OPTIONS

     IMPORTANT:
     We only show the size selector if Shopify actually
     contains variants with a "Size" option.

     Therefore:

     Product WITHOUT sizes
     → No XS/S/M/L buttons

     Product WITH sizes later
     → Selector automatically appears
  ========================================================== */

  const sizeOptions = useMemo(() => {
    const values = variants
      .map((variant) => {
        const sizeOption =
          variant.selectedOptions?.find(
            (option) =>
              option.name
                ?.toLowerCase() ===
              "size"
          );

        return (
          sizeOption?.value || null
        );
      })
      .filter(Boolean);

    const unique =
      [...new Set(values)];

    return unique.sort(
      (a, b) => {
        const aIndex =
          SIZES.indexOf(
            a.toUpperCase()
          );

        const bIndex =
          SIZES.indexOf(
            b.toUpperCase()
          );

        if (
          aIndex !== -1 &&
          bIndex !== -1
        ) {
          return aIndex - bIndex;
        }

        if (aIndex !== -1) {
          return -1;
        }

        if (bIndex !== -1) {
          return 1;
        }

        return a.localeCompare(b);
      }
    );
  }, [variants]);

  /* ==========================================================
     SELECTED SIZE
  ========================================================== */

  const selectedSize =
    useMemo(() => {
      if (!selectedVariant) {
        return null;
      }

      const sizeOption =
        selectedVariant.selectedOptions?.find(
          (option) =>
            option.name
              ?.toLowerCase() ===
            "size"
        );

      return (
        sizeOption?.value || null
      );
    }, [selectedVariant]);

  /* ==========================================================
     CATEGORY
  ========================================================== */

  const category =
    product?.collections
      ?.nodes?.[0] || null;

  /* ==========================================================
     PRICE
  ========================================================== */

  const productPrice =
    Number(
      selectedVariant?.price
        ?.amount || 0
    );

  const compareAtPrice =
    Number(
      selectedVariant
        ?.compareAtPrice
        ?.amount || 0
    );

  const hasDiscount =
    compareAtPrice > 0 &&
    compareAtPrice >
      productPrice;

  /* ==========================================================
     DESCRIPTION
  ========================================================== */

  /*
   * Shopify may contain descriptions such as:

   Premium mul cotton hand block printed dress

   DELIVERY: 12–15 DAYS

   whitespace-pre-line below preserves the line breaks.
  */

  /* ==========================================================
     SELECT SIZE
  ========================================================== */

  const selectSize = (size) => {
    const matchingVariant =
      variants.find(
        (variant) =>
          variant.selectedOptions?.some(
            (option) =>
              option.name
                ?.toLowerCase() ===
                "size" &&
              option.value
                ?.toLowerCase() ===
                size.toLowerCase()
          )
      );

    if (!matchingVariant) {
      return;
    }

    setSelectedVariantId(
      matchingVariant.id
    );

    if (matchingVariant.image?.url) {
      const mediaIndex = productMedia.findIndex(
        (item) =>
          item.type === "image" &&
          item.url === matchingVariant.image.url
      );

      if (mediaIndex >= 0) {
        setActiveMedia(mediaIndex);
      } else {
        setMainImage(matchingVariant.image.url);
      }
    }
  };

  /* ==========================================================
     WISHLIST TOGGLE
  ========================================================== */

  const toggleWishlist = () => {
    if (!product) return;

    const wishlist =
      getWishlist();

    const existingIndex =
      wishlist.findIndex(
        (item) =>
          item.id === product.id ||
          item.handle === product.handle
      );

    if (existingIndex !== -1) {
      const updatedWishlist =
        wishlist.filter(
          (_, index) =>
            index !== existingIndex
        );

      saveWishlist(
        updatedWishlist
      );

      setIsWishlisted(false);

      return;
    }

    const wishlistItem = {
      id: product.id,
      handle: product.handle,
      title: product.title,
      price: productPrice,
      image:
        product.featuredImage
          ?.url ||
        images[0]?.url ||
        "",
    };

    const updatedWishlist = [
      ...wishlist,
      wishlistItem,
    ];

    saveWishlist(
      updatedWishlist
    );

    setIsWishlisted(true);
  };

  /* ==========================================================
     REVIEWS
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    const fetchJudgeMeReviews = async () => {
      if (!product?.id || !product?.handle) {
        return;
      }

      try {
        setReviewsLoading(true);
        setReviewsError("");

        // Shopify Storefront API returns product IDs as GIDs.
        // The Vercel API endpoint converts this into Judge.me's
        // internal product ID and fetches published reviews.
        const externalId = String(product.id)
          .split("/")
          .pop();

        const params = new URLSearchParams({
          external_id: externalId,
          handle: product.handle,
          page: String(reviewsPage),
          per_page: "5",
        });

        const response = await fetch(
          `/api/judgeme-review?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result?.error ||
              `Judge.me request failed (${response.status}).`
          );
        }

        if (cancelled) return;

        setJudgeMeReviews(
          Array.isArray(result?.reviews)
            ? result.reviews
            : []
        );

        setReviewsTotalPages(
          Number(result?.total_pages) || 0
        );
      } catch (error) {
        console.error(
          "ERROR LOADING JUDGE.ME REVIEWS:",
          error
        );

        if (!cancelled) {
          setJudgeMeReviews([]);
          setReviewsTotalPages(0);
          setReviewsError(
            error?.message ||
              "Unable to load customer reviews."
          );
        }
      } finally {
        if (!cancelled) {
          setReviewsLoading(false);
        }
      }
    };

    fetchJudgeMeReviews();

    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.handle, reviewsPage]);


  /* ==========================================================
     REVIEW SUBMISSION
  ========================================================== */

  const openReviewForm = () => {
    setReviewSubmitError("");
    setReviewSubmitSuccess("");
    setReviewFormOpen(true);
  };

  const closeReviewForm = () => {
    if (reviewSubmitting) return;
    setReviewFormOpen(false);
    setReviewSubmitError("");
  };

  const submitReview = async (event) => {
    event.preventDefault();

    if (!product?.id || reviewSubmitting) return;

    setReviewSubmitError("");
    setReviewSubmitSuccess("");

    if (!reviewRating) {
      setReviewSubmitError("Please select a rating from 1 to 5.");
      return;
    }
    if (!reviewTitle.trim()) {
      setReviewSubmitError("Please enter a review title.");
      return;
    }
    if (!reviewBody.trim()) {
      setReviewSubmitError("Please enter your review.");
      return;
    }
    if (!reviewName.trim()) {
      setReviewSubmitError("Please enter your name.");
      return;
    }
    if (!reviewEmail.trim()) {
      setReviewSubmitError("Please enter your email address.");
      return;
    }

    setReviewSubmitting(true);

    try {
      const response = await fetch("/api/judgeme-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          rating: reviewRating,
          title: reviewTitle,
          body: reviewBody,
          name: reviewName,
          email: reviewEmail,
          anonymous: reviewAnonymous,
          website: reviewWebsite,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "Unable to submit your review right now.");
      }

      setReviewSubmitSuccess(
        result?.message || "Thank you! Your review has been submitted."
      );
      setReviewTitle("");
      setReviewBody("");
      setReviewName("");
      setReviewEmail("");
      setReviewRating(0);
      setReviewAnonymous(false);
      setReviewWebsite("");

      window.setTimeout(() => {
        setReviewsPage(1);
        setReviewFormOpen(false);
        setReviewSubmitSuccess("");
      }, 1200);
    } catch (error) {
      setReviewSubmitError(
        error?.message || "Unable to submit your review right now. Please try again."
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  /* ==========================================================
     REVIEWS
  ========================================================== */

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  /* ==========================================================
     WHATSAPP
  ========================================================== */

  const handleWhatsApp = () => {
    if (!product) return;

    /*
     * Only require a size when the product actually
     * has Shopify Size variants.
     */
    if (
      sizeOptions.length > 0 &&
      !selectedSize
    ) {
      alert(
        "Please select a size."
      );

      return;
    }

    if (
      !selectedVariant?.availableForSale
    ) {
      alert(
        "This variant is currently unavailable."
      );

      return;
    }

    const phone =
      "9885033462";

    const message = `
Hi, I'm interested in this product:

Name: ${product.title}

Category: ${
      category?.title ||
      product.productType ||
      "N/A"
    }

Price: ${formatPrice(
      productPrice,
      selectedVariant
        ?.price
        ?.currencyCode ||
        "INR"
    )}

Size: ${
      selectedSize ||
      selectedVariant?.title ||
      "One Size"
    }

Quantity: ${quantity}

Link: ${window.location.href}

Can I customize this?
    `.trim();

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(
        message
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /* ==========================================================
     ADD TO CART
  ========================================================== */

  const handleAddToCart =
    async () => {
      if (
        !product ||
        !selectedVariant
      ) {
        return;
      }

      /*
       * Only require size if Shopify has size variants.
       */
      if (
        sizeOptions.length > 0 &&
        !selectedSize
      ) {
        alert(
          "Please select a size."
        );

        return;
      }

      if (
        !selectedVariant.availableForSale
      ) {
        alert(
          "This variant is currently unavailable."
        );

        return;
      }

      try {
        setActionLoading(true);

        let cart = null;

        /* ----------------------------------------------------
           Read existing cart
        ---------------------------------------------------- */

        try {
          const savedCart =
            localStorage.getItem(
              CART_STORAGE_KEY
            );

          if (savedCart) {
            cart =
              JSON.parse(
                savedCart
              );
          }
        } catch {
          cart = null;
        }

        /* ----------------------------------------------------
           Existing cart
        ---------------------------------------------------- */

        if (cart?.id) {
          try {
            cart =
              await addToExistingShopifyCart(
                cart.id,
                selectedVariant.id,
                quantity
              );
          } catch (error) {
            console.warn(
              "Existing Shopify cart could not be updated. Creating a new cart.",
              error
            );

            cart =
              await createShopifyCart(
                selectedVariant.id,
                quantity
              );
          }
        }

        /* ----------------------------------------------------
           New cart
        ---------------------------------------------------- */

        else {
          cart =
            await createShopifyCart(
              selectedVariant.id,
              quantity
            );
        }

        if (!cart) {
          throw new Error(
            "Shopify did not return a cart."
          );
        }

        /* ----------------------------------------------------
           Save cart
        ---------------------------------------------------- */

        localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify(cart)
        );

        window.dispatchEvent(
          new Event("cartUpdated")
        );

        /* ----------------------------------------------------
           Go to cart
        ---------------------------------------------------- */

        navigate("/cart");
      } catch (error) {
        console.error(
          "Error adding item to Shopify cart:",
          error
        );

        alert(
          error?.message ||
            "Unable to add this product to cart. Please try again."
        );
      } finally {
        setActionLoading(
          false
        );
      }
    };

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="min-h-screen pt-40 text-center text-gray-500">
        <Loader2
          size={28}
          className="animate-spin mx-auto mb-4"
        />

        Loading product details...
      </div>
    );
  }

  /* ==========================================================
     PRODUCT NOT FOUND
  ========================================================== */

  if (!product) {
    return (
      <div className="min-h-screen pt-40 text-center px-4">
        <p className="text-red-500 mb-4">
          Product not found.
        </p>

        <Link
          to="/shop/all"
          className="underline text-sm uppercase tracking-widest"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="bg-white pt-32 pb-20">

      {/* ======================================================
          BREADCRUMBS
      ====================================================== */}

      <div className="max-w-7xl mx-auto px-4 mb-8 flex items-center text-xs text-gray-500 uppercase tracking-widest">

        <Link
          to="/"
          className="hover:text-black"
        >
          Home
        </Link>

        <ChevronRight
          size={12}
          className="mx-2"
        />

        <Link
          to="/shop/all"
          className="hover:text-black"
        >
          Shop
        </Link>

        {category && (
          <>
            <ChevronRight
              size={12}
              className="mx-2"
            />

            <Link
              to={`/shop/${category.handle}`}
              className="hover:text-black"
            >
              {category.title}
            </Link>
          </>
        )}

        <ChevronRight
          size={12}
          className="mx-2"
        />

        <span className="text-black font-semibold truncate">
          {product.title}
        </span>

      </div>

      {/* ======================================================
          PRODUCT GRID
      ====================================================== */}

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* ====================================================
            LEFT — IMAGE GALLERY
        ==================================================== */}

        <div className="space-y-4">

          <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative group">

            {productMedia[activeMedia]?.type === "video" ? (
              <video
                key={productMedia[activeMedia].url}
                src={productMedia[activeMedia].url}
                poster={
                  productMedia[activeMedia].poster ||
                  undefined
                }
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : productMedia[activeMedia]?.url ? (
              <img
                src={productMedia[activeMedia].url}
                alt={
                  productMedia[activeMedia].altText ||
                  product.title
                }
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No media available
              </div>
            )}

          </div>

          {/* THUMBNAILS
              IMPORTANT: productMedia is NOT split into
              images/videos. It is rendered in the exact
              order Shopify returns it. */}

          {productMedia.length > 0 && (
            <div className="grid grid-cols-4 gap-4">

              {productMedia.map((item, index) => (
                <button
                  key={item.id || `${item.type}-${item.url}`}
                  type="button"
                  onClick={() => {
                    setActiveMedia(index);

                    if (item.type === "image") {
                      setMainImage(item.url);
                    } else {
                      setMainImage(item.url);
                    }
                  }}
                  className={`relative aspect-[3/4] overflow-hidden border ${
                    activeMedia === index
                      ? "border-black"
                      : "border-transparent"
                  }`}
                >
                  {item.type === "video" ? (
                    <>
                      {item.poster ? (
                        <img
                          src={item.poster}
                          alt={item.altText || product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      )}

                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs">
                        ▶
                      </span>
                    </>
                  ) : (
                    <img
                      src={item.url}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      alt={item.altText || product.title}
                    />
                  )}
                </button>
              ))}

            </div>
          )}

        </div>

        {/* ====================================================
            RIGHT — PRODUCT DETAILS
        ==================================================== */}

        <div className="lg:pl-10 sticky top-32 h-fit">

          {/* --------------------------------------------------
              TITLE
          -------------------------------------------------- */}

          <h1 className="text-3xl md:text-4xl font-serif text-gray-900 mb-3">
            {product.title}
          </h1>

          {/* --------------------------------------------------
              PRICE + WISHLIST
          -------------------------------------------------- */}

          <div className="flex items-start justify-between mb-6">

            <div className="flex items-center gap-3">

              <p className="text-xl text-gray-600 font-light">
                {formatPrice(
                  productPrice,
                  selectedVariant
                    ?.price
                    ?.currencyCode ||
                    "INR"
                )}
              </p>

              {hasDiscount && (
                <p className="text-sm text-gray-400 line-through">
                  {formatPrice(
                    compareAtPrice,
                    selectedVariant
                      ?.compareAtPrice
                      ?.currencyCode ||
                      "INR"
                  )}
                </p>
              )}

            </div>

            {/* WISHLIST */}

            <button
              type="button"
              onClick={
                toggleWishlist
              }
              className="flex items-center gap-2 text-xs uppercase tracking-widest transition-colors hover:text-black"
              aria-label={
                isWishlisted
                  ? "Remove from wishlist"
                  : "Add to wishlist"
              }
            >

              <Heart
                size={21}
                strokeWidth={1.8}
                fill={
                  isWishlisted
                    ? "currentColor"
                    : "none"
                }
              />

              <span className="hidden sm:inline">
                {isWishlisted
                  ? "Wishlisted"
                  : "Wishlist"}
              </span>

            </button>

          </div>

          {/* --------------------------------------------------
              REVIEWS
          -------------------------------------------------- */}

          <div className="flex items-center mb-6 space-x-2">

            <div className="flex text-[#b08d75]">

              {[1, 2, 3, 4, 5].map(
                (star) => (
                  <Star
                    key={star}
                    size={16}
                    fill="currentColor"
                    stroke="none"
                  />
                )
              )}

            </div>

            <span className="text-gray-300">
              |
            </span>

            <button
              type="button"
              onClick={
                scrollToReviews
              }
              className="text-sm text-gray-500 hover:text-black underline-offset-4 hover:underline"
            >
              Reviews
            </button>

          </div>

          {/* --------------------------------------------------
              PRODUCT DESCRIPTION

              whitespace-pre-line is IMPORTANT.
              It preserves Shopify line breaks.
          -------------------------------------------------- */}

          {(product.descriptionHtml || product.description) && (
            <div
              className="text-gray-600 text-sm leading-relaxed mb-8
                [&_p]:mb-4
                [&_p:last-child]:mb-0
                [&_br]:content-['']
                [&_strong]:font-semibold
                [&_em]:italic
                [&_ul]:list-disc
                [&_ul]:pl-5
                [&_ol]:list-decimal
                [&_ol]:pl-5
                [&_li]:mb-1"
            >
              {product.descriptionHtml ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: product.descriptionHtml,
                  }}
                />
              ) : (
                <div className="whitespace-pre-line">
                  {product.description}
                </div>
              )}
            </div>
          )}

          {/* ==================================================
              SIZE SELECTOR
          ================================================== */}

          {sizeOptions.length > 0 && (
            <div className="mb-8">

              <div className="flex justify-between items-center mb-3">

                <span className="text-xs font-bold uppercase tracking-widest">
                  Size
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSizeGuideOpen(
                      true
                    )
                  }
                  className="text-sm underline underline-offset-4 text-gray-700 hover:text-black"
                >
                  Size Guide
                </button>

              </div>

              <div className="flex flex-wrap gap-3">

                {sizeOptions.map(
                  (size) => {

                    const variantForSize =
                      variants.find(
                        (variant) =>
                          variant.selectedOptions?.some(
                            (option) =>
                              option.name
                                ?.toLowerCase() ===
                                "size" &&
                              option.value
                                ?.toLowerCase() ===
                                size.toLowerCase()
                          )
                      );

                    const isSelected =
                      selectedSize?.toLowerCase() ===
                      size.toLowerCase();

                    const unavailable =
                      variantForSize &&
                      !variantForSize.availableForSale;

                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={
                          unavailable
                        }
                        onClick={() =>
                          selectSize(
                            size
                          )
                        }
                        className={`w-12 h-12 flex items-center justify-center border text-sm transition-all ${
                          isSelected
                            ? "border-black bg-black text-white"
                            : unavailable
                            ? "border-gray-100 text-gray-300 cursor-not-allowed line-through"
                            : "border-gray-200 hover:border-black text-gray-900"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  }
                )}

              </div>

            </div>
          )}

          {/* ==================================================
              SIZE GUIDE
              
              ALWAYS VISIBLE
              
              This means:
              - Mug → Size Guide visible
              - Dress without sizes → Size Guide visible
              - Dress with sizes → Size selector + Size Guide
          ================================================== */}

          <div className="mb-8">

            <button
              type="button"
              onClick={() =>
                setSizeGuideOpen(
                  true
                )
              }
              className="text-sm underline underline-offset-4 text-gray-700 hover:text-black"
            >
              Size Guide
            </button>

          </div>

          {/* ==================================================
              SIZE GUIDE MODAL
          ================================================== */}

          {sizeGuideOpen && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
              onClick={() =>
                setSizeGuideOpen(
                  false
                )
              }
            >

              <div
                className="bg-white p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-auto"
                onClick={(
                  event
                ) =>
                  event.stopPropagation()
                }
              >

                <div className="flex items-center justify-between mb-6">

                  <h2 className="text-xl font-semibold">
                    Size Guide
                  </h2>

                  <button
                    type="button"
                    onClick={() =>
                      setSizeGuideOpen(
                        false
                      )
                    }
                    className="text-gray-500 hover:text-black text-2xl leading-none"
                    aria-label="Close size guide"
                  >
                    ×
                  </button>

                </div>

                <p className="text-sm text-gray-500 mb-6">
                  All measurements are in inches.
                </p>

                <div className="overflow-x-auto">

                  <table className="w-full text-sm border-collapse border border-gray-200">

                    <thead>
                      <tr>

                        <th className="border border-gray-200 p-3 text-left bg-gray-50">
                          Measurement
                        </th>

                        {SIZES.map(
                          (size) => (
                            <th
                              key={size}
                              className="border border-gray-200 p-3 text-center bg-gray-50"
                            >
                              {size}
                            </th>
                          )
                        )}

                      </tr>
                    </thead>

                    <tbody>

                      {SIZE_CHART.map(
                        (row) => (
                          <tr
                            key={
                              row.label
                            }
                          >

                            <td className="border border-gray-200 p-3 font-medium">
                              {row.label}
                            </td>

                            {SIZES.map(
                              (size) => (
                                <td
                                  key={
                                    size
                                  }
                                  className="border border-gray-200 p-3 text-center"
                                >
                                  {
                                    row[
                                      size
                                    ]
                                  }
                                </td>
                              )
                            )}

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSizeGuideOpen(
                      false
                    )
                  }
                  className="mt-6 w-full bg-black text-white py-3 text-sm uppercase tracking-widest hover:bg-gray-800 transition"
                >
                  Close
                </button>

              </div>

            </div>
          )}

          {/* ==================================================
              WHATSAPP
          ================================================== */}

          <div className="mb-4">

            <button
              type="button"
              onClick={
                handleWhatsApp
              }
              disabled={
                !selectedVariant?.availableForSale ||
                (sizeOptions.length >
                  0 &&
                  !selectedSize)
              }
              className={`w-full border py-4 uppercase tracking-[0.2em] text-xs font-bold transition-colors ${
                !selectedVariant?.availableForSale ||
                (sizeOptions.length >
                  0 &&
                  !selectedSize)
                  ? "opacity-50 cursor-not-allowed text-black border-gray-300"
                  : "text-white bg-green-500 border-green-500 hover:bg-white hover:text-green-700 hover:border-green-700"
              }`}
            >
              Customize on WhatsApp
            </button>

          </div>

          {/* ==================================================
              QUANTITY
          ================================================== */}

          <div className="mb-8 space-y-4">

            <div className="flex items-center border border-gray-200 w-full justify-between px-4 py-4">

              <button
                type="button"
                onClick={() =>
                  setQuantity(
                    (current) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }
                aria-label="Decrease quantity"
              >
                <Minus
                  size={14}
                />
              </button>

              <span className="text-sm font-medium">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() =>
                  setQuantity(
                    (current) =>
                      current + 1
                  )
                }
                aria-label="Increase quantity"
              >
                <Plus
                  size={14}
                />
              </button>

            </div>

            {/* =================================================
                ADD TO CART
            ================================================= */}

            <button
              type="button"
              onClick={
                handleAddToCart
              }
              disabled={
                actionLoading ||
                !selectedVariant ||
                !selectedVariant.availableForSale ||
                (sizeOptions.length >
                  0 &&
                  !selectedSize)
              }
              className={`w-full bg-black text-white uppercase tracking-[0.2em] text-xs font-bold transition-colors py-4 flex items-center justify-center gap-2 ${
                actionLoading ||
                !selectedVariant ||
                !selectedVariant.availableForSale ||
                (sizeOptions.length >
                  0 &&
                  !selectedSize)
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-gray-800"
              }`}
            >

              {actionLoading ? (
                <>
                  <Loader2
                    className="animate-spin"
                    size={16}
                  />

                  Adding...
                </>
              ) : !selectedVariant?.availableForSale ? (
                "Sold Out"
              ) : sizeOptions.length >
                0 &&
                !selectedSize ? (
                "Select Size"
              ) : (
                "Add to Cart"
              )}

            </button>

          </div>

          {/* ==================================================
              PRODUCT INFORMATION
          ================================================== */}

          <div className="border-t border-gray-100 pt-6 space-y-2 text-xs text-gray-500">

            {product.productType && (
              <p>
                <span className="font-semibold text-gray-700">
                  Type:
                </span>{" "}
                {product.productType}
              </p>
            )}

            {product.vendor && (
              <p>
                <span className="font-semibold text-gray-700">
                  Brand:
                </span>{" "}
                {product.vendor}
              </p>
            )}

            <p>
              <span className="font-semibold text-gray-700">
                Availability:
              </span>{" "}
              {selectedVariant?.availableForSale
                ? "In stock"
                : "Sold out"}
            </p>

          </div>

        </div>

      </div>

      {/* ======================================================
          CUSTOMER REVIEWS
      ====================================================== */}

      <div
        ref={reviewsRef}
        className="bg-[#f9f9f9] mt-32 py-20"
      >

        <div className="max-w-6xl mx-auto px-4">

          <div className="text-center mb-12">

            <h2 className="text-3xl font-serif text-gray-900 mb-4">
              Customer Reviews
            </h2>

            <p className="text-sm text-gray-500">
              Reviews powered by Judge.me
            </p>

          </div>

          <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 border border-gray-200">

            {reviewsLoading && (
              <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-sm">Loading reviews...</span>
              </div>
            )}

            {!reviewsLoading && reviewsError && (
              <div className="py-10 text-center">
                <MessageSquare
                  className="mx-auto text-gray-300 mb-4"
                  size={36}
                />
                <p className="text-sm text-gray-500">
                  {reviewsError}
                </p>
              </div>
            )}

            {!reviewsLoading &&
              !reviewsError &&
              judgeMeReviews.length === 0 && (
                <div className="py-10 text-center">
                  <MessageSquare
                    className="mx-auto text-gray-300 mb-4"
                    size={36}
                  />
                  <p className="text-sm text-gray-500">
                    No reviews yet. Be the first to review this product.
                  </p>
                  <button
                    type="button"
                    onClick={openReviewForm}
                    className="mt-5 inline-flex items-center justify-center border border-gray-900 px-6 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-900 hover:text-white"
                  >
                    Write the Review
                  </button>
                </div>
              )}

            {!reviewsLoading &&
              !reviewsError &&
              judgeMeReviews.length > 0 && (
                <div className="space-y-8">
                  {judgeMeReviews.map((review) => (
                    <article
                      key={review.uuid || review.id}
                      className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                size={16}
                                className={
                                  index < Number(review.rating || 0)
                                    ? "fill-current text-gray-900"
                                    : "text-gray-300"
                                }
                              />
                            ))}
                          </div>

                          <h3 className="mt-3 text-base font-medium text-gray-900">
                            {review.title || "Customer review"}
                          </h3>
                        </div>

                        {review.created_at && (
                          <time
                            className="shrink-0 text-xs text-gray-400"
                            dateTime={review.created_at}
                          >
                            {new Date(review.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </time>
                        )}
                      </div>

                      {review.body_html ? (
                        <div
                          className="mt-3 text-sm leading-7 text-gray-600 [&_p]:mb-2 [&_p:last-child]:mb-0"
                          dangerouslySetInnerHTML={{
                            __html: review.body_html,
                          }}
                        />
                      ) : review.body ? (
                        <p className="mt-3 text-sm leading-7 text-gray-600">
                          {review.body}
                        </p>
                      ) : null}

                      <p className="mt-4 text-xs text-gray-400">
                        — {review.is_anonymous_reviewer
                          ? "Anonymous"
                          : review.reviewer_name || "Customer"}
                      </p>
                    </article>
                  ))}

                  {reviewsTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <button
                        type="button"
                        disabled={reviewsPage <= 1}
                        onClick={() =>
                          setReviewsPage((page) => Math.max(1, page - 1))
                        }
                        className="px-4 py-2 border border-gray-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>

                      <span className="text-xs text-gray-500">
                        Page {reviewsPage} of {reviewsTotalPages}
                      </span>

                      <button
                        type="button"
                        disabled={reviewsPage >= reviewsTotalPages}
                        onClick={() =>
                          setReviewsPage((page) =>
                            Math.min(reviewsTotalPages, page + 1)
                          )
                        }
                        className="px-4 py-2 border border-gray-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}

            {reviewFormOpen && (
              <form
                onSubmit={submitReview}
                className="mt-10 border-t border-gray-200 pt-10"
              >
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-xl font-serif text-gray-900">Write a Review</h3>
                    <p className="mt-1 text-sm text-gray-500">Share your experience with this product.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeReviewForm}
                    disabled={reviewSubmitting}
                    className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40"
                  >
                    Close
                  </button>
                </div>

                <div className="mb-6">
                  <p className="mb-2 text-sm font-medium text-gray-900">Your rating</p>
                  <div className="flex items-center gap-2" role="radiogroup" aria-label="Product rating">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReviewRating(value)}
                          className="p-1"
                          aria-label={`${value} star${value === 1 ? "" : "s"}`}
                          aria-pressed={reviewRating === value}
                        >
                          <Star
                            size={24}
                            className={value <= reviewRating ? "fill-current text-gray-900" : "text-gray-300"}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900" htmlFor="review-title">Review title</label>
                    <input
                      id="review-title"
                      value={reviewTitle}
                      onChange={(event) => setReviewTitle(event.target.value)}
                      maxLength={150}
                      autoComplete="off"
                      className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
                      placeholder="What did you think?"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900" htmlFor="review-body">Your review</label>
                    <textarea
                      id="review-body"
                      value={reviewBody}
                      onChange={(event) => setReviewBody(event.target.value)}
                      maxLength={5000}
                      rows={6}
                      className="w-full resize-y border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
                      placeholder="Tell us about your experience..."
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900" htmlFor="review-name">Your name</label>
                      <input
                        id="review-name"
                        value={reviewName}
                        onChange={(event) => setReviewName(event.target.value)}
                        maxLength={120}
                        autoComplete="name"
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900" htmlFor="review-email">Email</label>
                      <input
                        id="review-email"
                        type="email"
                        value={reviewEmail}
                        onChange={(event) => setReviewEmail(event.target.value)}
                        maxLength={254}
                        autoComplete="email"
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={reviewAnonymous}
                      onChange={(event) => setReviewAnonymous(event.target.checked)}
                      className="mt-1"
                    />
                    <span>Post this review anonymously.</span>
                  </label>

                  <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                    <label htmlFor="review-website">Website</label>
                    <input
                      id="review-website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={reviewWebsite}
                      onChange={(event) => setReviewWebsite(event.target.value)}
                    />
                  </div>

                  {reviewSubmitError && (
                    <p className="text-sm text-red-600" role="alert">{reviewSubmitError}</p>
                  )}
                  {reviewSubmitSuccess && (
                    <p className="text-sm text-green-700" role="status">{reviewSubmitSuccess}</p>
                  )}

                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="inline-flex w-full items-center justify-center bg-gray-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                  >
                    {reviewSubmitting ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default ProductPage;