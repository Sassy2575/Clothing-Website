// api/judgeme-review.js

const JUDGEME_API_BASE = "https://api.judge.me/api/v1";
const JUDGEME_REVIEWS_URL = `${JUDGEME_API_BASE}/reviews`;

const getEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
};

const normalizeProductId = (value) => {
  if (!value) return "";

  const stringValue = String(value).trim();

  const gidMatch = stringValue.match(/\/Product\/(\d+)$/i);

  if (gidMatch) {
    return gidMatch[1];
  }

  return stringValue;
};

const getJson = async (response) => {
  return response.json().catch(() => ({}));
};

/**
 * Look up a product inside Judge.me.
 *
 * Judge.me accepts either:
 * - external_id = Shopify product ID
 * - handle = Shopify product handle
 */
const lookupProduct = async ({
  shopDomain,
  privateToken,
  lookupType,
  lookupValue,
}) => {
  const params = new URLSearchParams({
    shop_domain: shopDomain,
    api_token: privateToken,
    [lookupType]: lookupValue,
  });

  const response = await fetch(
    `${JUDGEME_API_BASE}/products/-1?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  const result = await getJson(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      result,
      productId: null,
    };
  }

  const product =
    result?.product ||
    result?.data?.product ||
    result?.data ||
    result;

  const productId =
    product?.id ??
    result?.product?.id ??
    result?.id ??
    result?.product?.product?.id ??
    null;

  return {
    ok: true,
    status: response.status,
    result,
    productId,
  };
};

export default async function handler(req, res) {
  /*
   * ============================================================
   * GET
   * ============================================================
   *
   * Loads published Judge.me reviews for a Shopify product.
   *
   * Frontend calls:
   *
   * /api/judgeme-review
   *   ?external_id=123456789
   *   &handle=product-handle
   *   &page=1
   *   &per_page=5
   */
  if (req.method === "GET") {
    try {
      const privateToken = getEnv("JUDGEME_PRIVATE_TOKEN");
      const shopDomain = getEnv("JUDGEME_SHOP_DOMAIN");

      const {
        external_id,
        handle,
        page = "1",
        per_page = "5",
      } = req.query || {};

      const externalId = normalizeProductId(external_id);
      const productHandle = String(handle || "").trim();

      const currentPage = Math.max(
        1,
        Number.parseInt(page, 10) || 1
      );

      const perPage = Math.min(
        100,
        Math.max(
          1,
          Number.parseInt(per_page, 10) || 5
        )
      );

      if (!externalId && !productHandle) {
        return res.status(400).json({
          error:
            "A Shopify product ID or product handle is required.",
        });
      }

      /*
       * --------------------------------------------------------
       * STEP 1:
       * Try Shopify external product ID first.
       * --------------------------------------------------------
       */

      let judgeMeProductId = null;

      if (externalId) {
        const lookupByExternalId = await lookupProduct({
          shopDomain,
          privateToken,
          lookupType: "external_id",
          lookupValue: externalId,
        });

        judgeMeProductId =
          lookupByExternalId.productId || null;
      }

      /*
       * --------------------------------------------------------
       * STEP 2:
       * If external_id didn't work, try the product handle.
       * --------------------------------------------------------
       */

      if (!judgeMeProductId && productHandle) {
        const lookupByHandle = await lookupProduct({
          shopDomain,
          privateToken,
          lookupType: "handle",
          lookupValue: productHandle,
        });

        judgeMeProductId =
          lookupByHandle.productId || null;
      }

      /*
       * --------------------------------------------------------
       * STEP 3:
       * If Judge.me cannot find the product, return an empty
       * review list instead of showing an API error to customers.
       * --------------------------------------------------------
       */

      if (!judgeMeProductId) {
        return res.status(200).json(
          {
            reviews: [],
            total_reviews: 0,
            total_pages: 0,
            current_page: currentPage,
            per_page: perPage,
          },
          {
            headers: {
              "Cache-Control":
                "no-store, max-age=0",
            },
          }
        );
      }

      /*
       * --------------------------------------------------------
       * STEP 4:
       * Now fetch the actual published reviews using the
       * INTERNAL Judge.me product ID.
       * --------------------------------------------------------
       */

      const reviewParams = new URLSearchParams({
        shop_domain: shopDomain,
        api_token: privateToken,
        product_id: String(judgeMeProductId),
        published: "true",
        page: String(currentPage),
        per_page: String(perPage),
      });

      const reviewsResponse = await fetch(
        `${JUDGEME_REVIEWS_URL}?${reviewParams.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const reviewsResult =
        await getJson(reviewsResponse);

      if (!reviewsResponse.ok) {
        throw new Error(
          reviewsResult?.error ||
            reviewsResult?.message ||
            `Judge.me reviews request failed (${reviewsResponse.status}).`
        );
      }

      /*
       * Judge.me may return reviews directly under `reviews`
       * or inside `data.reviews`.
       */
      const reviews =
        Array.isArray(reviewsResult?.reviews)
          ? reviewsResult.reviews
          : Array.isArray(
                reviewsResult?.data?.reviews
              )
            ? reviewsResult.data.reviews
            : [];

      const totalReviews =
        Number(
          reviewsResult?.total_reviews ??
            reviewsResult?.total ??
            reviewsResult?.data?.total_reviews ??
            0
        ) || 0;

      const totalPages =
        Number(
          reviewsResult?.total_pages ??
            reviewsResult?.data?.total_pages ??
            (totalReviews > 0
              ? Math.ceil(totalReviews / perPage)
              : 0)
        ) || 0;

      return res.status(200).json(
        {
          reviews,
          total_reviews: totalReviews,
          total_pages: totalPages,
          current_page: currentPage,
          per_page: perPage,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    } catch (error) {
      console.error(
        "ERROR LOADING JUDGE.ME REVIEWS:",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Unable to load customer reviews.",
      });
    }
  }

  /*
   * ============================================================
   * POST
   * ============================================================
   *
   * Creates a new Judge.me review.
   *
   * This is the existing submission flow.
   */
  if (req.method === "POST") {
    try {
      const privateToken = getEnv(
        "JUDGEME_PRIVATE_TOKEN"
      );

      const shopDomain = getEnv(
        "JUDGEME_SHOP_DOMAIN"
      );

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

      /*
       * Honeypot spam protection.
       */
      if (website) {
        return res.status(200).json({
          success: true,
          message: "Thanks for the feedback.",
        });
      }

      /*
       * Basic validation.
       */
      if (!productId) {
        return res.status(400).json({
          error: "Product is required.",
        });
      }

      const numericRating = Number(rating);

      if (
        !Number.isFinite(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({
          error:
            "Please select a rating between 1 and 5.",
        });
      }

      if (!String(title || "").trim()) {
        return res.status(400).json({
          error: "Please enter a review title.",
        });
      }

      if (!String(reviewBody || "").trim()) {
        return res.status(400).json({
          error: "Please enter your review.",
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

      /*
       * Convert Shopify GID to numeric Shopify product ID.
       *
       * Example:
       * gid://shopify/Product/123456789
       *
       * becomes:
       * 123456789
       */
      const normalizedProductId =
        normalizeProductId(productId);

      /*
       * Judge.me review creation payload.
       */
      const reviewPayload = {
        shop_domain: shopDomain,
        api_token: privateToken,
        platform: "shopify",
        id: normalizedProductId,
        name: String(name).trim(),
        email: String(email).trim(),
        rating: numericRating,
        title: String(title).trim(),
        body: String(reviewBody).trim(),
      };

      const judgeMeResponse = await fetch(
        JUDGEME_REVIEWS_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(
            reviewPayload
          ),
        }
      );

      const judgeMeResult =
        await getJson(judgeMeResponse);

      if (!judgeMeResponse.ok) {
        throw new Error(
          judgeMeResult?.error ||
            judgeMeResult?.message ||
            `Judge.me review submission failed (${judgeMeResponse.status}).`
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Thanks for the feedback.",
        review: judgeMeResult?.review || null,
      });
    } catch (error) {
      console.error(
        "ERROR SUBMITTING JUDGE.ME REVIEW:",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Unable to submit your review.",
      });
    }
  }

  /*
   * ============================================================
   * METHOD NOT ALLOWED
   * ============================================================
   */

  res.setHeader("Allow", ["GET", "POST"]);

  return res.status(405).json({
    error: "Method not allowed.",
  });
}