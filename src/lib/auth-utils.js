import { supabase } from './supabase-browser';

export const ensureProfileExists = async (userId, email) => {
  try {
    // Check if profile exists
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
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
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }
      return { created: true };
    } else if (error) {
      throw new Error(`Failed to check profile: ${error.message}`);
    }

    return { exists: true };
  } catch (error) {
    console.error('Error in ensureProfileExists:', error);
    throw error;
  }
};

export const getUserRoles = async (userId) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, roles')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to get user roles: ${error.message}`);
    }

    const roles = Array.isArray(profile.roles) ? 
      profile.roles : 
      (profile.roles ? [profile.roles] : []);
    
    const isAdmin = profile.role === 'admin' || roles.includes('admin');
    
    return {
      roles: roles.filter(r => r !== 'admin'),
      isAdmin
    };
  } catch (error) {
    console.error('Error in getUserRoles:', error);
    throw error;
  }
};