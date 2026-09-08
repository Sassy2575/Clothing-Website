// api/judgeme-review.js

const JUDGEME_API_BASE = "https://api.judge.me/api/v1";
const JUDGEME_REVIEWS_URL = `${JUDGEME_API_BASE}/reviews`;
const JUDGEME_PRODUCTS_URL = `${JUDGEME_API_BASE}/products/-1`;

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

function normalizeProductId(value) {
  return String(value || "")
    .trim()
    .split("/")
    .pop();
}

async function lookupProduct({ shopDomain, privateToken, productId, handle }) {
  const headers = {
    Accept: "application/json",
  };

  const candidates = [];

  if (productId) {
    candidates.push(
      `${JUDGEME_PRODUCTS_URL}?shop_domain=${encodeURIComponent(
        shopDomain
      )}&api_token=${encodeURIComponent(
        privateToken
      )}&external_id=${encodeURIComponent(productId)}`
    );
  }

  if (handle) {
    candidates.push(
      `${JUDGEME_PRODUCTS_URL}?shop_domain=${encodeURIComponent(
        shopDomain
      )}&api_token=${encodeURIComponent(
        privateToken
      )}&handle=${encodeURIComponent(handle)}`
    );
  }

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      const product =
        data?.product ||
        (Array.isArray(data?.products) ? data.products[0] : null) ||
        (data?.id ? data : null);

      if (product?.id) {
        return product;
      }
    } catch {
      // Try the next lookup method.
    }
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const shopDomain = getEnv("JUDGEME_SHOP_DOMAIN");
  const privateToken = getEnv("JUDGEME_PRIVATE_TOKEN");

  if (!shopDomain || !privateToken) {
    return res.status(500).json({
      error:
        "Judge.me is not configured. Add JUDGEME_SHOP_DOMAIN and JUDGEME_PRIVATE_TOKEN to Vercel environment variables.",
    });
  }

  // ---------------------------------------------------------
  // GET REVIEWS
  // ---------------------------------------------------------
  if (req.method === "GET") {
    try {
      const {
        productId = "",
        handle = "",
        page = "1",
        perPage = "100",
      } = req.query || {};

      const normalizedProductId = normalizeProductId(productId);

      const judgeMeProduct = await lookupProduct({
        shopDomain,
        privateToken,
        productId: normalizedProductId,
        handle,
      });

      if (!judgeMeProduct?.id) {
        return res.status(200).json({
          reviews: [],
          total: 0,
          page: Number(page) || 1,
          per_page: Number(perPage) || 100,
        });
      }

      const params = new URLSearchParams({
        shop_domain: shopDomain,
        api_token: privateToken,
        product_id: String(judgeMeProduct.id),
        published: "true",
        page: String(page),
        per_page: String(perPage),
      });

      const response = await fetch(
        `${JUDGEME_REVIEWS_URL}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error:
            data?.error ||
            data?.message ||
            "Unable to load Judge.me reviews.",
        });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error("ERROR LOADING JUDGE.ME REVIEWS:", error);

      return res.status(500).json({
        error: error?.message || "Unable to load customer reviews.",
      });
    }
  }

  // ---------------------------------------------------------
  // POST REVIEW
  // ---------------------------------------------------------
  if (req.method === "POST") {
    try {
      const {
        productId,
        rating,
        title,
        body: reviewBody,
        name,
        email,
        anonymous,
        website,
      } = req.body || {};

      // Honeypot spam protection
      if (String(website || "").trim()) {
        return res.status(400).json({
          error: "Unable to submit review.",
        });
      }

      const numericProductId = normalizeProductId(productId);

      // Shopify sends:
      // gid://shopify/Product/123456789
      //
      // Judge.me expects:
      // 123456789
      if (!/^\d+$/.test(numericProductId)) {
        return res.status(400).json({
          error: "Product ID must be numeric.",
        });
      }

      const numericRating = Number(rating);

      if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({
          error: "Rating must be between 1 and 5.",
        });
      }

      if (!String(name || "").trim()) {
        return res.status(400).json({
          error: "Please enter your name.",
        });
      }

      if (!String(email || "").trim()) {
        return res.status(400).json({
          error: "Please enter your email.",
        });
      }

      if (!String(reviewBody || "").trim()) {
        return res.status(400).json({
          error: "Please write your review.",
        });
      }

      const payload = {
        shop_domain: shopDomain,
        platform: "shopify",

        // IMPORTANT:
        // Judge.me expects the Shopify product's numeric
        // external ID here, NOT the Shopify GID.
        id: numericProductId,

        name: String(name).trim(),
        email: String(email).trim(),
        rating: numericRating,
        title: String(title || "").trim(),
        body: String(reviewBody).trim(),
      };

      const response = await fetch(JUDGEME_REVIEWS_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("JUDGE.ME REVIEW SUBMISSION ERROR:", {
          status: response.status,
          data,
        });

        return res.status(response.status).json({
          error:
            data?.error ||
            data?.message ||
            "Unable to submit review to Judge.me.",
        });
      }

      return res.status(200).json({
        success: true,
        review: data,
      });
    } catch (error) {
      console.error("ERROR SUBMITTING JUDGE.ME REVIEW:", error);

      return res.status(500).json({
        error: error?.message || "Unable to submit review.",
      });
    }
  }

  return res.status(405).json({
    error: "Method not allowed.",
  });
}