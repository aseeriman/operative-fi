import { supabase } from "@/lib/supabase-browser";

export async function getUserRoles(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching roles:", error.message);
    return { roles: [], isAdmin: false };
  }

  const rolesArray = data?.roles || [];
  const isAdmin = data?.role === "admin" || rolesArray.includes("admin");

  return { roles: rolesArray, isAdmin };
}
