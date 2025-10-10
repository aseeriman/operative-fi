"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ensureProfileExists } from "@/lib/ensureProfileExists";
import { getUserRoles } from "@/lib/getUserRoles";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    employee_code: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const { isDark } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: `${credentials.employee_code}@operativex.com`,
        password: credentials.password,
      });
  
      if (authError) throw authError;
      const user = authData.user;
  
      try {
        await ensureProfileExists(user.id, user.email);
      } catch (profileError) {
        console.error("Profile error:", profileError);
      }
  
      const { roles = [], isAdmin } = await getUserRoles(user.id);
  
      router.push("/home");
    } catch (error) {
      console.error(error);
      setError("Invalid employee code or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  

  if (!isMounted) return null;

  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${
      isDark 
        ? 'dark-theme bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800' 
        : 'light-theme'
    }`}>
      {/* Background Image Container - Different for dark/light */}
      <div className="fixed inset-0 z-0">
        {isDark ? (
          // Dark theme background
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/images/operativexD.jpeg)' }}
          />
        ) : (
          // Light theme background
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/images/operativexL.jpg)' }}
          />
        )}
        {/* Overlay for better readability */}
        <div className={`absolute inset-0 ${
          isDark 
            ? 'bg-gradient-to-br from-gray-900/80 via-purple-900/60 to-gray-800/80' 
            : 'bg-gradient-to-br from-blue-400/20 via-purple-500/20 to-pink-400/20'
        }`}></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className={`p-6 rounded-xl shadow-2xl w-full max-w-xs backdrop-blur-lg border transition-all duration-300 ${
          isDark 
            ? 'bg-white/20 border-white/30' 
            : 'bg-white/20 border-white/30'
        }`}>
          
          {/* Theme Toggle at top right */}
          <div className="flex justify-end mb-4">
            <ThemeToggle />
          </div>
          
          <div className="flex justify-center mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${
              isDark ? 'bg-purple-500' : 'bg-blue-500'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          
          <h1 className={`text-xl font-bold text-center mb-1 ${
            isDark ? 'text-white' : 'text-purple-900'
          }`}>Welcome Back</h1>
          <p className={`text-center text-sm mb-6 ${
            isDark ? 'text-white/80' : 'text-purple-900/80'
          }`}>Sign in to your account</p>
          
          {error && (
            <div className={`border-l-4 p-3 rounded mb-4 flex items-center text-sm ${
              isDark 
                ? 'bg-red-400/20 border-red-400 text-red-100' 
                : 'bg-red-400/20 border-red-500 text-red-900'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="employee_code" className={`block text-xs font-medium ${
                isDark ? 'text-white' : 'text-purple-900'
              }`}>
                Employee Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${
                    isDark ? 'text-purple-400' : 'text-blue-400'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  id="employee_code"
                  name="employee_code"
                  type="text"
                  required
                  value={credentials.employee_code}
                  onChange={handleChange}
                  className={`pl-7 text-sm block w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-purple-500 backdrop-blur-sm border ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white placeholder-white/70 focus:ring-purple-500'
                      : 'bg-white/20 border-white/30 text-purple-900 placeholder-purple-900/70 focus:ring-purple-500'
                  }`}
                  placeholder="Employee code"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label htmlFor="password" className={`block text-xs font-medium ${
                isDark ? 'text-white' : 'text-purple-900'
              }`}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${
                    isDark ? 'text-purple-400' : 'text-blue-400'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={credentials.password}
                  onChange={handleChange}
                  className={`pl-7 text-sm block w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-purple-500 backdrop-blur-sm border ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white placeholder-white/70 focus:ring-purple-500'
                      : 'bg-white/20 border-white/30 text-purple-900 placeholder-purple-900/70 focus:ring-purple-500'
                  }`}
                  placeholder="Password"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 rounded-md text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm transition-all duration-200 ${
                loading 
                  ? (isDark ? "bg-purple-400 cursor-not-allowed" : "bg-blue-400 cursor-not-allowed") 
                  : (isDark 
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 focus:ring-purple-500" 
                      : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 focus:ring-blue-500")
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <p className={`text-xs ${
              isDark ? 'text-white/70' : 'text-purple-900/70'
            }`}>
              Need help?{" "}
              <a href="#" className={`font-medium ${
                isDark ? 'text-purple-300 hover:text-purple-200' : 'text-blue-600 hover:text-blue-500'
              }`}>
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Global styles for dark theme */}
      <style jsx global>{`
        .dark-theme {
          /* Dark theme specific styles */
        }
        
        .light-theme {
          /* Light theme specific styles */
        }
        
        /* Smooth transitions for all theme-able elements */
        * {
          transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
        }
      `}</style>
    </div>
  );
}