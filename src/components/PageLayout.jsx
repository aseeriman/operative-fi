"use client";
import RoleBasedNavbar from './RoleBasedNavbar';
import { useTheme } from "@/contexts/ThemeContext";

export default function PageLayout({ children, title, userRoles }) {
  const { isDark } = useTheme();

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
      <div className="relative z-10">
        <RoleBasedNavbar userRoles={userRoles} />
        
        <div className="container mx-auto p-4 max-w-6xl">
          {/* Page Title */}
          <div className="flex justify-between items-center mb-6">
            {title && (
              <h1 className={`text-2xl font-bold drop-shadow-lg ${
                isDark ? 'text-white' : 'text-purple-900'
              }`}>
                {title}
              </h1>
            )}
          </div>
          
          {/* Main Content - Different styles for dark/light */}
          <div className={`rounded-xl p-6 border shadow-2xl backdrop-blur-lg transition-all duration-300 ${
            isDark
              ? 'bg-black/40 border-purple-500/30 text-white'
              : 'bg-white/20 border-white/30 text-purple-900'
          }`}>
            {children}
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