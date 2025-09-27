"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          router.push('/login');
          return;
        }

        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          router.push('/login');
          return;
        }

        setUser(user);
      } catch (error) {
        console.error('Auth error:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <nav className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <div className="flex space-x-4">
            <a href="/admin/dashboard" className="hover:bg-blue-700 px-3 py-2 rounded">Dashboard</a>
            <a href="/admin/prepress" className="hover:bg-blue-700 px-3 py-2 rounded">Pre-Press</a>
            <a href="/admin/printing" className="hover:bg-blue-700 px-3 py-2 rounded">Printing</a>
            <a href="/admin/plates" className="hover:bg-blue-700 px-3 py-2 rounded">Plates</a>
            <a href="/admin/card-cutting" className="hover:bg-blue-700 px-3 py-2 rounded">Card Cutting</a>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <div className="container mx-auto p-6">
        {children}
      </div>
    </div>
  );
}