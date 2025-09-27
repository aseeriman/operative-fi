import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';



// ==================== CREATE (POST) ====================
export async function POST(request) {
  try {
    const { full_name, employee_code, roles, password } = await request.json();

    // Validate input
    if (!full_name || !employee_code || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (!roles || roles.length === 0) {
      return NextResponse.json(
        { error: "At least one role must be selected" },
        { status: 400 }
      );
    }

    // Check if employee code already exists
    const { data: existingWorker, error: checkError } = await supabase
      .from("profiles")
      .select("employee_code")
      .eq("employee_code", employee_code)
      .maybeSingle();

    if (checkError) {
      console.error("Check error:", checkError);
      return NextResponse.json({ error: "Error checking employee code" }, { status: 400 });
    }

    if (existingWorker) {
      return NextResponse.json(
        { error: "Employee code already exists" },
        { status: 400 }
      );
    }

    // Create auth user with ADMIN API
    let authData;
    try {
      const authResponse = await supabase.auth.admin.createUser({
        email: `${employee_code}@operativex.com`,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          employee_code,
          roles,
        },
      });

      if (authResponse.error) {
        throw authResponse.error;
      }
      authData = authResponse.data;
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Failed to create user account: " + authError.message },
        { status: 400 }
      );
    }

    // Create profile in profiles table with roles array
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      full_name,
      employee_code,
      role: roles[0], // Keep first role for backward compatibility
      roles, // Store all roles as array
    });

    if (profileError) {
      console.error("Profile error:", profileError);
      
      // Try to clean up auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error("Failed to clean up auth user:", deleteError);
      }
      
      return NextResponse.json(
        { error: "Failed to create profile: " + profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Worker created successfully",
      user: authData.user,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}

// ==================== READ (GET) ====================
export async function GET() {
  try {
    // Get all workers from profiles table
    const { data: workers, error } = await supabase
      .from("profiles")
      .select("id, full_name, employee_code, role, roles")
      .neq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Format the response to ensure roles is always an array
    const formattedWorkers = workers.map(worker => ({
      id: worker.id,
      full_name: worker.full_name,
      employee_code: worker.employee_code,
      role: worker.role, // For backward compatibility
      roles: Array.isArray(worker.roles) ? worker.roles : 
             worker.role ? [worker.role] : ["printing"] // Fallback
    }));

    return NextResponse.json({ workers: formattedWorkers });
  } catch (err) {
    console.error("GET Error:", err);
    return NextResponse.json(
      { error: "Internal server error: " + err.message },
      { status: 500 }
    );
  }
}

// ==================== UPDATE (PUT) ====================
export async function PUT(request) {
  try {
    const { id, full_name, employee_code, roles, password } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Worker ID is required" },
        { status: 400 }
      );
    }

    if (!roles || roles.length === 0) {
      return NextResponse.json(
        { error: "At least one role must be selected" },
        { status: 400 }
      );
    }

    // Update profile in profiles table with roles array
    const { data, error } = await supabase
      .from("profiles")
      .update({ 
        full_name, 
        employee_code, 
        role: roles[0], // Keep first role for backward compatibility
        roles // Store all roles as array
      })
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      try {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          id,
          { password }
        );

        if (authError) {
          console.error("Password update error:", authError);
          return NextResponse.json({ error: authError.message }, { status: 400 });
        }
      } catch (authError) {
        console.error("Auth password update error:", authError);
        return NextResponse.json(
          { error: "Failed to update password: " + authError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ 
      message: "Worker updated successfully", 
      data: {
        ...data[0],
        roles // Include roles in response
      } 
    });
  } catch (err) {
    console.error("PUT Error:", err);
    return NextResponse.json(
      { error: "Internal server error: " + err.message },
      { status: 500 }
    );
  }
}

// ==================== DELETE ====================
export async function DELETE(request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Worker ID is required" },
        { status: 400 }
      );
    }

    // Delete from profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // Delete from Supabase Auth as well
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(id);

      if (authError) {
        console.error("Auth delete error:", authError);
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    } catch (authError) {
      console.error("Auth delete exception:", authError);
      return NextResponse.json(
        { error: "Failed to delete auth user: " + authError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Worker deleted successfully" });
  } catch (err) {
    console.error("DELETE Error:", err);
    return NextResponse.json(
      { error: "Internal server error: " + err.message },
      { status: 500 }
    );
  }
}