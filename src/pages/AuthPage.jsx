import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, LogOut, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const AuthPage = () => {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        
        const { data } = await supabase
          .from('User')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        setUserProfile(data);
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg("");

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { full_name: formData.fullName } }
        });

        if (error) throw error;

        // ⚠️ IMPORTANT: email confirmation case
        if (!data.user) {
          alert("Check your email to confirm signup.");
          setIsSignUp(false);
          return;
        }

        alert("Signup successful!");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        navigate('/');
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
    navigate('/');
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // Logged In UI
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <UserIcon className="text-gray-400" />
          </div>

          <h2 className="text-xl font-semibold">{userProfile?.fullName || 'User'}</h2>
          <p className="text-sm text-gray-500 mb-6">{session.user.email}</p>

          <div className="space-y-3">
            <Link to="/orders" className="block py-3 rounded-lg border hover:bg-gray-50">Orders</Link>
            <Link to="/wishlist" className="block py-3 rounded-lg border hover:bg-gray-50">Wishlist</Link>

            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-lg bg-black text-white hover:bg-gray-800 flex items-center justify-center gap-2"
            >
              Logout <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Auth UI
  return (
    <div className="min-h-screen flex">

      {/* Left Image / Branding */}
      <div
        className="hidden lg:flex w-1/2 text-white items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: `url('https://dwyuljlhdtpcebfmkfer.supabase.co/storage/v1/object/public/images/IMG_3729.JPG' )`
        }}
      >
        <h1 className="text-4xl font-bold px-6 py-3 rounded-lg">
          Sapna Munoth
        </h1>
      </div>

      {/* Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">

          <h2 className="text-2xl font-semibold text-center mb-6">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>

          {errorMsg && (
            <div className="bg-red-100 text-red-600 p-2 text-sm mb-4 rounded">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">

            {isSignUp && (
              <input
                name="fullName"
                placeholder="Full Name"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            )}

            <input
              name="email"
              type="email"
              placeholder="Email"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              disabled={authLoading}
              className="w-full py-3 rounded-lg bg-black text-white hover:bg-gray-800 flex justify-center"
            >
              {authLoading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Sign Up" : "Sign In")}
            </button>
          </form>

          <p className="text-center text-sm mt-4">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-2 text-black font-medium"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>

        </div>
      </div>
    </div>
  );
};

export default AuthPage;
