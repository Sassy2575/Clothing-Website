import React, { useEffect, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  Loader2,
  ShoppingBag,
  MessageCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

const SHOPIFY_STORE_DOMAIN =
  import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;

const SHOPIFY_STOREFRONT_TOKEN =
  import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

const SHOPIFY_API_VERSION =
  import.meta.env.VITE_SHOPIFY_API_VERSION || "2026-07";

const SHOPIFY_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

const CART_STORAGE_KEY = "shopify_cart";

/*
 * WhatsApp number
 *
 * India country code = 91
 * 9885033462 -> 919885033462
 */
const WHATSAPP_NUMBER = "919885033462";

/* -------------------------------------------------------------
   Shopify API
------------------------------------------------------------- */

async function shopifyRequest(query, variables = {}) {
  if (!SHOPIFY_STORE_DOMAIN) {
    throw new Error("Missing VITE_SHOPIFY_STORE_DOMAIN.");
  }

  if (!SHOPIFY_STOREFRONT_TOKEN) {
    throw new Error("Missing VITE_SHOPIFY_STOREFRONT_TOKEN.");
  }

  const response = await fetch(SHOPIFY_API_URL, {
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
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.errors
        ?.map((error) => error.message)
        .join(", ") ||
        `Shopify request failed (${response.status}).`
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
   Fetch Cart
------------------------------------------------------------- */

async function getShopifyCart(cartId) {
  const query = `
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        id
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
    }
  `;

  const data = await shopifyRequest(query, {
    cartId,
  });

  return data?.cart || null;
}

/* -------------------------------------------------------------
   Update Cart Line
------------------------------------------------------------- */

async function updateShopifyCartLine(
  cartId,
  lineId,
  quantity
) {
  const mutation = `
    mutation UpdateCartLines(
      $cartId: ID!
      $lines: [CartLineUpdateInput!]!
    ) {
      cartLinesUpdate(
        cartId: $cartId
        lines: $lines
      ) {
        cart {
          id
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

  const data = await shopifyRequest(mutation, {
    cartId,
    lines: [
      {
        id: lineId,
        quantity,
      },
    ],
  });

  const errors =
    data?.cartLinesUpdate?.userErrors || [];

  if (errors.length) {
    throw new Error(
      errors
        .map((error) => error.message)
        .join(", ")
    );
  }

  return data?.cartLinesUpdate?.cart;
}

/* -------------------------------------------------------------
   Remove Cart Line
------------------------------------------------------------- */

async function removeShopifyCartLine(
  cartId,
  lineId
) {
  const mutation = `
    mutation RemoveCartLines(
      $cartId: ID!
      $lineIds: [ID!]!
    ) {
      cartLinesRemove(
        cartId: $cartId
        lineIds: $lineIds
      ) {
        cart {
          id
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

  const data = await shopifyRequest(mutation, {
    cartId,
    lineIds: [lineId],
  });

  const errors =
    data?.cartLinesRemove?.userErrors || [];

  if (errors.length) {
    throw new Error(
      errors
        .map((error) => error.message)
        .join(", ")
    );
  }

  return data?.cartLinesRemove?.cart;
}

/* -------------------------------------------------------------
   Cart Storage
------------------------------------------------------------- */

function saveCart(cart) {
  if (!cart) {
    localStorage.removeItem(CART_STORAGE_KEY);
  } else {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cart)
    );
  }

  window.dispatchEvent(
    new Event("cartUpdated")
  );
}

function getSavedCart() {
  try {
    const raw = localStorage.getItem(
      CART_STORAGE_KEY
    );

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
    return null;
  }
}

/* -------------------------------------------------------------
   Price Helper
------------------------------------------------------------- */

function formatPrice(
  amount,
  currencyCode = "INR"
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

/* -------------------------------------------------------------
   Cart Page
------------------------------------------------------------- */

const CartPage = () => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(null);
  const [error, setError] = useState("");

  /* -----------------------------------------------------------
     Load Cart
  ----------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const loadCart = async () => {
      try {
        setLoading(true);
        setError("");

        const savedCart = getSavedCart();

        if (!savedCart?.id) {
          if (!cancelled) {
            setCart(null);
          }

          return;
        }

        const freshCart =
          await getShopifyCart(savedCart.id);

        if (!freshCart) {
          localStorage.removeItem(
            CART_STORAGE_KEY
          );

          if (!cancelled) {
            setCart(null);
          }

          return;
        }

        if (!cancelled) {
          setCart(freshCart);
          saveCart(freshCart);
        }
      } catch (err) {
        console.error(
          "Error loading Shopify cart:",
          err
        );

        localStorage.removeItem(
          CART_STORAGE_KEY
        );

        if (!cancelled) {
          setCart(null);
          setError(
            err?.message ||
              "Unable to load your shopping bag."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCart();

    return () => {
      cancelled = true;
    };
  }, []);

  /* -----------------------------------------------------------
     Cart Lines
  ----------------------------------------------------------- */

  const cartLines =
    cart?.lines?.edges?.map(
      (edge) => edge.node
    ) || [];

  /* -----------------------------------------------------------
     Update Quantity
  ----------------------------------------------------------- */

  const updateQuantity = async (
    line,
    change
  ) => {
    const newQuantity =
      line.quantity + change;

    if (newQuantity < 1) {
      return;
    }

    try {
      setActionLoading(line.id);
      setError("");

      const updatedCart =
        await updateShopifyCartLine(
          cart.id,
          line.id,
          newQuantity
        );

      if (!updatedCart) {
        throw new Error(
          "Shopify did not return the updated cart."
        );
      }

      setCart(updatedCart);
      saveCart(updatedCart);
    } catch (err) {
      console.error(
        "Error updating Shopify cart:",
        err
      );

      setError(
        err?.message ||
          "Unable to update quantity."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /* -----------------------------------------------------------
     Remove Item
  ----------------------------------------------------------- */

  const removeItem = async (line) => {
    try {
      setActionLoading(line.id);
      setError("");

      const updatedCart =
        await removeShopifyCartLine(
          cart.id,
          line.id
        );

      if (!updatedCart) {
        throw new Error(
          "Shopify did not return the updated cart."
        );
      }

      setCart(updatedCart);
      saveCart(updatedCart);
    } catch (err) {
      console.error(
        "Error removing Shopify cart item:",
        err
      );

      setError(
        err?.message ||
          "Unable to remove this item."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /* -----------------------------------------------------------
     WhatsApp Checkout
  ----------------------------------------------------------- */

  const handleWhatsAppOrder = () => {
    if (!cartLines.length) {
      return;
    }

    const subtotal =
      cart.cost?.subtotalAmount?.amount || 0;

    const currency =
      cart.cost?.subtotalAmount
        ?.currencyCode || "INR";

    const itemsText = cartLines
      .map((line, index) => {
        const variant =
          line.merchandise;

        const product =
          variant?.product;

        if (!product) {
          return "";
        }

        const price =
          Number(
            variant?.price?.amount || 0
          );

        const lineTotal =
          price * line.quantity;

        const sizeOption =
          variant?.selectedOptions?.find(
            (option) =>
              option.name
                ?.toLowerCase() ===
              "size"
          );

        const size =
          sizeOption?.value || null;

        const otherOptions =
          variant?.selectedOptions
            ?.filter(
              (option) =>
                option.name
                  ?.toLowerCase() !==
                "size"
            )
            ?.map(
              (option) =>
                `${option.name}: ${option.value}`
            )
            ?.join(", ");

        return `
${index + 1}. ${product.title}
Variant: ${variant.title}
${size ? `Size: ${size}\n` : ""}${otherOptions ? `${otherOptions}\n` : ""}Quantity: ${line.quantity}
Price: ${formatPrice(
          price,
          variant?.price?.currencyCode ||
            currency
        )}
Item Total: ${formatPrice(
          lineTotal,
          variant?.price?.currencyCode ||
            currency
        )}
`;
      })
      .filter(Boolean)
      .join("\n");

    const message = `
Hi Sapna Munoth Label,

I would like to place an order.

ORDER DETAILS
------------------------

${itemsText}

------------------------
Total: ${formatPrice(
      subtotal,
      currency
    )}

Please confirm availability, shipping charges and the final order details.

Thank you!
`;

    const whatsappUrl =
      `https://wa.me/${WHATSAPP_NUMBER}` +
      `?text=${encodeURIComponent(message)}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /* -----------------------------------------------------------
     Loading
  ----------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen pt-40 text-center">
        <Loader2
          className="animate-spin mx-auto mb-4"
          size={28}
        />

        <p className="text-gray-500">
          Loading your bag...
        </p>
      </div>
    );
  }

  /* -----------------------------------------------------------
     Empty Cart
  ----------------------------------------------------------- */

  if (
    !cart ||
    cartLines.length === 0
  ) {
    return (
      <div className="min-h-screen bg-white pt-40 text-center px-4">
        <ShoppingBag
          size={42}
          className="mx-auto mb-6 text-gray-300"
        />

        <h2 className="text-2xl font-semibold mb-3">
          Your Bag is Empty
        </h2>

        <p className="text-gray-500 mb-6">
          Looks like you haven't added anything yet.
        </p>

        <Link
          to="/shop/all"
          className="inline-block border border-black px-8 py-3 text-sm uppercase tracking-widest hover:bg-black hover:text-white transition"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  /* -----------------------------------------------------------
     Cart Totals
  ----------------------------------------------------------- */

  const subtotal =
    cart.cost?.subtotalAmount?.amount || 0;

  const currency =
    cart.cost?.subtotalAmount
      ?.currencyCode || "INR";

  /* -----------------------------------------------------------
     Render
  ----------------------------------------------------------- */

  return (
    <div className="bg-white pt-32 pb-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 lg:grid lg:grid-cols-12 lg:gap-12">

        {/* =====================================================
            LEFT — CART ITEMS
        ===================================================== */}

        <div className="lg:col-span-8">

          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold">
              Shopping Bag
            </h1>

            <span className="text-sm text-gray-500">
              {cart.totalQuantity}{" "}
              {cart.totalQuantity === 1
                ? "item"
                : "items"}
            </span>
          </div>

          {/* Error */}

          {error && (
            <div className="mb-6 border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Items */}

          <div>
            {cartLines.map((line) => {
              const variant =
                line.merchandise;

              const product =
                variant?.product;

              if (!product) {
                return null;
              }

              const sizeOption =
                variant.selectedOptions?.find(
                  (option) =>
                    option.name
                      ?.toLowerCase() ===
                    "size"
                );

              const size =
                sizeOption?.value ||
                null;

              const image =
                variant.image?.url;

              const price =
                Number(
                  variant.price?.amount || 0
                );

              const lineTotal =
                price * line.quantity;

              const isUpdating =
                actionLoading === line.id;

              return (
                <div
                  key={line.id}
                  className="flex gap-5 py-6 border-b border-gray-200"
                >

                  {/* IMAGE */}

                  <Link
                    to={`/product/${product.handle}`}
                    className="flex-shrink-0"
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={
                          variant.image
                            ?.altText ||
                          product.title
                        }
                        className="w-24 h-32 object-cover"
                      />
                    ) : (
                      <div className="w-24 h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                        No image
                      </div>
                    )}
                  </Link>

                  {/* DETAILS */}

                  <div className="flex-1">

                    <div className="flex justify-between gap-4">

                      <div>

                        <Link
                          to={`/product/${product.handle}`}
                          className="text-lg font-medium hover:underline"
                        >
                          {product.title}
                        </Link>

                        {variant.title &&
                          variant.title !==
                            "Default Title" && (
                            <p className="text-sm text-gray-500 mt-1">
                              {variant.title}
                            </p>
                          )}

                        {size && (
                          <p className="text-sm text-gray-500">
                            Size: {size}
                          </p>
                        )}

                      </div>

                      <p className="text-sm font-medium whitespace-nowrap">
                        {formatPrice(
                          lineTotal,
                          variant
                            .price
                            ?.currencyCode ||
                            currency
                        )}
                      </p>

                    </div>

                    {/* QUANTITY + REMOVE */}

                    <div className="flex items-center justify-between mt-6">

                      <div className="flex items-center border border-gray-200">

                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateQuantity(
                              line,
                              -1
                            )
                          }
                          className="p-3 hover:bg-gray-50 disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>

                        <span className="w-10 text-center text-sm">

                          {isUpdating ? (
                            <Loader2
                              size={14}
                              className="animate-spin mx-auto"
                            />
                          ) : (
                            line.quantity
                          )}

                        </span>

                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateQuantity(
                              line,
                              1
                            )
                          }
                          className="p-3 hover:bg-gray-50 disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>

                      </div>

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() =>
                          removeItem(line)
                        }
                        className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-2 disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>

                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =====================================================
            RIGHT — ORDER SUMMARY
        ===================================================== */}

        <div className="lg:col-span-4 mt-10 lg:mt-0">

          <div className="bg-gray-50 p-6 sticky top-32">

            <h2 className="text-xl font-semibold mb-6">
              Order Summary
            </h2>

            {/* SUBTOTAL */}

            <div className="flex justify-between text-sm mb-3">

              <span className="text-gray-600">
                Subtotal
              </span>

              <span>
                {formatPrice(
                  subtotal,
                  currency
                )}
              </span>

            </div>

            {/* SHIPPING */}

            <div className="flex justify-between text-sm pb-5 border-b">

              <span className="text-gray-600">
                Shipping
              </span>

              <span className="text-gray-500 text-right">
                Confirmed on WhatsApp
              </span>

            </div>

            {/* TOTAL */}

            <div className="flex justify-between text-lg font-semibold mt-5">

              <span>
                Total
              </span>

              <span>
                {formatPrice(
                  subtotal,
                  currency
                )}
              </span>

            </div>

            {/* =================================================
                WHATSAPP ORDER BUTTON
            ================================================= */}

            <button
              type="button"
              onClick={handleWhatsAppOrder}
              className="w-full mt-6 bg-black text-white py-4 uppercase tracking-widest text-xs font-semibold hover:bg-gray-800 transition flex items-center justify-center gap-3"
            >
              <MessageCircle size={18} />

              Order on WhatsApp
            </button>

            <p className="text-xs text-gray-500 text-center mt-3 leading-relaxed">
              We'll confirm availability, shipping
              charges and your order details on WhatsApp.
            </p>

            {/* CONTINUE SHOPPING */}

            <Link
              to="/shop/all"
              className="block text-center mt-5 text-sm underline underline-offset-4"
            >
              Continue Shopping
            </Link>

          </div>
        </div>

      </div>
    </div>
  );
};

export default CartPage;