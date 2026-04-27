import React, { useState, useEffect } from 'react';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const CartPage = () => {
  const [cartItems, setCartItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);
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
      return acc + item.product.price * item.quantity;
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

  // 🔹 WhatsApp Checkout
  const handleWhatsAppCheckout = () => {
    const phone = "9885033462"; // Replace with your WhatsApp number

    const message = `
Hi, I would like to place an order:

${cartItems.map((item, index) => `
Item ${index + 1}
Name: ${item.product.name}
Price: ₹${item.product.price}
Size: ${item.size}
Quantity: ${item.quantity}
Subtotal: ₹${item.product.price * item.quantity}
`).join('\n')}

Total: ₹${subtotal}
`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
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
        <h2 className="text-2xl font-semibold mb-4">Please Login</h2>
        <Link to="/login" className="underline">
          Go to Login
        </Link>
      </div>
    );
  }

  // 🔹 Empty cart
  if (!cartItems.length) {
    return (
      <div className="pt-40 text-center">
        <h2 className="text-2xl font-semibold mb-4">Your Bag is Empty</h2>
        <Link to="/" className="underline">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white pt-32 pb-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 lg:grid lg:grid-cols-12 lg:gap-12">

        {/* LEFT */}
        <div className="lg:col-span-8">
          <h1 className="text-3xl font-semibold mb-8">Shopping Bag</h1>

          {cartItems.map(item => (
            item.product && (
              <div key={item.id} className="flex py-6 border-b">
                <img
                  src={getImage(item.product)}
                  alt={item.product.name}
                  className="h-32 w-24 object-cover rounded"
                  loading="lazy"
                />

                <div className="ml-6 flex-1">
                  <h3 className="text-lg font-medium">{item.product.name}</h3>
                  <p className="text-gray-600">₹ {item.product.price}</p>
                  <p className="text-gray-500 text-sm">Size: {item.size}</p>

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity, -1)}
                      className="border p-1 rounded"
                    >
                      <Minus size={14} />
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() => updateQuantity(item.id, item.quantity, 1)}
                      className="border p-1 rounded"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 text-sm mt-3"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          ))}
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-4 mt-10 lg:mt-0">
          <div className="bg-gray-50 p-6 rounded-lg sticky top-32">
            <h2 className="text-xl font-semibold">Order Summary</h2>

            <div className="flex justify-between mt-4 text-lg">
              <span>Total</span>
              <span>₹ {subtotal}</span>
            </div>

            <button
              onClick={handleWhatsAppCheckout}
              className="w-full mt-6 bg-green-500 hover:bg-green-600 text-white py-3 rounded transition"
            >
              Order on WhatsApp
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CartPage;