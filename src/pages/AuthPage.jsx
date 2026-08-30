import React, {
  useEffect,
  useState,
} from "react";

import {
  Loader2,
  LogOut,
  User as UserIcon,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  getShopifyAccessToken,
  getShopifyCustomer,
  handleShopifyCallback,
  loginWithShopify,
  logoutFromShopify,
} from "../lib/shopifyAuth";


const AuthPage = () => {

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [customer, setCustomer] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [authLoading, setAuthLoading] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState("");


  useEffect(() => {

    let cancelled = false;

    const initialize =
      async () => {

        setLoading(true);
        setErrorMsg("");

        try {

          /*
           * Shopify OAuth callback
           */

          if (
            location.pathname ===
            "/auth/callback"
          ) {

            await handleShopifyCallback();

            window.history.replaceState(
              {},
              document.title,
              "/auth"
            );

            const customerData =
              await getShopifyCustomer();

            if (!cancelled) {

              setCustomer(
                customerData
              );

              navigate(
                "/auth",
                {
                  replace: true,
                }
              );
            }

            return;
          }


          /*
           * Existing Shopify session
           */

          const token =
            getShopifyAccessToken();

          if (token) {

            try {

              const customerData =
                await getShopifyCustomer();

              if (!cancelled) {

                setCustomer(
                  customerData
                );
              }

            } catch (error) {

              console.error(
                "Existing Shopify session is invalid:",
                error
              );

              localStorage.removeItem(
                "shopify_customer_tokens"
              );
            }
          }

        } catch (error) {

          console.error(
            "Shopify auth error:",
            error
          );

          if (!cancelled) {

            setErrorMsg(
              error.message ||
              "Authentication failed."
            );
          }

        } finally {

          if (!cancelled) {
            setLoading(false);
          }
        }
      };


    initialize();


    return () => {
      cancelled = true;
    };

  }, [
    location.pathname,
    navigate,
  ]);


  const handleLogin =
    async () => {

      try {

        setAuthLoading(true);
        setErrorMsg("");

        await loginWithShopify();

      } catch (error) {

        console.error(
          "Shopify login error:",
          error
        );

        setErrorMsg(
          error.message ||
          "Unable to start Shopify login."
        );

        setAuthLoading(false);
      }
    };


  const handleLogout =
    async () => {

      try {

        await logoutFromShopify();

      } catch (error) {

        console.error(
          "Shopify logout error:",
          error
        );

        setErrorMsg(
          error.message ||
          "Unable to log out."
        );
      }
    };


  /*
   * Loading
   */

  if (loading) {

    return (
      <div className="h-screen flex items-center justify-center">

        <Loader2
          className="animate-spin"
        />

      </div>
    );
  }


  /*
   * Logged in
   */

  if (customer) {

    const fullName =
      `${customer.firstName || ""} ${
        customer.lastName || ""
      }`.trim() ||
      "User";

    const email =
      customer.emailAddress
        ?.emailAddress || "";


    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">

          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">

            <UserIcon
              className="text-gray-400"
            />

          </div>


          <h2 className="text-xl font-semibold">

            {fullName}

          </h2>


          <p className="text-sm text-gray-500 mb-6">

            {email}

          </p>


          <div className="space-y-3">

            <Link
              to="/orders"
              className="block py-3 rounded-lg border hover:bg-gray-50"
            >
              Orders
            </Link>


            <Link
              to="/wishlist"
              className="block py-3 rounded-lg border hover:bg-gray-50"
            >
              Wishlist
            </Link>


            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-lg bg-black text-white hover:bg-gray-800 flex items-center justify-center gap-2"
            >

              Logout

              <LogOut
                size={16}
              />

            </button>

          </div>

        </div>

      </div>
    );
  }


  /*
   * Login
   */

  return (

    <div className="min-h-screen flex">

      {/* Image */}

      <div
        className="hidden lg:flex w-1/2 text-white items-center justify-center bg-cover bg-center"

        style={{
          backgroundImage:
            "url('https://cdn.shopify.com/s/files/1/0998/2466/4865/files/IMG_3729.jpg?v=1787931682')",
        }}
      >

        <h1 className="text-4xl font-bold">

          Sapna Munoth

        </h1>

      </div>


      {/* Login */}

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">

        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">

          <h2 className="text-2xl font-semibold text-center mb-6">

            Welcome Back

          </h2>


          {errorMsg && (

            <div className="bg-red-100 text-red-600 p-3 text-sm mb-4 rounded">

              {errorMsg}

            </div>

          )}


          <button
            onClick={handleLogin}
            disabled={authLoading}
            className="w-full py-3 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-60 flex items-center justify-center gap-2"
          >

            {authLoading ? (

              <>

                <Loader2
                  className="animate-spin"
                  size={18}
                />

                Connecting...

              </>

            ) : (

              "Continue with Shopify"

            )}

          </button>

        </div>

      </div>

    </div>
  );
};


export default AuthPage;