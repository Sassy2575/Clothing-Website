import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";

/* -------------------------------------------------------------
   Shopify Configuration
------------------------------------------------------------- */

const SHOPIFY_STORE_DOMAIN =
  import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;

const SHOPIFY_STOREFRONT_TOKEN =
  import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

const SHOPIFY_API_VERSION =
  import.meta.env.VITE_SHOPIFY_API_VERSION || "2026-07";

const SHOPIFY_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

/* -------------------------------------------------------------
   Shopify Request
------------------------------------------------------------- */

async function shopifyRequest(query, variables = {}) {
  if (!SHOPIFY_STORE_DOMAIN) {
    throw new Error(
      "Missing VITE_SHOPIFY_STORE_DOMAIN."
    );
  }

  if (!SHOPIFY_STOREFRONT_TOKEN) {
    throw new Error(
      "Missing VITE_SHOPIFY_STOREFRONT_TOKEN."
    );
  }

  const response = await fetch(
    SHOPIFY_API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token":
          SHOPIFY_STOREFRONT_TOKEN,
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

/* -------------------------------------------------------------
   Search Shopify Products
------------------------------------------------------------- */

async function searchShopifyProducts(searchQuery) {
  const query = `
    query SearchProducts($query: String!) {
      products(
        first: 50
        query: $query
      ) {
        nodes {
          id
          title
          handle
          description
          productType
          vendor

          featuredImage {
            url
            altText
          }

          images(first: 10) {
            nodes {
              id
              url
              altText
            }
          }

          variants(first: 20) {
            nodes {
              id
              title
              availableForSale

              price {
                amount
                currencyCode
              }

              compareAtPrice {
                amount
                currencyCode
              }

              image {
                url
                altText
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyRequest(
    query,
    {
      query: searchQuery,
    }
  );

  return data?.products?.nodes || [];
}

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */

function getProductImage(product) {
  if (product?.featuredImage?.url) {
    return product.featuredImage.url;
  }

  if (
    product?.images?.nodes?.length > 0
  ) {
    return product.images.nodes[0].url;
  }

  return "";
}

function getProductVariant(product) {
  const variants =
    product?.variants?.nodes || [];

  return (
    variants.find(
      (variant) =>
        variant.availableForSale
    ) ||
    variants[0] ||
    null
  );
}

function formatPrice(
  amount,
  currency = "INR"
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }
  ).format(Number(amount || 0));
}

/* -------------------------------------------------------------
   Search Page
------------------------------------------------------------- */

const SearchPage = () => {
  const [searchParams] =
    useSearchParams();

  const query =
    searchParams.get("q")?.trim() || "";

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* -----------------------------------------------------------
     Search
  ----------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const fetchSearchResults =
      async () => {
        if (!query) {
          setProducts([]);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          /*
           * Shopify searches products by title,
           * description, product type, vendor, etc.
           */

          const results =
            await searchShopifyProducts(
              query
            );

          if (cancelled) return;

          setProducts(results);

        } catch (err) {
          console.error(
            "SHOPIFY SEARCH ERROR:",
            err
          );

          if (!cancelled) {
            setProducts([]);

            setError(
              err?.message ||
                "Unable to search products."
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    fetchSearchResults();

    return () => {
      cancelled = true;
    };
  }, [query]);

  /* -----------------------------------------------------------
     Empty Search
  ----------------------------------------------------------- */

  if (!query) {
    return (
      <div className="min-h-screen bg-white pt-40 px-4">

        <div className="max-w-2xl mx-auto text-center">

          <Search
            size={40}
            strokeWidth={1}
            className="mx-auto mb-6 text-gray-300"
          />

          <h1 className="text-3xl font-serif text-gray-900 mb-3">
            Search
          </h1>

          <p className="text-gray-500">
            Enter a product name to search
            our collection.
          </p>

        </div>

      </div>
    );
  }

  /* -----------------------------------------------------------
     Loading
  ----------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-40 text-center">

        <Loader2
          size={28}
          className="mx-auto mb-4 animate-spin"
        />

        <p className="text-gray-500">
          Searching for "{query}"...
        </p>

      </div>
    );
  }

  /* -----------------------------------------------------------
     Error
  ----------------------------------------------------------- */

  if (error) {
    return (
      <div className="min-h-screen bg-white pt-40 px-4 text-center">

        <h1 className="text-2xl font-serif mb-4">
          Something went wrong
        </h1>

        <p className="text-sm text-red-500 mb-6">
          {error}
        </p>

        <Link
          to="/"
          className="underline text-sm uppercase tracking-widest"
        >
          Back to Home
        </Link>

      </div>
    );
  }

  /* -----------------------------------------------------------
     Render
  ----------------------------------------------------------- */

  return (
    <div className="bg-white pt-32 pb-20 min-h-screen">

      <div className="max-w-7xl mx-auto px-4">

        {/* -----------------------------------------------------
            HEADER
        ----------------------------------------------------- */}

        <div className="text-center mb-14">

          <h1 className="text-3xl md:text-4xl font-serif text-gray-900">
            Search Results
          </h1>

          <p className="text-gray-500 mt-3 italic">
            for "{query}"
          </p>

          {products.length > 0 && (
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-4">
              {products.length}{" "}
              {products.length === 1
                ? "product"
                : "products"}{" "}
              found
            </p>
          )}

        </div>

        {/* -----------------------------------------------------
            NO RESULTS
        ----------------------------------------------------- */}

        {products.length === 0 ? (
          <div className="text-center py-20">

            <Search
              size={40}
              strokeWidth={1}
              className="mx-auto mb-6 text-gray-300"
            />

            <p className="text-gray-600 text-lg mb-3">
              No products found
            </p>

            <p className="text-gray-400 text-sm mb-8">
              We couldn't find anything
              matching "{query}".
            </p>

            <Link
              to="/shop/all"
              className="inline-block border border-black px-8 py-3 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition"
            >
              View Collection
            </Link>

          </div>
        ) : (

          /* ---------------------------------------------------
             PRODUCTS
          --------------------------------------------------- */

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">

            {products.map(
              (product) => {

                const variant =
                  getProductVariant(
                    product
                  );

                const image =
                  getProductImage(
                    product
                  );

                const price =
                  variant?.price?.amount ||
                  0;

                const currency =
                  variant
                    ?.price
                    ?.currencyCode ||
                  "INR";

                const compareAtPrice =
                  Number(
                    variant
                      ?.compareAtPrice
                      ?.amount || 0
                  );

                const productPrice =
                  Number(price);

                const hasDiscount =
                  compareAtPrice >
                  productPrice;

                return (
                  <Link
                    key={product.id}
                    to={`/product/${product.handle}`}
                    className="group block"
                  >

                    {/* IMAGE */}

                    <div className="relative overflow-hidden bg-gray-100 aspect-[3/4] mb-4">

                      {image ? (
                        <img
                          src={image}
                          alt={
                            product
                              ?.featuredImage
                              ?.altText ||
                            product.title
                          }
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          No image
                        </div>
                      )}

                      {/* SALE BADGE */}

                      {hasDiscount && (
                        <span className="absolute top-3 left-3 bg-white px-3 py-1 text-[10px] uppercase tracking-widest">
                          Sale
                        </span>
                      )}

                    </div>

                    {/* DETAILS */}

                    <div className="text-center">

                      <h3 className="text-sm font-medium text-gray-900 font-serif tracking-wide group-hover:underline underline-offset-4">
                        {product.title}
                      </h3>

                      <div className="flex justify-center items-center gap-2 mt-2">

                        <p className="text-sm text-gray-600">
                          {formatPrice(
                            price,
                            currency
                          )}
                        </p>

                        {hasDiscount && (
                          <p className="text-xs text-gray-400 line-through">
                            {formatPrice(
                              compareAtPrice,
                              variant
                                ?.compareAtPrice
                                ?.currencyCode ||
                                currency
                            )}
                          </p>
                        )}

                      </div>

                    </div>

                  </Link>
                );
              }
            )}

          </div>
        )}

      </div>

    </div>
  );
};

export default SearchPage;