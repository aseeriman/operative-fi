"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

const withAuth = (WrappedComponent, requiredRole = null) => {
  const AuthComponent = (props) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
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

          // If a specific role is required, check it
          if (requiredRole) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single();

            if (!profile || profile.role !== requiredRole) {
              router.push('/login');
              return;
            }
          }

          setIsAuthenticated(true);
        } catch (error) {
          console.error('Auth error:', error);
          router.push('/login');
        } finally {
          setIsLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex justify-center items-center h-screen">
          <p>Redirecting to login...</p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  // ✅ FIX: Display name set karein
  AuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  
  return AuthComponent;
};

export default withAuth;