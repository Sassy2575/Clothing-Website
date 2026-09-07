// api/judgeme-review.js

const JUDGEME_API_BASE = "https://api.judge.me/api/v1";
const JUDGEME_REVIEWS_URL = `${JUDGEME_API_BASE}/reviews`;
const JUDGEME_PRODUCTS_URL = `${JUDGEME_API_BASE}/products/-1`;

function getConfig() {
  const shopDomain = process.env.JUDGEME_SHOP_DOMAIN;
  const privateToken = process.env.JUDGEME_PRIVATE_TOKEN;

  if (!shopDomain || !privateToken) {
    throw new Error(
      "Judge.me server configuration is missing."
    );
  }

  return {
    shopDomain,
    privateToken,
  };
}

function normalizeProductId(value) {
  if (!value) return "";

  return String(value)
    .trim()
    .split("/")
    .pop();
}

async function lookupProduct({
  shopDomain,
  privateToken,
  externalId,
  handle,
}) {
  const candidates = [];

  if (externalId) {
    candidates.push({
      external_id: externalId,
    });
  }

  if (handle) {
    candidates.push({
      handle,
    });
  }

  for (const candidate of candidates) {
    const params = new URLSearchParams({
      shop_domain: shopDomain,
      api_token: privateToken,
      ...candidate,
    });

    try {
      const response = await fetch(
        `${JUDGEME_PRODUCTS_URL}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        continue;
      }

      const judgeMeProductId =
        result?.product?.id ??
        result?.id ??
        result?.product?.product?.id ??
        null;

      if (judgeMeProductId) {
        return String(judgeMeProductId);
      }
    } catch (error) {
      console.error(
        "Judge.me product lookup failed:",
        error
      );
    }
  }

  return null;
}

async function getReviews(req, res) {
  try {
    const {
      shopDomain,
      privateToken,
    } = getConfig();

    const {
      external_id,
      handle,
      page = "1",
      per_page = "5",
    } = req.query || {};

    const normalizedExternalId =
      normalizeProductId(external_id);

    const normalizedPage =
      Math.max(Number(page) || 1, 1);

    const normalizedPerPage = Math.min(
      Math.max(Number(per_page) || 5, 1),
      100
    );

    /*
     * First try to find Judge.me's internal product ID.
     *
     * If Judge.me cannot find the product, return an empty
     * review list instead of returning a hard error.
     */
    const judgeMeProductId =
      await lookupProduct({
        shopDomain,
        privateToken,
        externalId: normalizedExternalId,
        handle,
      });

    if (!judgeMeProductId) {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );

      return res.status(200).json({
        reviews: [],
        total_reviews: 0,
        total_pages: 0,
        current_page: normalizedPage,
        per_page: normalizedPerPage,
      });
    }

    const params = new URLSearchParams({
      shop_domain: shopDomain,
      api_token: privateToken,
      product_id: judgeMeProductId,
      published: "true",
      page: String(normalizedPage),
      per_page: String(normalizedPerPage),
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

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Judge.me reviews GET failed:",
        response.status,
        result
      );

      return res.status(502).json({
        error:
          result?.error ||
          result?.message ||
          `Judge.me reviews request failed (${response.status}).`,
      });
    }

    const reviews =
      Array.isArray(result?.reviews)
        ? result.reviews
        : Array.isArray(result?.data?.reviews)
        ? result.data.reviews
        : [];

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    return res.status(200).json({
      reviews,
      total_reviews:
        Number(result?.total_reviews) ||
        Number(result?.total) ||
        reviews.length,
      total_pages:
        Number(result?.total_pages) ||
        0,
      current_page: normalizedPage,
      per_page: normalizedPerPage,
    });
  } catch (error) {
    console.error(
      "Judge.me reviews GET error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Unable to load customer reviews.",
    });
  }
}

async function createReview(req, res) {
  try {
    const {
      shopDomain,
      privateToken,
    } = getConfig();

    const body = req.body || {};

    const {
      productId,
      rating,
      title,
      body: reviewBody,
      name,
      email,
      anonymous,
      website,
    } = body;

    /*
     * Honeypot spam protection.
     */
    if (website) {
      return res.status(400).json({
        error: "Invalid submission.",
      });
    }

    if (!productId) {
      return res.status(400).json({
        error: "Product information is missing.",
      });
    }

    const numericRating = Number(rating);

    if (
      !Number.isFinite(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        error: "Please select a rating.",
      });
    }

    if (
      !title ||
      !String(title).trim()
    ) {
      return res.status(400).json({
        error: "Please enter a review title.",
      });
    }

    if (
      !reviewBody ||
      !String(reviewBody).trim()
    ) {
      return res.status(400).json({
        error: "Please enter your review.",
      });
    }

    if (
      !name ||
      !String(name).trim()
    ) {
      return res.status(400).json({
        error: "Please enter your name.",
      });
    }

    if (
      !email ||
      !String(email).trim()
    ) {
      return res.status(400).json({
        error: "Please enter your email.",
      });
    }

    /*
     * Judge.me API-created reviews use the Shopify external
     * product ID through the `id` field.
     */
    const payload = {
      shop_domain: shopDomain,
      platform: "shopify",
      id: productId,
      name: String(name).trim(),
      email: String(email).trim(),
      rating: numericRating,
      title: String(title).trim(),
      body: String(reviewBody).trim(),
    };

    /*
     * Keep the API submission simple.
     * Judge.me controls moderation/publishing.
     */
    const response = await fetch(
      JUDGEME_REVIEWS_URL,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Judge.me review submission failed:",
        response.status,
        result
      );

      return res.status(502).json({
        error:
          result?.error ||
          result?.message ||
          `Judge.me submission failed (${response.status}).`,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Thank you! Your review has been submitted.",
      review: result?.review || result,
    });
  } catch (error) {
    console.error(
      "Judge.me review POST error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Unable to submit your review.",
    });
  }
}

export default async function handler(req, res) {
  /*
   * CORS / response headers
   */
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return getReviews(req, res);
  }

  if (req.method === "POST") {
    return createReview(req, res);
  }

  return res.status(405).json({
    error: "Method not allowed.",
  });
}