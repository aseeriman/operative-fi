"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import RoleBasedNavbar from "@/components/RoleBasedNavbar";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";

export default function MachineInfo() {
  const [machines, setMachines] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    size: "",
    capacity: "",
    description: "",
    availableDays: "",
  });

  const [editingMachine, setEditingMachine] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ NEW: For form submission
  const router = useRouter();
  const { isDark } = useTheme();

  useEffect(() => {
    checkAuth();
    loadMachines();
  }, []);

  // ✅ Check authentication & role - UPDATED
  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, roles")
        .eq("id", user.id)
        .single();

      if (!profile) {
        router.push("/login");
        return;
      }

      // ✅ NEW: Check roles array instead of just role
      const userRoles = Array.isArray(profile.roles) ? profile.roles : 
                       profile.role ? [profile.role] : [];
      
      setUserRole(profile.role);

      // ✅ UPDATED CONDITION:
      // Allow if user is admin OR has machineinfo role
      const canAccessMachineInfo = profile.role === "admin" || 
                                  userRoles.includes("machineinfo");

      if (!canAccessMachineInfo) {
        // Redirect to first available role page or home
        const firstRole = userRoles.length > 0 ? userRoles[0] : "home";
        router.push("/" + firstRole);
        return;
      }

    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Load machines
  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .order("name");

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error("Error loading machines:", error);
    }
  };

  // ✅ Handle form input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ✅ Add / Update machine - UPDATED with loading state
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); // ✅ Show loading
    
    try {
      if (editingMachine) {
        // 🔹 Update existing machine
        const { error } = await supabase
          .from("machines")
          .update({
            name: formData.name,
            size: formData.size,
            capacity: formData.capacity ? parseInt(formData.capacity) : null,
            description: formData.description,
            available_days: formData.availableDays
              ? parseInt(formData.availableDays)
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingMachine.id);

        if (error) throw error;
      } else {
        // 🔹 Insert new machine
        const { error } = await supabase.from("machines").insert({
          name: formData.name,
          size: formData.size,
          capacity: formData.capacity ? parseInt(formData.capacity) : null,
          description: formData.description,
          available_days: formData.availableDays
            ? parseInt(formData.availableDays)
            : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      // ✅ Reset form
      setFormData({
        name: "",
        size: "",
        capacity: "",
        description: "",
        availableDays: "",
      });
      setEditingMachine(null);
      loadMachines();

      alert(
        editingMachine
          ? "✅ Machine updated successfully"
          : "✅ Machine added successfully"
      );
    } catch (error) {
      console.error("Error saving machine:", error);
      alert("❌ Error: " + error.message);
    } finally {
      setIsSubmitting(false); // ✅ Hide loading
    }
  };

  // ✅ Edit machine
  const handleEdit = (machine) => {
    setFormData({
      name: machine.name,
      size: machine.size || "",
      capacity: machine.capacity || "",
      description: machine.description || "",
      availableDays: machine.available_days || "",
    });
    setEditingMachine(machine);
  };

  // ✅ Delete machine
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this machine?")) return;

    try {
      const { error } = await supabase.from("machines").delete().eq("id", id);

      if (error) throw error;

      loadMachines();
      alert("✅ Machine deleted successfully");
    } catch (error) {
      console.error("Error deleting machine:", error);
      alert("❌ Error: " + error.message);
    }
  };

  const cancelEdit = () => {
    setFormData({
      name: "",
      size: "",
      capacity: "",
      description: "",
      availableDays: "",
    });
    setEditingMachine(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className={isDark ? 'text-white' : 'text-purple-900'}>Loading...</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className={isDark ? 'text-white' : 'text-purple-900'}>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${
      isDark 
        ? 'dark-theme bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800' 
        : 'light-theme'
    }`}>
      {/* Background Image Container */}
      <div className="fixed inset-0 z-0">
        {isDark ? (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/images/operativexD.jpeg)' }}
          />
        ) : (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/images/operativexL.jpg)' }}
          />
        )}
        {/* Overlay for better readability */}
        <div className={`absolute inset-0 ${
          isDark 
            ? 'bg-gradient-to-br from-gray-900/80 via-purple-900/60 to-gray-800/80' 
            : 'bg-gradient-to-br from-blue-400/20 via-purple-500/20 to-pink-400/20'
        }`}></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <RoleBasedNavbar />
        
        <div className="container mx-auto p-4 max-w-4xl"> {/* ✅ Changed to max-w-4xl for compact layout */}
          {/* Page Title */}
          <div className="flex justify-between items-center mb-4"> {/* ✅ Reduced margin */}
            <h1 className={`text-xl font-bold drop-shadow-lg ${
              isDark ? 'text-white' : 'text-purple-900'
            }`}>
              Machine Information
            </h1>
          </div>
          
          {/* Main Content - COMPACT FORM */}
          <div className={`rounded-xl p-4 border shadow-2xl backdrop-blur-lg transition-all duration-300 mb-4 ${
            isDark
              ? 'bg-black/40 border-purple-500/30 text-white'
              : 'bg-white/20 border-white/30 text-purple-900'
          }`}>
            
            {/* ✅ COMPACT Form Section */}
            <form onSubmit={handleSubmit} className="space-y-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* ✅ Reduced gap */}
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Machine Name:
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg text-sm ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., HB-08"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Size:
                  </label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg text-sm ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 20"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Capacity:
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg text-sm ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 1000"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Available Days:
                  </label>
                  <input
                    type="number"
                    name="availableDays"
                    value={formData.availableDays}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg text-sm ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 5"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${
                  isDark ? 'text-purple-200' : 'text-purple-900'
                }`}>
                  Description:
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg resize-none text-sm ${
                    isDark 
                      ? 'bg-white/20 border-white/30 text-white' 
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Short description about the machine"
                  rows="2"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                {editingMachine && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded text-xs font-semibold transition-all duration-200 border backdrop-blur-sm ${
                      isSubmitting 
                        ? 'bg-gray-400/50 cursor-not-allowed' 
                        : isDark
                          ? 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                          : 'bg-white/20 text-purple-900 border-white/30 hover:bg-white/30'
                    }`}
                  >
                    CANCEL
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded text-xs font-semibold transition-all duration-200 bg-gradient-to-r border backdrop-blur-sm flex items-center gap-2 ${
                    isSubmitting 
                      ? 'from-purple-300 to-blue-300 cursor-not-allowed' 
                      : isDark
                        ? 'from-purple-500 to-blue-500 text-white border-purple-400/50 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                        : 'from-purple-500 to-blue-500 text-white border-white/30 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editingMachine ? "UPDATING..." : "ADDING..."}
                    </>
                  ) : (
                    editingMachine ? "UPDATE MACHINE" : "ADD MACHINE"
                  )}
                </button>
              </div>
            </form>

            {/* Machines List Section - FIXED TABLE STRUCTURE */}
            <div className="border-t pt-4 border-white/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>
                  Machines List
                </h2>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ${
                  isDark 
                    ? 'bg-purple-500/30 text-purple-200 border-purple-400/50' 
                    : 'bg-white/30 text-purple-900 border-white/30'
                }`}>
                  {machines.length} machines
                </span>
              </div>

              {machines.length === 0 ? (
                <div className={`p-4 text-center bg-white/10 rounded-lg text-sm ${
                  isDark ? 'text-white/70' : 'text-purple-900/70'
                }`}>
                  No machines added yet. Add your first machine above.
                </div>
              ) : (
                <div className={`backdrop-blur-lg overflow-hidden rounded-lg border shadow-2xl ${
                  isDark ? 'bg-white/20 border-white/30' : 'bg-white/20 border-white/30'
                }`}>
                  {/* ✅ PROPER TABLE STRUCTURE WITH GOOD SPACING */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      {/* Table Header */}
                      <thead>
                        <tr className={`font-semibold backdrop-blur-sm text-sm ${
                          isDark 
                            ? 'bg-white/30 text-purple-900 border-white/30' 
                            : 'bg-white/30 text-purple-900 border-white/30'
                        }`}>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">Size</th>
                          <th className="p-2 text-left">Capacity</th>
                          <th className="p-2 text-left">Available Days</th>
                          <th className="p-2 text-left">Actions</th>
                        </tr>
                      </thead>

                      {/* Table Body - REMOVED block class for proper table layout */}
                      <tbody>
                        {machines.map((machine, index) => (
                          <tr
                            key={machine.id}
                            className={`hover:bg-white/10 transition-all duration-200 text-sm ${
                              isDark ? 'border-white/10' : 'border-white/20'
                            } ${index % 2 === 0 ? 'bg-white/5' : 'bg-white/10'}`}
                          >
                            <td className={`p-2 font-medium ${
                              isDark ? 'text-white' : 'text-purple-900'
                            }`}>{machine.name}</td>
                            
                            <td className={`p-2 ${
                              isDark ? 'text-white/90' : 'text-purple-900/90'
                            }`}>{machine.size || '-'}</td>
                            
                            <td className={`p-2 ${
                              isDark ? 'text-white/90' : 'text-purple-900/90'
                            }`}>{machine.capacity || '-'}</td>
                            
                            <td className={`p-2 ${
                              isDark ? 'text-white/90' : 'text-purple-900/90'
                            }`}>{machine.available_days || '-'}</td>
                            
                            {/* ✅ FIXED: Now td is inside tr with proper spacing */}
                            <td className="p-2">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEdit(machine)}
                                  disabled={isSubmitting}
                                  className={`px-2 py-1 text-xs text-white rounded transition-all duration-200 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl backdrop-blur-sm ${
                                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(machine.id)}
                                  disabled={isSubmitting}
                                  className={`px-2 py-1 text-xs text-white rounded transition-all duration-200 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg hover:shadow-xl backdrop-blur-sm ${
                                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}