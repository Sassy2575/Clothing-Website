const JUDGEME_API_BASE = "https://api.judge.me/api/v1";
const JUDGEME_REVIEWS_URL = `${JUDGEME_API_BASE}/reviews`;

const MAX_BODY_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PER_PAGE = 100;

function normalizeProductId(productId) {
  if (!productId) return null;

  const value = String(productId).trim();

  const match = value.match(/\/Product\/(\d+)$/i);

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

function jsonError(message, status) {
  return Response.json(
    {
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/*
 * ============================================================
 * GET /api/judgeme-review
 * ============================================================
 *
 * Loads published reviews directly from Judge.me's private API.
 *
 * Query params:
 *
 *   external_id = Shopify product ID
 *   handle      = Shopify product handle
 *   page        = page number
 *   per_page    = reviews per page
 *
 * Example:
 *
 * /api/judgeme-review?external_id=123456789&page=1&per_page=5
 *
 * IMPORTANT:
 * The Judge.me private token NEVER reaches the browser.
 */

export async function GET(request) {
  const privateToken =
    process.env.JUDGEME_PRIVATE_TOKEN;

  const shopDomain =
    process.env.JUDGEME_SHOP_DOMAIN;

  if (!privateToken || !shopDomain) {
    console.error(
      "Judge.me server configuration is missing."
    );

    return jsonError(
      "Review service is temporarily unavailable.",
      500
    );
  }

  const url = new URL(request.url);

  /*
   * Shopify product ID.
   *
   * Supports:
   *   123456789
   *
   * or:
   *   gid://shopify/Product/123456789
   */

  const externalId = normalizeProductId(
    url.searchParams.get("external_id")
  );

  /*
   * Shopify product handle.
   *
   * Example:
   *   inayat-rust-kurta-set
   */

  const handle = cleanString(
    url.searchParams.get("handle"),
    200
  );

  /*
   * Pagination.
   */

  const requestedPage = Number(
    url.searchParams.get("page") || 1
  );

  const requestedPerPage = Number(
    url.searchParams.get("per_page") || 5
  );

  const page =
    Number.isInteger(requestedPage) &&
    requestedPage > 0
      ? requestedPage
      : 1;

  const perPage =
    Number.isInteger(requestedPerPage) &&
    requestedPerPage > 0
      ? Math.min(
          requestedPerPage,
          MAX_PER_PAGE
        )
      : 5;

  if (!externalId && !handle) {
    return jsonError(
      "Product external_id or handle is required.",
      400
    );
  }

  try {
    /*
     * ========================================================
     * STEP 1
     * ========================================================
     *
     * Convert Shopify's product ID/handle into
     * Judge.me's INTERNAL product ID.
     *
     * Judge.me's Reviews API requires its internal
     * product_id.
     */

    const productUrl = new URL(
      `${JUDGEME_API_BASE}/products/-1`
    );

    productUrl.searchParams.set(
      "api_token",
      privateToken
    );

    productUrl.searchParams.set(
      "shop_domain",
      shopDomain
    );

    if (externalId) {
      productUrl.searchParams.set(
        "external_id",
        externalId
      );
    } else {
      productUrl.searchParams.set(
        "handle",
        handle
      );
    }

    const productResponse = await fetch(
      productUrl.toString(),
      {
        headers: {
          Accept: "application/json",
        },

        /*
         * Don't allow cached Judge.me responses.
         */
        cache: "no-store",
      }
    );

    const productText =
      await productResponse.text();

    let productResult = null;

    try {
      productResult = productText
        ? JSON.parse(productText)
        : null;
    } catch {
      productResult = null;
    }

    if (!productResponse.ok) {
      console.error(
        "Judge.me product lookup failed:",
        productResponse.status,
        productText.slice(0, 500)
      );

      return jsonError(
        "Unable to find this product in Judge.me.",
        502
      );
    }

    /*
     * Judge.me internal product ID.
     */

    const judgeMeProductId =
      productResult?.product?.id;

    /*
     * If the product doesn't exist in Judge.me,
     * return an empty review list.
     */

    if (!judgeMeProductId) {
      return Response.json(
        {
          reviews: [],
          total_reviews: 0,
          total_pages: 0,
          current_page: page,
          per_page: perPage,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    /*
     * ========================================================
     * STEP 2
     * ========================================================
     *
     * Fetch ONLY published reviews.
     */

    const reviewsUrl = new URL(
      JUDGEME_REVIEWS_URL
    );

    reviewsUrl.searchParams.set(
      "api_token",
      privateToken
    );

    reviewsUrl.searchParams.set(
      "shop_domain",
      shopDomain
    );

    reviewsUrl.searchParams.set(
      "product_id",
      String(judgeMeProductId)
    );

    /*
     * Only published reviews should appear
     * on the public website.
     */

    reviewsUrl.searchParams.set(
      "published",
      "true"
    );

    reviewsUrl.searchParams.set(
      "page",
      String(page)
    );

    reviewsUrl.searchParams.set(
      "per_page",
      String(perPage)
    );

    const reviewsResponse = await fetch(
      reviewsUrl.toString(),
      {
        headers: {
          Accept: "application/json",
        },

        /*
         * Prevent the Vercel/server request from
         * serving a stale cached review list.
         */

        cache: "no-store",
      }
    );

    const reviewsText =
      await reviewsResponse.text();

    let reviewsResult = null;

    try {
      reviewsResult = reviewsText
        ? JSON.parse(reviewsText)
        : null;
    } catch {
      reviewsResult = null;
    }

    if (!reviewsResponse.ok) {
      console.error(
        "Judge.me reviews request failed:",
        reviewsResponse.status,
        reviewsText.slice(0, 500)
      );

      return jsonError(
        "Unable to load customer reviews.",
        502
      );
    }

    /*
     * Make sure we always return an array.
     */

    const reviews = Array.isArray(
      reviewsResult?.reviews
    )
      ? reviewsResult.reviews
      : [];

    /*
     * Judge.me may return total_reviews /
     * total_pages depending on the response.
     */

    const totalReviews = Number(
      reviewsResult?.total_reviews || 0
    );

    const totalPages =
      Number(
        reviewsResult?.total_pages
      ) ||
      (totalReviews > 0
        ? Math.ceil(
            totalReviews / perPage
          )
        : reviews.length > 0
          ? page
          : 0);

    /*
     * Return a clean response to ProductPage.jsx.
     *
     * The private Judge.me token is NOT included.
     */

    return Response.json(
      {
        reviews,

        total_reviews:
          totalReviews,

        total_pages:
          totalPages,

        current_page:
          page,

        per_page:
          perPage,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Judge.me reviews request error:",
      error?.message || error
    );

    return jsonError(
      "Unable to load customer reviews.",
      500
    );
  }
}


/*
 * ============================================================
 * POST /api/judgeme-review
 * ============================================================
 *
 * Submits a customer review to Judge.me.
 *
 * The private token stays on the Vercel server.
 */

export async function POST(request) {
  const privateToken =
    process.env.JUDGEME_PRIVATE_TOKEN;

  const shopDomain =
    process.env.JUDGEME_SHOP_DOMAIN;

  if (!privateToken || !shopDomain) {
    console.error(
      "Judge.me server configuration is missing."
    );

    return jsonError(
      "Review service is temporarily unavailable.",
      500
    );
  }

  /*
   * Basic request-size protection.
   */

  const contentLength = Number(
    request.headers.get(
      "content-length"
    ) || 0
  );

  if (contentLength > 15000) {
    return jsonError(
      "Request is too large.",
      413
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      "Invalid request.",
      400
    );
  }

  /*
   * ========================================================
   * Honeypot anti-bot field.
   * ========================================================
   *
   * Your ProductPage has a hidden "website" field.
   *
   * Normal users leave it empty.
   */

  if (body.website) {
    return jsonError(
      "Invalid submission.",
      400
    );
  }

  /*
   * Clean incoming values.
   */

  const productId =
    normalizeProductId(
      body.productId
    );

  const rating =
    Number(body.rating);

  const title =
    cleanString(
      body.title,
      MAX_TITLE_LENGTH
    );

  const reviewBody =
    cleanString(
      body.body,
      MAX_BODY_LENGTH
    );

  const name =
    cleanString(
      body.name,
      MAX_NAME_LENGTH
    );

  const email =
    cleanString(
      body.email,
      MAX_EMAIL_LENGTH
    );

  /*
   * ========================================================
   * Validation
   * ========================================================
   */

  if (!productId) {
    return jsonError(
      "Invalid product.",
      400
    );
  }

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return jsonError(
      "Rating must be between 1 and 5.",
      400
    );
  }

  if (!title) {
    return jsonError(
      "Please enter a review title.",
      400
    );
  }

  if (!reviewBody) {
    return jsonError(
      "Please enter your review.",
      400
    );
  }

  if (!name) {
    return jsonError(
      "Please enter your name.",
      400
    );
  }

  if (
    !email ||
    !isValidEmail(email)
  ) {
    return jsonError(
      "Please enter a valid email address.",
      400
    );
  }

  try {
    /*
     * ========================================================
     * Submit review to Judge.me
     * ========================================================
     */

    const judgeMeUrl = new URL(
      JUDGEME_REVIEWS_URL
    );

    judgeMeUrl.searchParams.set(
      "api_token",
      privateToken
    );

    judgeMeUrl.searchParams.set(
      "shop_domain",
      shopDomain
    );

    const judgeMeResponse =
      await fetch(
        judgeMeUrl.toString(),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            platform: "shopify",

            /*
             * Shopify product ID.
             */
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
        judgeMeResponse.status,
        responseText.slice(0, 500)
      );

      return jsonError(
        "We couldn't submit your review right now. Please try again.",
        502
      );
    }

    /*
     * Successful submission.
     */

    return Response.json(
      {
        success: true,

        message:
          "Thank you! Your review has been submitted for moderation.",

        review:
          result,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Judge.me request error:",
      error?.message || error
    );

    return jsonError(
      "We couldn't submit your review right now. Please try again.",
      500
    );
  }
}