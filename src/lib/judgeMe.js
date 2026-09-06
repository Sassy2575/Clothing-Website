const JUDGEME_PUBLIC_TOKEN =
  import.meta.env.VITE_JUDGEME_PUBLIC_TOKEN;

const SHOP_DOMAIN =
  import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;

const JUDGEME_API_URL =
  "https://judge.me/api/v1/widgets/product_review";

export async function getJudgeMeReviews({
  productHandle,
  productId,
  page = 1,
  perPage = 5,
} = {}) {
  if (!JUDGEME_PUBLIC_TOKEN) {
    throw new Error(
      "Missing VITE_JUDGEME_PUBLIC_TOKEN"
    );
  }

  if (!SHOP_DOMAIN) {
    throw new Error(
      "Missing VITE_SHOPIFY_STORE_DOMAIN"
    );
  }

  if (!productHandle && !productId) {
    throw new Error(
      "Missing product handle or product ID"
    );
  }

  const params = new URLSearchParams({
    api_token: JUDGEME_PUBLIC_TOKEN,
    shop_domain: SHOP_DOMAIN,
    page: String(page),
    per_page: String(perPage),
    json_request: "true",
  });

  if (productHandle) {
    params.set("handle", productHandle);
  }

  if (productId) {
    params.set("external_id", String(productId));
  }

  const response = await fetch(
    `${JUDGEME_API_URL}?${params.toString()}`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error ||
        `Judge.me request failed (${response.status})`
    );
  }

  return result;
}