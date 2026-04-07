import React, { useState, useEffect } from 'react';
import { Minus, Plus, Trash2, ArrowRight, Lock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const CartPage = () => {
  const [cartItems, setCartItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [user, setUser] = useState(null);

  // 🔹 Fetch Cart
  useEffect(() => {
    const fetchCart = async () => {
      try {
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setLoading(false);
          return;
        }

        setUser(session.user);

        const { data, error } = await supabase
          .from('CartItem')
          .select(`
            id,
            quantity,
            size,
            product:Product (
              id,
              name,
              price,
              images:ProductImage (
                url,
                isMain
              )
            )
          `)
          .eq('userId', session.user.id);

        if (error) throw error;

        setCartItems(data || []);

      } catch (error) {
        console.error("Error loading cart:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, []);

  // 🔹 Calculate subtotal
  useEffect(() => {
    const total = cartItems.reduce((acc, item) => {
      if (!item.product) return acc;
      return acc + (item.product.price * item.quantity);
    }, 0);

    setSubtotal(total);
  }, [cartItems]);

  // 🔹 Update quantity
  const updateQuantity = async (id, qty, change) => {
    const newQty = qty + change;
    if (newQty < 1) return;

    setCartItems(items =>
      items.map(i => i.id === id ? { ...i, quantity: newQty } : i)
    );

    const { error } = await supabase
      .from('CartItem')
      .update({ quantity: newQty })
      .eq('id', id);

    if (error) console.error(error);
  };

  // 🔹 Remove item
  const removeItem = async (id) => {
    setCartItems(items => items.filter(i => i.id !== id));

    const { error } = await supabase
      .from('CartItem')
      .delete()
      .eq('id', id);

    if (error) console.error(error);
    else window.dispatchEvent(new Event('cartUpdated'));
  };

  // 🔹 Image helper
  const getImage = (product) => {
    if (!product?.images?.length) return "https://via.placeholder.com/150";
    return product.images.find(i => i.isMain)?.url || product.images[0].url;
  };

  // 🔥 CHECKOUT (FULLY FIXED)
  const handleCheckout = async () => {
    try {
      setCheckoutLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert("Please login first");
        return;
      }

      // 1️⃣ Create order from backend
      const res = await fetch("http://localhost:5000/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!data.id) {
        throw new Error("Failed to create order");
      }

      // 2️⃣ Razorpay options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY,
        amount: data.amount,
        currency: "INR",
        name: "Your Store",
        description: "Order Payment",
        order_id: data.id,

        handler: async function (response) {
          // 3️⃣ Verify payment
          const verifyRes = await fetch("http://localhost:5000/verify-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(response),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            alert("✅ Payment successful!");

            // optional: redirect
            window.location.href = "/orders";
          } else {
            alert("❌ Payment verification failed");
          }
        },

        prefill: {
          email: session.user.email,
        },

        theme: {
          color: "#000000",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

      rzp.on("payment.failed", function () {
        alert("Payment failed. Try again.");
      });

    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // 🔹 Loading
  if (loading) {
    return (
      <div className="min-h-screen pt-40 text-center">
        <Loader2 className="animate-spin mx-auto mb-4" />
        <p>Loading your bag...</p>
      </div>
    );
  }

  // 🔹 Not logged in
  if (!user) {
    return (
      <div className="pt-40 text-center">
        <h2>Please Login</h2>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  // 🔹 Empty cart
  if (!cartItems.length) {
    return (
      <div className="pt-40 text-center">
        <h2>Your Bag is Empty</h2>
        <Link to="/">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="bg-white pt-32 pb-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 lg:grid lg:grid-cols-12 lg:gap-12">

        {/* LEFT */}
        <div className="lg:col-span-8">
          {cartItems.map(item => (
            item.product && (
              <div key={item.id} className="flex py-6 border-b">
                <img src={getImage(item.product)} className="h-32 w-24 object-cover" />

                <div className="ml-6 flex-1">
                  <h3>{item.product.name}</h3>
                  <p>₹ {item.product.price}</p>
                  <p>Size: {item.size}</p>

                  <div className="flex gap-2 mt-2">
                    <button onClick={() => updateQuantity(item.id, item.quantity, -1)}><Minus size={14} /></button>
                    {item.quantity}
                    <button onClick={() => updateQuantity(item.id, item.quantity, 1)}><Plus size={14} /></button>
                  </div>

                  <button onClick={() => removeItem(item.id)} className="text-red-500 mt-2">
                    Remove
                  </button>
                </div>
              </div>
            )
          ))}
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-4 mt-10">
          <div className="bg-gray-50 p-6">
            <h2>Order Summary</h2>

            <div className="flex justify-between mt-4">
              <span>Total</span>
              <span>₹ {subtotal}</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full mt-6 bg-black text-white py-3 flex justify-center items-center gap-2"
            >
              {checkoutLoading ? <Loader2 className="animate-spin" /> : "Checkout"}
              <Lock size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CartPage;