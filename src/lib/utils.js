export const handleSupabaseError = (error) => {
    console.error('Supabase Error:', error);
    throw new Error(error.message || 'Database error occurred');
  };