const CLIENT_ID = import.meta.env.VITE_SHOPIFY_CUSTOMER_CLIENT_ID;
const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;
const REDIRECT_URI = import.meta.env.VITE_SHOPIFY_REDIRECT_URI;


const DISCOVERY_URL =
  `https://${STORE_DOMAIN}/.well-known/openid-configuration`;

const CUSTOMER_API_DISCOVERY_URL =
  `https://${STORE_DOMAIN}/.well-known/customer-account-api`;

const TOKEN_STORAGE_KEY = "shopify_customer_tokens";
const PKCE_VERIFIER_KEY = "shopify_pkce_verifier";
const AUTH_STATE_KEY = "shopify_auth_state";


function base64UrlEncode(buffer) {
  return btoa(
    String.fromCharCode(...new Uint8Array(buffer))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


function randomString(length = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const values = new Uint8Array(length);
  crypto.getRandomValues(values);

  return Array.from(
    values,
    (value) => chars[value % chars.length]
  ).join("");
}


async function createCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return base64UrlEncode(digest);
}


function validateConfiguration() {
  if (!CLIENT_ID) {
    throw new Error(
      "Missing VITE_SHOPIFY_CUSTOMER_CLIENT_ID."
    );
  }

  if (!STORE_DOMAIN) {
    throw new Error(
      "Missing VITE_SHOPIFY_STORE_DOMAIN."
    );
  }

  if (!REDIRECT_URI) {
    throw new Error(
      "Missing VITE_SHOPIFY_REDIRECT_URI."
    );
  }
}


async function getDiscovery() {
  validateConfiguration();

  const response = await fetch(
    DISCOVERY_URL,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load Shopify OpenID configuration (${response.status}).`
    );
  }

  return response.json();
}


export async function loginWithShopify() {
  validateConfiguration();

  const discovery = await getDiscovery();

  if (!discovery.authorization_endpoint) {
    throw new Error(
      "Shopify discovery did not return an authorization endpoint."
    );
  }

  const verifier = randomString(64);

  const challenge =
    await createCodeChallenge(verifier);

  const state = randomString(32);

  sessionStorage.setItem(
    PKCE_VERIFIER_KEY,
    verifier
  );

  sessionStorage.setItem(
    AUTH_STATE_KEY,
    state
  );

  const authorizationUrl =
    new URL(
      discovery.authorization_endpoint
    );

  authorizationUrl.searchParams.set(
    "scope",
    "openid email customer-account-api:full"
  );

  authorizationUrl.searchParams.set(
    "client_id",
    CLIENT_ID
  );

  authorizationUrl.searchParams.set(
    "response_type",
    "code"
  );

  authorizationUrl.searchParams.set(
    "redirect_uri",
    REDIRECT_URI
  );

  authorizationUrl.searchParams.set(
    "state",
    state
  );

  authorizationUrl.searchParams.set(
    "code_challenge",
    challenge
  );

  authorizationUrl.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  window.location.assign(
    authorizationUrl.toString()
  );
}


export async function handleShopifyCallback() {
  validateConfiguration();

  const params =
    new URLSearchParams(
      window.location.search
    );

  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    throw new Error(
      params.get("error_description") ||
      `Shopify OAuth error: ${error}`
    );
  }

  if (!code) {
    throw new Error(
      "No Shopify authorization code returned."
    );
  }

  const savedState =
    sessionStorage.getItem(
      AUTH_STATE_KEY
    );

  if (
    !savedState ||
    savedState !== state
  ) {
    throw new Error(
      "Shopify authentication state mismatch."
    );
  }

  const verifier =
    sessionStorage.getItem(
      PKCE_VERIFIER_KEY
    );

  if (!verifier) {
    throw new Error(
      "Missing Shopify PKCE verifier."
    );
  }

  const discovery =
    await getDiscovery();

  if (!discovery.token_endpoint) {
    throw new Error(
      "Shopify discovery did not return a token endpoint."
    );
  }

  const response =
    await fetch(
      discovery.token_endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",

          Accept:
            "application/json",
        },

        body:
          new URLSearchParams({
            grant_type:
              "authorization_code",

            client_id:
              CLIENT_ID,

            redirect_uri:
              REDIRECT_URI,

            code,

            code_verifier:
              verifier,
          }),
      }
    );

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error_description ||
      result?.error ||
      `Shopify token exchange failed (${response.status}).`
    );
  }

  localStorage.setItem(
    TOKEN_STORAGE_KEY,
    JSON.stringify({
      ...result,
      obtained_at: Date.now(),
    })
  );

  sessionStorage.removeItem(
    PKCE_VERIFIER_KEY
  );

  sessionStorage.removeItem(
    AUTH_STATE_KEY
  );

  return result;
}


export function getShopifyTokens() {
  const stored =
    localStorage.getItem(
      TOKEN_STORAGE_KEY
    );

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(
      TOKEN_STORAGE_KEY
    );

    return null;
  }
}


export function getShopifyAccessToken() {
  return getShopifyTokens()
    ?.access_token || null;
}


export function clearShopifySession() {
  localStorage.removeItem(
    TOKEN_STORAGE_KEY
  );
}


export async function logoutFromShopify() {
  const tokens =
    getShopifyTokens();

  clearShopifySession();

  const discovery =
    await getDiscovery();

  if (!discovery.end_session_endpoint) {
    window.location.assign(
      window.location.origin
    );

    return;
  }

  const params =
    new URLSearchParams();

  if (tokens?.id_token) {
    params.set(
      "id_token_hint",
      tokens.id_token
    );
  }

  params.set(
    "post_logout_redirect_uri",
    window.location.origin
  );

  window.location.assign(
    `${discovery.end_session_endpoint}?${params.toString()}`
  );
}


export async function shopifyCustomerRequest(
  query,
  variables = {}
) {
  const token =
    getShopifyAccessToken();

  if (!token) {
    throw new Error(
      "You are not signed in to Shopify."
    );
  }

  const response =
    await fetch(
      CUSTOMER_API_DISCOVERY_URL,
      {
        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `Unable to find Shopify Customer Account API (${response.status}).`
    );
  }

  const apiConfig =
    await response.json();

  if (!apiConfig.graphql_api) {
    throw new Error(
      "Shopify Customer Account API did not return graphql_api."
    );
  }

  const graphqlResponse =
    await fetch(
      apiConfig.graphql_api,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body: JSON.stringify({
          query,
          variables,
        }),
      }
    );

  const result =
    await graphqlResponse.json();

  if (
    !graphqlResponse.ok ||
    result.errors?.length
  ) {
    throw new Error(
      result?.errors
        ?.map(
          (error) =>
            error.message
        )
        .join(", ") ||
      `Customer Account API request failed (${graphqlResponse.status}).`
    );
  }

  return result.data;
}


export async function getShopifyCustomer() {
  const query = `
    query {
      customer {
        id
        displayName
        firstName
        lastName
        emailAddress {
          emailAddress
        }
      }
    }
  `;

  const data =
    await shopifyCustomerRequest(
      query
    );

  return data.customer;
}