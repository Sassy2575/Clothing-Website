import React, { useEffect, useState } from 'react';
import {
  Search,
  ShoppingBag,
  User,
  Menu,
  X,
  Heart,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const logo =
  'https://cdn.shopify.com/s/files/1/0998/2466/4865/files/logo.png?v=1788111781';

const SHOPIFY_STORE_DOMAIN =
  import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;

const SHOPIFY_STOREFRONT_TOKEN =
  import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

const SHOPIFY_API_VERSION =
  import.meta.env.VITE_SHOPIFY_API_VERSION || '2026-07';

const SHOPIFY_API_URL = SHOPIFY_STORE_DOMAIN
  ? `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`
  : '';

// Fallback categories used by the storefront navbar.
const FALLBACK_NAV_ITEMS = [
  { id: 'accessories', title: 'Accessories', handle: 'accessories' },
  { id: 'dresses', title: 'Dresses', handle: 'dresses' },
  {
    id: 'block-print-dresses',
    title: 'Block Print Dresses',
    handle: 'block-print-dresses',
  },
  {
    id: 'shirts-and-co-ords',
    title: 'Shirts and Co-Ords',
    handle: 'shirts-and-co-ords',
  },
  { id: 'suits', title: 'Suits', handle: 'suits' },
];


/**
 * Shopify Storefront API request.
 *
 */
async function shopifyRequest(query, variables = {}) {
  if (!SHOPIFY_API_URL) {
    throw new Error('VITE_SHOPIFY_STORE_DOMAIN is missing.');
  }

  if (!SHOPIFY_STOREFRONT_TOKEN) {
    throw new Error('VITE_SHOPIFY_STOREFRONT_TOKEN is missing.');
  }

  const response = await fetch(SHOPIFY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token':
        SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.errors?.[0]?.message ||
        `Shopify request failed (${response.status})`
    );
  }

  if (result?.errors?.length) {
    throw new Error(
      result.errors.map((error) => error.message).join(', ')
    );
  }

  return result?.data;
}


/**
 * Get Shopify collections.
 */
async function getShopifyCollections() {
  const query = `
    query GetCollections($first: Int!) {
      collections(first: $first) {
        nodes {
          id
          title
          handle
        }
      }
    }
  `;

  const data = await shopifyRequest(query, { first: 20 });

  return data?.collections?.nodes || [];
}


const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);

  // Start with a visible fallback so the navbar never disappears
  // while Shopify collections are loading.
  const [collections, setCollections] = useState(FALLBACK_NAV_ITEMS);

  const navigate = useNavigate();


  // ------------------------------------------------------------
  // SHOPIFY COLLECTIONS
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadCollections = async () => {
      try {
        const shopifyCollections = await getShopifyCollections();

        if (cancelled) return;

        // Keep only the five storefront categories and display them
        // in the exact order used by the site.
        const categoryHandles = new Set(
          FALLBACK_NAV_ITEMS.map((item) => item.handle)
        );

        const categoryCollections = shopifyCollections.filter((collection) =>
          categoryHandles.has(collection.handle)
        );

        if (categoryCollections.length > 0) {
          const orderedCollections = FALLBACK_NAV_ITEMS
            .map((fallback) =>
              categoryCollections.find(
                (collection) => collection.handle === fallback.handle
              )
            )
            .filter(Boolean);

          const existingHandles = new Set(
            orderedCollections.map((collection) => collection.handle)
          );

          const missingCollections = FALLBACK_NAV_ITEMS.filter(
            (fallback) => !existingHandles.has(fallback.handle)
          );

          setCollections([...orderedCollections, ...missingCollections]);
        } else {
          setCollections(FALLBACK_NAV_ITEMS);
        }
      } catch (error) {
        // Do NOT break the navbar if collections fail.
        console.error('Navbar: Shopify collections failed:', error);
      }
    };

    loadCollections();

    return () => {
      cancelled = true;
    };
  }, []);


  // ------------------------------------------------------------
  // SHOPIFY CART COUNT
  // ------------------------------------------------------------
  const updateCartCount = () => {
    try {
      const rawCart = localStorage.getItem('shopify_cart');

      if (!rawCart) {
        setCartCount(0);
        return;
      }

      const cart = JSON.parse(rawCart);

      // Shopify Storefront Cart shape:
      // { lines: { edges: [{ node: { quantity } }] } }
      if (Array.isArray(cart?.lines?.edges)) {
        const total = cart.lines.edges.reduce(
          (sum, edge) => sum + Number(edge?.node?.quantity || 0),
          0
        );

        setCartCount(total);
        return;
      }

      // Support a simple array if the current cart page
      // stores cart items differently.
      if (Array.isArray(cart)) {
        const total = cart.reduce(
          (sum, item) => sum + Number(item?.quantity || 1),
          0
        );

        setCartCount(total);
        return;
      }

      setCartCount(0);
    } catch (error) {
      console.error('Navbar: unable to read cart:', error);
      setCartCount(0);
    }
  };


  useEffect(() => {
    updateCartCount();

    window.addEventListener('cartUpdated', updateCartCount);
    window.addEventListener('storage', updateCartCount);

    return () => {
      window.removeEventListener('cartUpdated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);


  // ------------------------------------------------------------
  // COLLECTION URL
  // ------------------------------------------------------------
  const getCollectionUrl = (collection) => {
    return `/shop/${collection.handle}`;
  };


  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------
  const handleSearch = (event) => {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) return;

    setIsSearchOpen(false);
    setSearchQuery('');

    navigate(`/search?q=${encodeURIComponent(query)}`);
  };


  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">

          {/* MOBILE MENU BUTTON */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setIsOpen((previous) => !previous)}
              className="text-gray-800"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>


          {/* LOGO */}
          <div className="flex-shrink-0 flex items-center justify-center flex-1 md:flex-none md:justify-start">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
            >
              <img
                src={logo}
                alt="Sapna Munoth"
                className="h-16 w-auto object-contain"
              />
            </Link>
          </div>


          {/* DESKTOP NAVIGATION */}
          <div className="hidden md:flex space-x-8 items-center justify-center flex-1">

            {collections.map((collection) => (
              <Link
                key={collection.id}
                to={getCollectionUrl(collection)}
                className="text-gray-700 hover:text-black text-xs font-medium uppercase tracking-widest transition-colors duration-200"
              >
                {collection.title}
              </Link>
            ))}

          </div>


          {/* RIGHT ACTIONS */}
          <div className="flex items-center space-x-5 text-gray-700">

            {/* WISHLIST */}
            <Link
              to="/wishlist"
              className="hidden sm:block"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5 hover:text-black" />
            </Link>


            {/* CUSTOMER ACCOUNT */}
            <Link
              to="/login"
              className="hidden sm:block"
              aria-label="Account"
            >
              <User className="w-5 h-5 hover:text-black" />
            </Link>


            {/* SEARCH */}
            <button
              type="button"
              onClick={() => setIsSearchOpen((previous) => !previous)}
              className="hidden sm:block"
              aria-label="Search"
            >
              <Search className="w-5 h-5 hover:text-black" />
            </button>


            {/* CART */}
            <div className="relative">
              <Link
                to="/cart"
                aria-label="Shopping bag"
              >
                <ShoppingBag className="w-5 h-5 hover:text-black" />

                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>

          </div>
        </div>
      </div>


      {/* SEARCH PANEL */}
      {isSearchOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-gray-200 py-4 px-4 shadow-lg z-40">
          <form
            onSubmit={handleSearch}
            className="max-w-3xl mx-auto flex items-center border-b border-black pb-2"
          >
            <Search className="text-gray-400 w-5 h-5 mr-3" />

            <input
              type="text"
              placeholder="Search..."
              className="flex-1 outline-none text-sm placeholder-gray-400"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              autoFocus
            />

            <button
              type="submit"
              className="text-xs font-bold uppercase tracking-widest"
            >
              Search
            </button>
          </form>
        </div>
      )}


      {/* MOBILE MENU */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 absolute w-full left-0 shadow-lg">
          <div className="px-4 pt-2 pb-6 space-y-1">

            {collections.map((collection) => (
              <Link
                key={collection.id}
                to={getCollectionUrl(collection)}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 uppercase tracking-widest"
              >
                {collection.title}
              </Link>
            ))}


            <Link
              to="/wishlist"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-3 text-sm font-medium hover:bg-gray-50 uppercase tracking-widest border-t border-gray-100 mt-2"
            >
              <Heart className="w-4 h-4" />
              Wishlist
            </Link>


            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-3 text-sm font-medium hover:bg-gray-50 uppercase tracking-widest"
            >
              <User className="w-4 h-4" />
              Account
            </Link>


            <Link
              to="/cart"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-3 text-sm font-medium hover:bg-gray-50 uppercase tracking-widest"
            >
              <ShoppingBag className="w-4 h-4" />
              Cart
              {cartCount > 0 ? ` (${cartCount})` : ''}
            </Link>

          </div>
        </div>
      )}

    </nav>
  );
};

export default Navbar;
