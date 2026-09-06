const JUDGEME_API_URL = "https://judge.me/api/v1/reviews";

const MAX_BODY_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

function normalizeProductId(productId) {
  if (!productId) return null;

  const value = String(productId).trim();

  // Shopify GraphQL ID:
  // gid://shopify/Product/123456789
  const match = value.match(/\/Product\/(\d+)$/);

  if (match) {
    return match[1];
  }

  // Already a numeric Shopify product ID
  if (/^\d+$/.test(value)) {
    return value;
  }

  return null;
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\0/g, "")
    .slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  // Server-side Vercel environment variables.
  // NEVER expose the private Judge.me token to frontend/Vite code.
  const privateToken = process.env.JUDGEME_PRIVATE_TOKEN;
  const shopDomain = process.env.JUDGEME_SHOP_DOMAIN;

  if (!privateToken || !shopDomain) {
    console.error("Judge.me server configuration is missing.");

    return res.status(500).json({
      error: "Review service is temporarily unavailable.",
    });
  }

  const contentLength = Number(
    req.headers["content-length"] || 0
  );

  if (contentLength > 15000) {
    return res.status(413).json({
      error: "Request is too large.",
    });
  }

  const body = req.body || {};

  // Honeypot anti-bot field.
  if (body.website) {
    return res.status(400).json({
      error: "Invalid submission.",
    });
  }

  const productId = normalizeProductId(body.productId);
  const rating = Number(body.rating);

  const title = cleanString(
    body.title,
    MAX_TITLE_LENGTH
  );

  const reviewBody = cleanString(
    body.body,
    MAX_BODY_LENGTH
  );

  const name = cleanString(
    body.name,
    MAX_NAME_LENGTH
  );

  const email = cleanString(
    body.email,
    MAX_EMAIL_LENGTH
  );

  if (!productId) {
    return res.status(400).json({
      error: "Invalid product.",
    });
  }

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return res.status(400).json({
      error: "Rating must be between 1 and 5.",
    });
  }

  if (!title) {
    return res.status(400).json({
      error: "Please enter a review title.",
    });
  }

  if (!reviewBody) {
    return res.status(400).json({
      error: "Please enter your review.",
    });
  }

  if (!name) {
    return res.status(400).json({
      error: "Please enter your name.",
    });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      error: "Please enter a valid email address.",
    });
  }

  try {
    // Judge.me expects api_token and shop_domain
    // as query parameters, not inside the JSON body.
    const judgeMeUrl = new URL(JUDGEME_API_URL);

    judgeMeUrl.searchParams.set(
      "api_token",
      privateToken
    );

    judgeMeUrl.searchParams.set(
      "shop_domain",
      shopDomain
    );

    const judgeMeResponse = await fetch(
      judgeMeUrl.toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          platform: "shopify",
          id: productId,
          name,
          email,
          rating,
          title,
          body: reviewBody,
        }),
      }
    );

    const responseText =
      await judgeMeResponse.text();

    let result = null;

    try {
      result = responseText
        ? JSON.parse(responseText)
        : null;
    } catch {
      result = null;
    }

    if (!judgeMeResponse.ok) {
      console.error(
        "Judge.me review submission failed:",
        judgeMeResponse.status
      );

      return res.status(502).json({
        error:
          "We couldn't submit your review right now. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Thank you! Your review has been submitted for moderation.",
      review: result,
    });
  } catch (error) {
    console.error(
      "Judge.me request error:",
      error?.message || error
    );

    return res.status(500).json({
      error:
        "We couldn't submit your review right now. Please try again.",
    });
  }
}