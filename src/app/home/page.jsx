// app/home/page.js - With proper navbar layout
"use client";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase-browser';
import RoleBasedNavbar from "@/components/RoleBasedNavbar";

export default function Home() {
  const { isDark } = useTheme();
  const router = useRouter();
  const [userRoles, setUserRoles] = useState([]);

  useEffect(() => {
    redirectUser();
  }, [router]);

  const redirectUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Get user role and set userRoles for navbar
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, roles')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Set user roles for navbar
        setUserRoles(Array.isArray(profile.roles) ? profile.roles : []);
        
        return () => clearTimeout(timer);
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Redirect error:', error);
      router.push('/login');
    }
  };

  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${
      isDark 
        ? 'dark-theme bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800' 
        : 'light-theme'
    }`}>
      {/* Background Image Container */}
      <div className="fixed inset-0 z-0">
        {isDark ? (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/images/operativexD.jpeg)' }}
          />
        ) : (
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
      <div className="relative z-10">
        {/* Navbar - Proper horizontal layout */}
        <RoleBasedNavbar userRoles={userRoles} />
        
        {/* Main Content - Centered with proper spacing */}
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] pt-16">
          <div className="text-center">
            {/* Company Logo/Name */}
            <div className={`text-6xl md:text-8xl font-bold mb-4 drop-shadow-2xl ${
              isDark ? 'text-white' : 'text-purple-900'
            }`}>
              Zafar Habib Packages (Pvt.) Ltd.
            </div>
            
            {/* Loading/Redirect Message */}
            <div className={`text-lg md:text-xl mt-8 ${
              isDark ? 'text-white/80' : 'text-purple-900/80'
            }`}>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}