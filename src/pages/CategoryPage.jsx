import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getShopifyCollectionProducts } from '../lib/shopifyClient';

const PRODUCTS_PER_PAGE = 12;

const CategoryPage = () => {
  const { categoryId } = useParams();

  const [products, setProducts] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);

  /*
   * Shopify collection handles are normally already URL-friendly.
   *
   * Example:
   * Dresses             -> dresses
   * Block Print Dresses -> block-print-dresses
   * Shirts & Co-ords    -> shirts-co-ords
   */
  const collectionHandle = categoryId?.toLowerCase();

  // Reset page whenever category changes
  useEffect(() => {
    setPage(1);
  }, [categoryId]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError('');
      setProducts([]);
      setCategoryName('');

      try {
        /*
         * "all" is kept as a special case so /category/all
         * can still display every Shopify product.
         */
        if (collectionHandle === 'all') {
          const { getShopifyProducts } = await import(
            '../lib/shopifyClient'
          );

          const allProducts = await getShopifyProducts(100);

          setProducts(allProducts || []);
          setCategoryName('Shop');
          return;
        }

        const result = await getShopifyCollectionProducts(
          collectionHandle,
          100
        );

        if (!result.collection) {
          setCategoryName(
            formatCategoryName(collectionHandle)
          );

          setProducts([]);
          return;
        }

        setCategoryName(result.collection.title);
        setProducts(result.products || []);
      } catch (err) {
        console.error(
          'Error fetching Shopify collection:',
          err
        );

        setError(
          err?.message ||
            'Unable to load this collection.'
        );
      } finally {
        setLoading(false);
      }
    };

    if (collectionHandle) {
      fetchProducts();
    }
  }, [collectionHandle]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [page, categoryId]);

  /*
   * Convert:
   * "block-print-dresses"
   * into:
   * "Block Print Dresses"
   *
   * This is only used as a fallback if Shopify
   * does not return a collection.
   */
  const formatCategoryName = (handle) => {
    if (!handle) return '';

    return handle
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  /*
   * Shopify returns images as:
   *
   * featuredImage: {
   *   url,
   *   altText
   * }
   *
   * Use featuredImage first, then fall back
   * to the first product image.
   */
  const getMainImage = (product) => {
    if (product?.featuredImage?.url) {
      return product.featuredImage.url;
    }

    if (
      product?.images?.nodes &&
      product.images.nodes.length > 0
    ) {
      return product.images.nodes[0].url;
    }

    return '';
  };

  /*
   * Get the first available variant price.
   */
  const getProductPrice = (product) => {
    const variants = product?.variants?.nodes;

    if (!Array.isArray(variants) || variants.length === 0) {
      return null;
    }

    const availableVariant =
      variants.find(
        (variant) => variant.availableForSale
      ) || variants[0];

    return availableVariant?.price || null;
  };

  const formatPrice = (price) => {
    if (!price?.amount) {
      return '';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: price.currencyCode || 'INR',
      maximumFractionDigits: 0,
    }).format(Number(price.amount));
  };

  /*
   * Client-side pagination.
   *
   * We fetch the collection products from Shopify
   * and divide them into pages of 12.
   */
  const totalPages = Math.max(
    1,
    Math.ceil(products.length / PRODUCTS_PER_PAGE)
  );

  const startIndex =
    (page - 1) * PRODUCTS_PER_PAGE;

  const endIndex =
    startIndex + PRODUCTS_PER_PAGE;

  const displayedProducts = products.slice(
    startIndex,
    endIndex
  );

  /*
   * Prevent page from becoming invalid if products
   * change while the user is browsing.
   */
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="pt-32 px-4 max-w-7xl mx-auto min-h-screen">

      {/* =====================================================
          TITLE
      ====================================================== */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-serif capitalize tracking-wide text-gray-900">
          {categoryName
            ? `${categoryName} Collection`
            : 'Collection'}
        </h1>

        <div className="w-16 h-1 bg-[#b08d75] mx-auto mt-4" />
      </div>

      {/* =====================================================
          LOADING
      ====================================================== */}
      {loading && (
        <div className="text-center py-20 text-gray-400">
          Loading products...
        </div>
      )}

      {/* =====================================================
          ERROR
      ====================================================== */}
      {!loading && error && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">
            {error}
          </p>

          <Link
            to="/"
            className="text-black underline mt-4 block"
          >
            Go back home
          </Link>
        </div>
      )}

      {/* =====================================================
          EMPTY COLLECTION
      ====================================================== */}
      {!loading &&
        !error &&
        displayedProducts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">
              No products found in this collection.
            </p>

            <Link
              to="/"
              className="text-black underline mt-4 block"
            >
              Go back home
            </Link>
          </div>
        )}

      {/* =====================================================
          PRODUCT GRID
      ====================================================== */}
      {!loading &&
        !error &&
        displayedProducts.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">

              {displayedProducts.map((product) => {
                const image = getMainImage(product);
                const price = getProductPrice(product);

                return (
                  <Link
                    to={`/product/${product.handle}`}
                    key={product.id}
                    className="group cursor-pointer"
                  >
                    {/* Product image */}
                    <div className="relative overflow-hidden mb-4 bg-gray-100 aspect-[3/4]">

                      {image ? (
                        <img
                          src={image}
                          alt={
                            product?.featuredImage
                              ?.altText ||
                            product.title
                          }
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Product information */}
                    <div className="text-center">

                      <h3 className="text-sm font-medium text-gray-900 font-serif tracking-wide">
                        {product.title}
                      </h3>

                      {price && (
                        <p className="text-sm text-gray-500 mt-1">
                          {formatPrice(price)}
                        </p>
                      )}

                    </div>
                  </Link>
                );
              })}

            </div>

            {/* =================================================
                PAGINATION
            ================================================== */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-12 gap-4 items-center">

                <button
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.max(
                        1,
                        currentPage - 1
                      )
                    )
                  }
                  className="px-4 py-2 border text-sm disabled:opacity-50"
                  disabled={page === 1}
                >
                  Previous
                </button>

                <span className="px-4 py-2 text-sm">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.min(
                        totalPages,
                        currentPage + 1
                      )
                    )
                  }
                  className="px-4 py-2 border text-sm disabled:opacity-50"
                  disabled={page >= totalPages}
                >
                  Next
                </button>

              </div>
            )}
          </>
        )}

      {/* =====================================================
          SCROLL TO TOP
      ====================================================== */}
      <button
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          })
        }
        className="fixed bottom-6 right-6 bg-black text-white px-4 py-3 rounded-full shadow-lg hover:bg-gray-800 transition"
        aria-label="Scroll to top"
      >
        ↑
      </button>

    </div>
  );
};

export default CategoryPage;