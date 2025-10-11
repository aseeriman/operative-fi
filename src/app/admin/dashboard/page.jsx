"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import PageLayout from '@/components/PageLayout';
import { useTheme } from "@/contexts/ThemeContext";

export default function AdminDashboard() {
  const [workers, setWorkers] = useState([]);
  const [newWorker, setNewWorker] = useState({
    full_name: "",
    employee_code: "",
    roles: ["printing"],
    password: "",
  });
  const [editingWorker, setEditingWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userRoles, setUserRoles] = useState([]);
  const router = useRouter();
  const { isDark } = useTheme();

  const availableRoles = [
    "printing", "pasting", "lamination",
    "prepress", "plates", "card_cutting", "sorting",
    "varnish", "joint", "die_cutting", "foil",
    "screen_printing", "embose", "double_tape", "machineinfo"
  ];

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      setIsCheckingAuth(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push("/login");
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, roles")
        .eq("id", user.id)
        .single();

      if (profileError) {
        if (profileError.code === "PGRST116") {
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }
        throw profileError;
      }

      setUserRoles(Array.isArray(profile.roles) ? profile.roles : []);
      if (!profile || profile.role !== "admin") {
        setIsAdmin(false);
        router.push("/login");
      } else {
        setIsAdmin(true);
        loadWorkers();
      }
    } catch (error) {
      console.error("Admin check error:", error);
      router.push("/login");
    } finally {
      setIsCheckingAuth(false);
    }
  };

  async function loadWorkers() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, employee_code, role, roles, created_at")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading workers:", error.message, error);
        return;
      }

      const formattedWorkers = (data || []).map(worker => ({
        ...worker,
        roles: Array.isArray(worker.roles)
          ? worker.roles
          : worker.role
            ? [worker.role]
            : ["printing"],
      }));
      setWorkers(formattedWorkers);
    } catch (error) {
      console.error("Error loading workers:", error?.message || error);
    }
  }

  const handleDelete = async (id) => {
    try {
      const res = await fetch("/api/workers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || res.statusText);
      }

      setWorkers(prev => prev.filter((w) => w.id !== id));
      setSuccess("Worker deleted successfully!");
    } catch (error) {
      setError("Failed to delete worker: " + error.message);
    }
  };

  const handleEdit = (worker) => {
    setEditingWorker({
      ...worker,
      password: "",
      roles: Array.isArray(worker.roles) ? worker.roles :
        worker.role ? [worker.role] : ["printing"]
    });
  };

  const handleCancelEdit = () => {
    setEditingWorker(null);
  };

  const toggleRole = (role, isEditing = false) => {
    if (isEditing) {
      setEditingWorker(prev => {
        const currentRoles = prev.roles || [];
        const newRoles = currentRoles.includes(role)
          ? currentRoles.filter(r => r !== role)
          : [...currentRoles, role];
        return { ...prev, roles: newRoles };
      });
    } else {
      setNewWorker(prev => {
        const currentRoles = prev.roles || [];
        const newRoles = currentRoles.includes(role)
          ? currentRoles.filter(r => r !== role)
          : [...currentRoles, role];
        return { ...prev, roles: newRoles };
      });
    }
  };

  const handleUpdateWorker = async (e) => {
    e.preventDefault();
    if (!editingWorker) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (!editingWorker.full_name || !editingWorker.employee_code) {
        throw new Error("Name and Employee Code are required");
      }
      if (!editingWorker.roles || editingWorker.roles.length === 0) {
        throw new Error("At least one role must be selected");
      }
      const res = await fetch("/api/workers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingWorker.id,
          full_name: editingWorker.full_name,
          employee_code: editingWorker.employee_code,
          roles: editingWorker.roles,
          password: editingWorker.password || undefined,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || res.statusText);
      }
      setWorkers(prev =>
        prev.map(w => (w.id === editingWorker.id ? { ...w, ...editingWorker, password: "" } : w))
      );
      setEditingWorker(null);
      setSuccess("Worker updated successfully!");
    } catch (err) {
      setError(err.message || "Failed to update worker");
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (!newWorker.full_name || !newWorker.employee_code || !newWorker.password) {
        throw new Error("All fields are required");
      }
      if (newWorker.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      if (!newWorker.roles || newWorker.roles.length === 0) {
        throw new Error("At least one role must be selected");
      }

      // Check for existing employee code locally before fetching to Supabase
      if (workers.some(worker => worker.employee_code === newWorker.employee_code)) {
        throw new Error("Employee code already exists (local check)");
      }

      // Supabase check for existing employee code
      const { data: existingWorker } = await supabase
        .from("profiles")
        .select("employee_code")
        .eq("employee_code", newWorker.employee_code)
        .maybeSingle(); // Use maybeSingle to get null if not found

      if (existingWorker) {
        throw new Error("Employee code already exists (Supabase check)");
      }

      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorker),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add worker");

      setNewWorker({ full_name: "", employee_code: "", roles: ["printing"], password: "" });
      await loadWorkers();
      setSuccess("Worker added successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(t);
    }
  }, [error]);

  if (isCheckingAuth) {
    return (
      <PageLayout title="Admin Panel">
        <div className="flex justify-center items-center h-64">
          <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Checking authentication...</p>
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return (
      <PageLayout title="Admin Panel">
        <div className="flex justify-center items-center h-64">
          <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Redirecting to login...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Admin Panel" userRoles={userRoles}>
      {/* Error and Success Messages */}
      {error && (
        <div className="bg-red-400/20 backdrop-blur-sm border border-red-400/30 text-red-100 px-4 py-3 rounded-lg mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-400/20 backdrop-blur-sm border border-green-400/30 text-green-100 px-4 py-3 rounded-lg mb-4">
          <strong>Success:</strong> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add/Edit Worker Form */}
        <div className="bg-white/20 backdrop-blur-lg p-6 rounded-xl shadow-2xl border border-white/30">
          <h2 className={`text-xl font-bold mb-4 pb-2 border-b border-white/30 ${
            isDark ? 'text-white' : 'text-purple-900'
          }`}>
            {editingWorker ? "EDIT WORKER" : "ADD NEW WORKER"}
          </h2>

          {editingWorker ? (
            <form onSubmit={handleUpdateWorker} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingWorker.full_name}
                  onChange={(e) => setEditingWorker({ ...editingWorker, full_name: e.target.value })}
                  className={`w-full backdrop-blur-sm border rounded-lg px-3 py-2 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Enter full name"
                  disabled={loading}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Employee Code *</label>
                <input
                  type="text"
                  required
                  value={editingWorker.employee_code}
                  onChange={(e) => setEditingWorker({ ...editingWorker, employee_code: e.target.value })}
                  className={`w-full backdrop-blur-sm border rounded-lg px-3 py-2 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Enter employee code"
                  disabled={loading}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Roles *</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {availableRoles.map((role) => (
                    <div key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`edit-${role}`}
                        checked={editingWorker.roles.includes(role)}
                        onChange={() => toggleRole(role, true)}
                        className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-white/30 bg-white/20 rounded backdrop-blur-sm"
                        disabled={loading}
                      />
                      <label htmlFor={`edit-${role}`} className={`ml-2 block text-sm capitalize ${
                        isDark ? 'text-white' : 'text-purple-900'
                      }`}>
                        {role.replace('_', ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={editingWorker.password || ""}
                  onChange={(e) => setEditingWorker({ ...editingWorker, password: e.target.value })}
                  className={`w-full backdrop-blur-sm border rounded-lg px-3 py-2 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Set new password"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium py-2 rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:from-purple-300 disabled:to-blue-300 transition duration-200 shadow-lg"
                >
                  {loading ? "UPDATING..." : "UPDATE WORKER"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium py-2 rounded-lg hover:from-gray-700 hover:to-gray-800 disabled:from-gray-400 disabled:to-gray-500 transition duration-200 shadow-lg"
                >
                  CANCEL
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAddWorker} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={newWorker.full_name}
                  onChange={(e) => setNewWorker({ ...newWorker, full_name: e.target.value })}
                  className={`w-full backdrop-blur-sm border rounded-lg px-3 py-2 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Enter full name"
                  disabled={loading}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Employee Code *</label>
                <input
                  type="text"
                  required
                  value={newWorker.employee_code}
                  onChange={(e) => setNewWorker({ ...newWorker, employee_code: e.target.value })}
                  className={`w-full backdrop-blur-sm border rounded-lg px-3 py-2 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Enter employee code"
                  disabled={loading}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Roles *</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {availableRoles.map((role) => (
                    <div key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`new-${role}`}
                        checked={newWorker.roles.includes(role)}
                        onChange={() => toggleRole(role, false)}
                        className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-white/30 bg-white/20 rounded backdrop-blur-sm"
                        disabled={loading}
                      />
                      <label htmlFor={`new-${role}`} className={`ml-2 block text-sm capitalize ${
                        isDark ? 'text-white' : 'text-purple-900'
                      }`}>
                        {role.replace('_', ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Password * (min. 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newWorker.password}
                  onChange={(e) => setNewWorker({ ...newWorker, password: e.target.value })}
                  className={`w-full backdrop-blur-sm border rounded-lg px-3 py-2 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    isDark
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Set password"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-bold font-medium py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:from-purple-300 disabled:to-pink-300 transition duration-200 shadow-lg"
              >
                {loading ? "ADDING WORKER..." : "ADD WORKER"}
              </button>
            </form>
          )}
        </div>
        {/* Workers List */}
        <div className="bg-white/20 backdrop-blur-lg p-6 rounded-xl shadow-2xl border border-white/30">
          <h2 className={`text-xl font-bold mb-4 pb-2 border-b border-white/30 ${
            isDark ? 'text-white' : 'text-purple-900'
          }`}>
            WORKERS LIST ({workers.length})
          </h2>

          {workers.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-white/30">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-white/30 backdrop-blur-sm">
                    <th className={`px-4 py-3 text-left font-medium ${
                      isDark ? 'text-white' : 'text-purple-900'
                    }`}>Full Name</th>
                    <th className={`px-4 py-3 text-left font-medium ${
                      isDark ? 'text-white' : 'text-purple-900'
                    }`}>Employee Code</th>
                    <th className={`px-4 py-3 text-left font-medium ${
                      isDark ? 'text-white' : 'text-purple-900'
                    }`}>Roles</th>
                    <th className={`px-4 py-3 text-left font-medium ${
                      isDark ? 'text-white' : 'text-purple-900'
                    }`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-white/10">
                      <td className={`px-4 py-3 font-medium ${
                        isDark ? 'text-white' : 'text-purple-900'
                      }`}>
                        {worker.full_name || worker.employee_code}
                      </td>

                      <td className={`px-4 py-3 ${
                        isDark ? 'text-white/90' : 'text-purple-900/90'
                      }`}>{worker.employee_code}</td>
                      <td className={`px-4 py-3 ${
                        isDark ? 'text-white/90' : 'text-purple-900/90'
                      }`}>
                        <div className="flex flex-wrap gap-1">
                          {worker.roles && worker.roles.map((role, index) => (
                            <span
                              key={index}
                              className="inline-block bg-purple-900/20 text-purple-100 text-xs font-medium px-3 py-1 rounded border border-purple-400/30 backdrop-blur-sm whitespace-nowrap min-w-[100px] text-center"
                            >
                              {role.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 flex gap-2">
                        <button
                          onClick={() => handleEdit(worker)}
                          className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1.5 rounded text-sm hover:from-yellow-600 hover:to-amber-600 shadow-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(worker.id)}
                          className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1.5 rounded text-sm hover:from-red-600 hover:to-pink-600 shadow-lg"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`text-center py-8 ${
              isDark ? 'text-white/70' : 'text-purple-900/70'
            }`}>
              <p>No workers found</p>
              <p className="text-sm mt-1">Add workers using the form</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}