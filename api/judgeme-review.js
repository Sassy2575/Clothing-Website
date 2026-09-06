const JUDGEME_API_URL = "https://judge.me/api/v1/reviews";

const MAX_BODY_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

function normalizeProductId(productId) {
  if (!productId) return null;

  const value = String(productId).trim();

  const match = value.match(/\/Product\/(\d+)$/);

  if (match) {
    return match[1];
  }

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

export async function POST(request) {
  const privateToken = process.env.JUDGEME_PRIVATE_TOKEN;
  const shopDomain = process.env.JUDGEME_SHOP_DOMAIN;

  if (!privateToken || !shopDomain) {
    console.error("Judge.me server configuration is missing.");

    return Response.json(
      {
        error:
          "Review service is temporarily unavailable.",
      },
      { status: 500 }
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") || 0
  );

  if (contentLength > 15000) {
    return Response.json(
      {
        error: "Request is too large.",
      },
      { status: 413 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "Invalid request.",
      },
      { status: 400 }
    );
  }

  // Honeypot anti-bot field.
  if (body.website) {
    return Response.json(
      {
        error: "Invalid submission.",
      },
      { status: 400 }
    );
  }

  const productId = normalizeProductId(
    body.productId
  );

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
    return Response.json(
      {
        error: "Invalid product.",
      },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return Response.json(
      {
        error: "Rating must be between 1 and 5.",
      },
      { status: 400 }
    );
  }

  if (!title) {
    return Response.json(
      {
        error: "Please enter a review title.",
      },
      { status: 400 }
    );
  }

  if (!reviewBody) {
    return Response.json(
      {
        error: "Please enter your review.",
      },
      { status: 400 }
    );
  }

  if (!name) {
    return Response.json(
      {
        error: "Please enter your name.",
      },
      { status: 400 }
    );
  }

  if (!email || !isValidEmail(email)) {
    return Response.json(
      {
        error: "Please enter a valid email address.",
      },
      { status: 400 }
    );
  }

  try {
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

      return Response.json(
        {
          error:
            "We couldn't submit your review right now. Please try again.",
        },
        { status: 502 }
      );
    }

    return Response.json({
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

    return Response.json(
      {
        error:
          "We couldn't submit your review right now. Please try again.",
      },
      { status: 500 }
    );
  }
}