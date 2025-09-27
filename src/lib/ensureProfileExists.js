import { supabase } from "@/lib/supabase-browser";

export async function ensureProfileExists(userId, email) {
  // Check if profile already exists
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching profile:", error.message);
    throw error;
  }

  if (data) return data; // Profile already exists

  // Insert new profile if missing
  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      role: "user",
      roles: ["user"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting profile:", insertError.message);
    throw insertError;
  }

  return newProfile;
}
