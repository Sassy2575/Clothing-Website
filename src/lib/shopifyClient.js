const SHOPIFY_STORE_DOMAIN =
  import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;

const SHOPIFY_STOREFRONT_TOKEN =
  import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

const SHOPIFY_API_VERSION =
  import.meta.env.VITE_SHOPIFY_API_VERSION || "2026-07";

const SHOPIFY_API_URL =
  `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;


async function shopifyRequest(query, variables = {}) {
  if (!SHOPIFY_STORE_DOMAIN) {
    throw new Error("Missing VITE_SHOPIFY_STORE_DOMAIN");
  }

  if (!SHOPIFY_STOREFRONT_TOKEN) {
    throw new Error("Missing VITE_SHOPIFY_STOREFRONT_TOKEN");
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
      result?.errors?.[0]?.message ||
      `Shopify API request failed (${response.status})`
    );
  }

  if (result.errors?.length) {
    throw new Error(
      result.errors.map((error) => error.message).join(", ")
    );
  }

  return result.data;
}


export async function getShopifyProducts(first = 20) {
  const query = `
    query GetProducts($first: Int!) {
      products(
        first: $first
        sortKey: CREATED_AT
        reverse: true
      ) {
        nodes {
          id
          title
          handle
          description
          descriptionHtml
          productType
          vendor

          featuredImage {
            url
            altText
          }

          images(first: 10) {
            nodes {
              url
              altText
            }
          }

          variants(first: 20) {
            nodes {
              id
              title
              availableForSale

              price {
                amount
                currencyCode
              }

              compareAtPrice {
                amount
                currencyCode
              }

              selectedOptions {
                name
                value
              }

              image {
                id
                url
                altText
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyRequest(query, { first });

  return data.products.nodes;
}


export async function getShopifyProductByHandle(handle) {
  const query = `
    query GetProduct($handle: String!) {
      product(handle: $handle) {
        id
        title
        handle
        description
        descriptionHtml
        productType
        vendor

        category {
          id
          name
        }

        metafields(identifiers: [
          { namespace: "shopify", key: "age-group" },
          { namespace: "shopify", key: "back-design" },
          { namespace: "shopify", key: "bra-closure-type" },
          { namespace: "shopify", key: "bra-coverage" },
          { namespace: "shopify", key: "bra-features" },
          { namespace: "shopify", key: "bra-length-type" },
          { namespace: "shopify", key: "bra-padding-type" },
          { namespace: "shopify", key: "bra-strap-type" },
          { namespace: "shopify", key: "bra-style" },
          { namespace: "shopify", key: "bra-support-level" },
          { namespace: "shopify", key: "care-instructions" },
          { namespace: "shopify", key: "clothing-features" },
          { namespace: "shopify", key: "color-pattern" },
          { namespace: "shopify", key: "cup-size" },
          { namespace: "shopify", key: "dress-occasion" },
          { namespace: "shopify", key: "dress-style" },
          { namespace: "shopify", key: "fabric" },
          { namespace: "shopify", key: "fit" },
          { namespace: "shopify", key: "garment-back-style" },
          { namespace: "shopify", key: "hemline-style" },
          { namespace: "shopify", key: "hood-design" },
          { namespace: "shopify", key: "hood-type" },
          { namespace: "shopify", key: "integrated-bottom-type" },
          { namespace: "shopify", key: "jewelry-material" },
          { namespace: "shopify", key: "neckline" },
          { namespace: "shopify", key: "pattern" },
          { namespace: "shopify", key: "pant-cuff-style" },
          { namespace: "shopify", key: "pants-length-type" },
          { namespace: "shopify", key: "pocket-closure-type" },
          { namespace: "shopify", key: "pocket-type" },
          { namespace: "shopify", key: "size" },
          { namespace: "shopify", key: "size-type" },
          { namespace: "shopify", key: "skirt-dress-length-type" },
          { namespace: "shopify", key: "sleeve-length-type" },
          { namespace: "shopify", key: "target-gender" },
          { namespace: "shopify", key: "top-length-type" },
          { namespace: "shopify", key: "waist-rise" },
          { namespace: "shopify", key: "zipper-opening-length" },
          { namespace: "shopify", key: "zipper-style" }
        ]) {
          namespace
          key
          type
          list
          value
          reference {
            __typename
            ... on Metaobject {
              fields {
                key
                value
              }
            }
          }
          references(first: 50) {
            nodes {
              __typename
              ... on Metaobject {
                fields {
                  key
                  value
                }
              }
            }
          }
        }

        featuredImage {
          url
          altText
        }

        images(first: 20) {
          nodes {
            id
            url
            altText
          }
        }


        media(first: 50) {
          nodes {
            __typename

            ... on MediaImage {
              id
              image {
                url
                altText
              }
            }

            ... on Video {
              id
              previewImage {
                url
                altText
              }
              sources {
                url
                mimeType
                format
                width
                height
              }
            }
          }
        }

        variants(first: 50) {
          nodes {
            id
            title
            availableForSale

            price {
              amount
              currencyCode
            }

            compareAtPrice {
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
  `;

  const data = await shopifyRequest(query, { handle });

  return data.product;
}

export async function getShopifyCollections(first = 20) {
  const query = `
    query GetCollections($first: Int!) {
      collections(first: $first) {
        nodes {
          id
          title
          handle
          image {
            url
            altText
          }
        }
      }
    }
  `;

  const data = await shopifyRequest(query, { first });

  return data.collections.nodes;
}

/**
 * Get products from a Shopify collection by handle.
 */
export async function getShopifyCollectionProducts(handle, first = 100) {
  const query = `
    query GetCollectionProducts($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        id
        title
        handle

        products(first: $first) {
          nodes {
            id
            title
            handle
            description
            productType
            vendor

            featuredImage {
              url
              altText
            }

            images(first: 10) {
              nodes {
                url
                altText
              }
            }

            variants(first: 50) {
              nodes {
                id
                title
                availableForSale

                price {
                  amount
                  currencyCode
                }

                compareAtPrice {
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
  `;

  const data = await shopifyRequest(query, {
    handle,
    first,
  });

  if (!data.collection) {
    return {
      collection: null,
      products: [],
    };
  }

  return {
    collection: {
      id: data.collection.id,
      title: data.collection.title,
      handle: data.collection.handle,
    },
    products: data.collection.products.nodes,
  };
}