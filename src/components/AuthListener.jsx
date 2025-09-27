"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';

export default function AuthListener({ children }) {
  const router = useRouter();

  useEffect(() => {
    const checkAndCreateProfile = async (userId, email) => {
      try {
        // Check if profile exists
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('id, role, roles')
          .eq('id', userId)
          .single();

        if (fetchError && fetchError.code === 'PGRST116') {
          // Profile doesn't exist, create one
          const employeeCode = email.split('@')[0];
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              employee_code: employeeCode,
              role: 'worker',
              roles: ['printing']
            });

          if (insertError) {
            console.error('Error creating profile:', insertError);
            return null;
          }
          
          // Return the newly created profile structure
          return { role: 'worker', roles: ['printing'] };
        }

        return existingProfile;
      } catch (error) {
        console.error('Error in profile check:', error);
        return null;
      }
    };

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          router.push('/login');
          router.refresh();
        } else if (event === 'SIGNED_IN' && session) {
          try {
            const profile = await checkAndCreateProfile(
              session.user.id, 
              session.user.email
            );

            if (!profile) {
              console.error('Profile issue - signing out');
              await supabase.auth.signOut();
              return;
            }

            // Determine roles
            const userRoles = Array.isArray(profile.roles) ? 
              profile.roles : 
              (profile.roles ? [profile.roles] : []);
              
            const isAdmin = profile.role === 'admin' || userRoles.includes('admin');

            if (isAdmin) {
              router.push('/admin/dashboard');
            } else {
              const firstRole = userRoles[0] || 'printing';
              router.push(`/${firstRole}`);
            }
            
            router.refresh();
          } catch (error) {
            console.error('Error during auth state change:', error);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return children;
}