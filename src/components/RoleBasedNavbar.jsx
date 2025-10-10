"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from './ThemeToggle';

export default function RoleBasedNavbar({ userRoles = [] }) {
  const [roles, setRoles] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { isDark } = useTheme();

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!mounted) return;
      
      try {
        setIsLoading(true);
        await checkAuthAndRedirect();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || isLoggingOut) return;
        
        if (event === "SIGNED_OUT" || event === "USER_DELETED") {
          setRoles([]);
          setIsAdmin(false);
          setUserEmail("");
          router.push("/login");
        } else if (event === "SIGNED_IN" && session) {
          await fetchUserProfile(session.user.id);
        } else if (event === "TOKEN_REFRESHED") {
          await fetchUserData();
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [router, isLoggingOut]);

  const fetchUserProfile = async (userId) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, roles, employee_code")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          await supabase.auth.signOut();
          router.push("/login");
        }
        return;
      }

      const arrayRoles = Array.isArray(profile.roles) ? profile.roles : (profile.roles ? [profile.roles] : []);
      const adminFlag = profile.role === "admin" || arrayRoles.includes("admin");

      setIsAdmin(adminFlag);
      setRoles(arrayRoles.filter(r => r !== "admin"));

      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email || "");
    } catch (err) {
      console.error("Error fetching user profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuthAndRedirect = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return false;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return false;
      }
      
      setUserEmail(user.email || '');
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, roles, employee_code')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const employeeCode = user.email.split('@')[0];
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            employee_code: employeeCode,
            role: 'worker',
            roles: ['printing']
          });

        if (insertError) {
          await supabase.auth.signOut();
          router.push('/login');
          return false;
        }
        
        setIsAdmin(false);
        setRoles(['printing']);
        return true;
      } else if (error) {
        await supabase.auth.signOut();
        router.push('/login');
        return false;
      }

      const arrayRoles = Array.isArray(profile.roles) ? 
        profile.roles : 
        (profile.roles ? [profile.roles] : []);
      
      const adminFlag = profile.role === 'admin' || arrayRoles.includes('admin');
      
      setIsAdmin(adminFlag);
      setRoles(arrayRoles.filter(r => r !== 'admin'));
      return true;
      
    } catch (err) {
      router.push('/login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserData = async () => {
    await checkAuthAndRedirect();
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      // Clear all local state first
      setRoles([]);
      setIsAdmin(false);
      setUserEmail("");
      setIsMenuOpen(false);
      
      // Then sign out
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // Force redirect to login
      router.push("/login");
      router.refresh(); // Force refresh the page
      
    } catch (error) {
      console.error("Error during logout:", error);
      // Still redirect to login even if there's an error
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Main pages to show in horizontal navbar - HOME ADDED FOR EVERYONE
  const mainPages = [
    { name: "Home", path: "/home" },
    { name: "Job Form", path: "/main/jobForm" },
    { name: "Pre-Press", path: "/pre_press" },
    { name: "Printing", path: "/printing" },
    { name: "Pasting", path: "/pasting" },
    { name: "Sorting", path: "/sorting" },
    { name: "Reports", path: "/reports" },
    { name: "Job Status", path: "/job_status" },
    { name: "MachineInfo", path: "/machineinfo" },
    { name: "Admin Panel", path: "/admin/dashboard" },
  ];

  // Additional pages to show only in the side menu
  const additionalPages = [
    { name: "Plates", path: "/plates" },
    { name: "Card Cutting", path: "/card_cutting" },
    { name: "Varnish", path: "/varnish" },
    { name: "Lamination", path: "/lamination" },
    { name: "Joint", path: "/joint" },
    { name: "Die Cutting", path: "/die_cutting" },
    { name: "Foil", path: "/foil" },
    { name: "Screen Printing", path: "/screen_printing" },
    { name: "Embose", path: "/embose" },
    { name: "Double Tape", path: "/double_tape" },
  ];

  // Role → page map
  const roleToPage = {
    printing:     { name: "Printing", path: "/printing" },
    cutting:      { name: "Cutting", path: "/cutting" },
    pasting:      { name: "Pasting", path: "/pasting" },
    lamination:   { name: "Lamination", path: "/lamination" },
    prepress:     { name: "Pre-Press", path: "/pre_press" },
    plates:       { name: "Plates", path: "/plates" },
    card_cutting: { name: "Card Cutting", path: "/card_cutting" },
    sorting:      { name: "Sorting", path: "/sorting" },
    machineinfo:  { name: "MachineInfo", path: "/machineinfo" },
  };

  // Worker pages - HOME ADDED AT THE BEGINNING
  const workerPages = [
    { name: "Home", path: "/home" }, // ← Home added for workers
    ...roles.map(r => roleToPage[r]).filter(Boolean)
  ];
  
  // Pages to show in horizontal navbar
  const navbarPages = isAdmin ? mainPages : workerPages.slice(0, 7);
  
  // All pages to show in side menu
  const allMenuPages = isAdmin ? [...mainPages, ...additionalPages] : workerPages;

  if (isLoading) {
    return (
      <div className={`py-3 px-4 shadow-lg relative z-20 backdrop-blur-md border-b ${
        isDark
          ? 'bg-gradient-to-r from-purple-900/90 to-gray-900/90 border-purple-500/30 text-white'
          : 'bg-gradient-to-r from-purple-500/90 to-blue-500/90 border-white/20 text-white'
      }`}>
        <div className="flex justify-between items-center">
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin && roles.length === 0) {
    return (
      <div className={`py-3 px-4 shadow-lg relative z-20 backdrop-blur-md border-b ${
        isDark
          ? 'bg-gradient-to-r from-purple-900/90 to-gray-900/90 border-purple-500/30 text-white'
          : 'bg-gradient-to-r from-purple-500/90 to-blue-500/90 border-white/20 text-white'
      }`}>
        <div className="flex justify-between items-center">
          <span className="text-sm">Redirecting to login...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Left Side Menu */}
      <div className={`
        fixed top-0 left-0 h-full w-64 z-50
        transform transition-transform duration-300 ease-in-out
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        shadow-2xl border-r backdrop-blur-lg
        ${isDark 
          ? 'bg-gradient-to-b from-purple-900/95 to-gray-900/95 border-purple-500/30 text-white' 
          : 'bg-gradient-to-b from-purple-600/95 to-blue-600/95 border-white/20 text-white'
        }
      `}>
        <div className="p-4 border-b border-white/20 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Navigation Menu</h2>
          <button 
            onClick={() => setIsMenuOpen(false)}
            className="text-white hover:text-purple-200 text-xl transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="overflow-y-auto h-full pb-20">
          <div className="p-4">
            <div className="mb-6">
              <h3 className="text-sm uppercase tracking-wider text-purple-200 mb-3">Main Pages</h3>
              <div className="space-y-2">
                {allMenuPages.map((page) => (
                  <Link
                    key={page.path}
                    href={page.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm transition-all duration-200 border backdrop-blur-sm ${
                      pathname === page.path
                        ? isDark
                          ? "bg-purple-600/50 text-white font-medium shadow-lg border-purple-400/50"
                          : "bg-white/20 text-white font-medium shadow-lg border-white/30"
                        : isDark
                          ? "text-white hover:bg-purple-600/30 hover:shadow-md border-purple-400/30"
                          : "text-white hover:bg-white/10 hover:shadow-md border-white/20"
                    }`}
                  >
                    {page.name}
                  </Link>
                ))}
              </div>
            </div>
            
            {/* Theme Toggle in Side Menu */}
            <div className="mb-6 p-3 bg-white/10 rounded-lg border border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-purple-200">Theme</span>
                <ThemeToggle />
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-purple-200">Logged in as: {(userEmail || "").split("@")[0]}</span>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border backdrop-blur-sm ${
                  isLoggingOut 
                    ? "bg-gray-400/50 cursor-not-allowed text-gray-300" 
                    : isDark
                      ? "bg-gradient-to-r from-red-500/80 to-orange-500/80 text-white hover:from-red-600/80 hover:to-orange-600/80 hover:shadow-md border-red-400/50"
                      : "bg-gradient-to-r from-red-500/80 to-orange-500/80 text-white hover:from-red-600/80 hover:to-orange-600/80 hover:shadow-md border-white/20"
                }`}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Navbar */}
      <div className={`py-3 px-4 relative z-20 shadow-lg border-b backdrop-blur-md ${
        isDark
          ? 'bg-gradient-to-r from-purple-900/90 to-gray-900/90 border-purple-500/30 text-white'
          : 'bg-gradient-to-r from-purple-500/90 to-blue-500/90 border-white/20 text-white'
      }`}>
        <div className="flex justify-between items-center">
          {/* Left - Logo and Menu Button Only */}
          <div className="flex items-center gap-4">
            {/* Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-white/20 flex flex-col justify-center items-center w-10 h-10 transition-all duration-200 border backdrop-blur-sm"
              aria-label="Menu"
            >
              <span className={`block h-0.5 w-6 mb-1.5 transition-transform ${
                isDark ? 'bg-purple-200' : 'bg-white'
              }`}></span>
              <span className={`block h-0.5 w-6 mb-1.5 ${
                isDark ? 'bg-purple-200' : 'bg-white'
              }`}></span>
              <span className={`block h-0.5 w-6 ${
                isDark ? 'bg-purple-200' : 'bg-white'
              }`}></span>
            </button>
            
            {/* Big Logo - Panel Title Removed */}
            <div className="relative w-50 h-6 md:w-50 md:h-6">
              Zafar Habib Packages
            </div>
          </div>

          {/* Center - Links (hidden on mobile) */}
          <div className="hidden md:flex gap-2 flex-wrap">
            {navbarPages.map((page) => (
              <Link
                key={page.path}
                href={page.path}
                className={`px-4 py-1.5 rounded-full text-sm transition-all duration-200 border backdrop-blur-sm ${
                  pathname === page.path
                    ? isDark
                      ? "bg-purple-500 text-white font-medium shadow-lg border-purple-400"
                      : "bg-white text-purple-600 font-medium shadow-lg border-white"
                    : isDark
                      ? "bg-purple-600/30 text-purple-100 hover:bg-purple-500/50 hover:shadow-md border-purple-400/30"
                      : "bg-white/20 text-white hover:bg-white/30 hover:shadow-md border-white/20"
                }`}
              >
                {page.name}
              </Link>
            ))}
          </div>

          {/* Right - Theme Toggle + user + logout */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            <span className={`text-xs md:inline px-3 py-1 rounded-full backdrop-blur-sm border ${
              isDark
                ? 'bg-purple-600/30 text-purple-100 border-purple-400/50'
                : 'bg-white/20 text-white border-white/20'
            }`}>
              {(userEmail || "").split("@")[0]}
            </span>
            
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`px-4 py-1.5 rounded-full text-sm transition-all duration-200 border backdrop-blur-sm ${
                isLoggingOut 
                  ? "bg-gray-400/50 cursor-not-allowed text-gray-300" 
                  : isDark
                    ? "bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 hover:shadow-md border-red-400/50"
                    : "bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 hover:shadow-md border-white/20"
              }`}
            >
              {isLoggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay when menu is open */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
}