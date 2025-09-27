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
  const router = useRouter();
  const { isDark } = useTheme();

  useEffect(() => {
    checkAuth();
    loadMachines();
  }, []);

  // ✅ Check authentication & role
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
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        router.push("/login");
        return;
      }

      setUserRole(profile.role);

      if (profile.role !== "admin") {
        router.push("/" + profile.role);
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

  // ✅ Add / Update machine
  const handleSubmit = async (e) => {
    e.preventDefault();
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
        <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Loading...</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Redirecting...</p>
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
        
        <div className="container mx-auto p-4 max-w-6xl">
          {/* Page Title */}
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-bold drop-shadow-lg ${
              isDark ? 'text-white' : 'text-purple-900'
            }`}>
              Machine Information
            </h1>
          </div>
          
          {/* Main Content */}
          <div className={`rounded-xl p-6 border shadow-2xl backdrop-blur-lg transition-all duration-300 mb-6 ${
            isDark
              ? 'bg-black/40 border-purple-500/30 text-white'
              : 'bg-white/20 border-white/30 text-purple-900'
          }`}>
            
            {/* Form Section */}
            <form onSubmit={handleSubmit} className="space-y-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Machine Name:
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., HB-08"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Size:
                  </label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Capacity:
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 1000"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Available Days:
                  </label>
                  <input
                    type="number"
                    name="availableDays"
                    value={formData.availableDays}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 5"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-purple-200' : 'text-purple-900'
                }`}>
                  Description:
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg resize-none ${
                    isDark 
                      ? 'bg-white/20 border-white/30 text-white' 
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Short description about the machine"
                  rows="3"
                />
              </div>

              <div className="flex justify-end gap-4 pt-4">
                {editingMachine && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 border backdrop-blur-sm ${
                      isDark
                        ? 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                        : 'bg-white/20 text-purple-900 border-white/30 hover:bg-white/30'
                    }`}
                  >
                    CANCEL
                  </button>
                )}
                <button
                  type="submit"
                  className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r border backdrop-blur-sm ${
                    isDark
                      ? 'from-purple-500 to-blue-500 text-white border-purple-400/50 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                      : 'from-purple-500 to-blue-500 text-white border-white/30 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                  }`}
                >
                  {editingMachine ? "UPDATE MACHINE" : "ADD MACHINE"}
                </button>
              </div>
            </form>

            {/* Machines List Section */}
            <div className="border-t pt-6 border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>
                  Machines List
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-sm border ${
                  isDark 
                    ? 'bg-purple-500/30 text-purple-200 border-purple-400/50' 
                    : 'bg-white/30 text-purple-900 border-white/30'
                }`}>
                  {machines.length} machines
                </span>
              </div>

              {machines.length === 0 ? (
                <div className={`p-8 text-center bg-white/10 rounded-lg ${
                  isDark ? 'text-white/70' : 'text-purple-900/70'
                }`}>
                  No machines added yet. Add your first machine above.
                </div>
              ) : (
                <div className={`backdrop-blur-lg overflow-hidden rounded-lg border shadow-2xl ${
                  isDark ? 'bg-white/20 border-white/30' : 'bg-white/20 border-white/30'
                }`}>
                  {/* Table Header */}
                  <div className={`grid grid-cols-5 font-semibold backdrop-blur-sm p-4 border-b ${
                    isDark 
                      ? 'bg-white/30 text-purple-900 border-white/30' 
                      : 'bg-white/30 text-purple-900 border-white/30'
                  }`}>
                    <p>Name</p>
                    <p>Size</p>
                    <p>Capacity</p>
                    <p>Available Days</p>
                    <p>Actions</p>
                  </div>

                  {/* Table Rows */}
                  <div className="max-h-96 overflow-y-auto">
                    {machines.map((machine, index) => (
                      <div
                        key={machine.id}
                        className={`grid grid-cols-5 items-center p-4 hover:bg-white/10 transition-all duration-200 border-b last:border-b-0 ${
                          isDark ? 'border-white/20' : 'border-white/20'
                        } ${index % 2 === 0 ? 'bg-white/5' : ''}`}
                      >
                        <p className={`text-sm font-medium ${
                          isDark ? 'text-white' : 'text-purple-900'
                        }`}>{machine.name}</p>
                        
                        <p className={`text-sm ${
                          isDark ? 'text-white/90' : 'text-purple-900/90'
                        }`}>{machine.size || '-'}</p>
                        
                        <p className={`text-sm ${
                          isDark ? 'text-white/90' : 'text-purple-900/90'
                        }`}>{machine.capacity || '-'}</p>
                        
                        <p className={`text-sm ${
                          isDark ? 'text-white/90' : 'text-purple-900/90'
                        }`}>{machine.available_days || '-'}</p>
                        
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(machine)}
                              className={`px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl backdrop-blur-sm`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(machine.id)}
                              className={`px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg hover:shadow-xl backdrop-blur-sm`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </div>
                    ))}
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