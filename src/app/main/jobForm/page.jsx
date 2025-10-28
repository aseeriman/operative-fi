"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import RoleBasedNavbar from '@/components/RoleBasedNavbar';
import { useTheme } from "@/contexts/ThemeContext";

// Helper: map each page -> roles
function getAllowedRoles(page) {
  switch (page) {
    case "Job Card":
      return ["admin"];
    case "Pre-Press":
      return ["admin", "prepress"];
    case "Plates":
      return ["admin", "plates"];
    case "Card Cutting":
      return ["admin", "card_cutting"];
    case "Printing":
      return ["admin", "printing"];
    case "Pasting":
      return ["admin", "pasting"];
    case "Sorting":
      return ["admin", "sorting"];
    case "Reports":
      return ["admin"];
    default:
      return ["admin"];
  }
}

// Helper: get allowed pages based on role
function getAllowedPages(role) {
  if (role === "admin") {
    return [
      "Job Card",
      "Pre-Press",
      "Plates",
      "Card Cutting",
      "Printing",
      "Pasting",
      "Sorting",
      "Reports",
    ];
  }
  
  // For workers, only show their specific page
  const roleToPage = {
    prepress: "Pre-Press",
    plates: "Plates",
    card_cutting: "Card Cutting",
    printing: "Printing",
    pasting: "Pasting",
    sorting: "Sorting"
  };
  
  return [roleToPage[role] || role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')];
}

export default function JobCardForm() {
  const [formData, setFormData] = useState({
    jobId: "",
    customer: "",
    startDate: "",
    requiredDate: "",    
    subJobId: "1",
    color: "",
    cardSize: "",
    cardQty: "",
    itemQty: "",
    description: "",
    Printing: false,
  });

  const [subJobs, setSubJobs] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [showPrintingModal, setShowPrintingModal] = useState(false);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [activePage, setActivePage] = useState("Job Card");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingSubJob, setEditingSubJob] = useState(null);
  const [machines, setMachines] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [processesList, setProcessesList] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState({});
  const [userUID, setUserUID] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState({});
  
  const router = useRouter();
  const { isDark } = useTheme();
  const subJobsTableRef = useRef(null);

  // Define mutually exclusive groups
  const exclusiveGroups = {
    lamination: ["Lamination: Matte", "Lamination: Shine"],
    varnish: ["Varnish: Matte", "Varnish: Shine"]
  };

  // Load machines
  useEffect(() => {
    loadMachines();
  }, []);

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

  // Load processes
  useEffect(() => {
    loadProcesses();
  }, []);

  const loadProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from("processes")
        .select("process_name")
        .order("process_name");
      
      if (error) throw error;
      setProcessesList(data.map(item => item.process_name));
    } catch (error) {
      console.error("Error loading processes:", error);
    }
  };

  // Machine Form State
  const [machineFormData, setMachineFormData] = useState({
    name: "",
    size: "",
    capacity: "",
    description: "",
    availableDays: "",
  });

  // Authentication check
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUserUID(user.id);

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
      
      // Only admin can access job card form
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

  const handleTaskChange = (taskName) => {
    setSelectedTasks(prev => {
      const newSelectedTasks = { ...prev };
      
      // Check which exclusive group this task belongs to
      let currentGroup = null;
      for (const [group, tasks] of Object.entries(exclusiveGroups)) {
        if (tasks.includes(taskName)) {
          currentGroup = group;
          break;
        }
      }
      
      if (currentGroup) {
        // If this task is being selected, uncheck all other tasks in the same group
        if (!prev[taskName]) {
          exclusiveGroups[currentGroup].forEach(task => {
            if (task !== taskName) {
              newSelectedTasks[task] = false;
            }
          });
        }
      }
      
      // Toggle the current task
      newSelectedTasks[taskName] = !prev[taskName];
      return newSelectedTasks;
    });
  };

  // Check if a task should be disabled
  const isTaskDisabled = (taskName) => {
    for (const [group, tasks] of Object.entries(exclusiveGroups)) {
      if (tasks.includes(taskName)) {
        // Check if any other task in the same group is selected
        const otherSelected = tasks.some(task => 
          task !== taskName && selectedTasks[task]
        );
        return otherSelected;
      }
    }
    return false;
  };

  const toggleMachine = (machineId) => {
    setSelectedMachines((prev) => {
      const newSelectedMachines = prev.includes(machineId)
        ? prev.filter((id) => id !== machineId)
        : [...prev, machineId];
      
      // Auto-check the Printing checkbox if machines are selected
      if (newSelectedMachines.length > 0 && !formData.Printing) {
        setFormData(prevForm => ({
          ...prevForm,
          Printing: true
        }));
      } else if (newSelectedMachines.length === 0 && formData.Printing) {
        // Uncheck if no machines are selected
        setFormData(prevForm => ({
          ...prevForm,
          Printing: false
        }));
      }
      
      return newSelectedMachines;
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "Printing" && type === "checkbox") {
      setShowPrintingModal(checked);
      // If unchecking printing, clear selected machines
      if (!checked) {
        setSelectedMachines([]);
      }
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const handleMachineFormChange = (e) => {
    const { name, value } = e.target;
    setMachineFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMachineFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from("machines")
        .insert([
          {
            name: machineFormData.name,
            size: machineFormData.size,
            capacity: machineFormData.capacity,
            description: machineFormData.description,
            available_days: machineFormData.availableDays,
          }
        ])
        .select();

      if (error) throw error;

      // Refresh machines list
      await loadMachines();
      
      setShowMachineForm(false);
      setMachineFormData({
        name: "",
        size: "",
        capacity: "",
        description: "",
        availableDays: "",
      });
      console.log("New Machine Added:", data[0]);
    } catch (error) {
      console.error("Error adding machine:", error);
      alert("Error adding machine: " + error.message);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.jobId.trim()) newErrors.jobId = "Job ID is required";
    if (!formData.customer.trim()) newErrors.customer = "Customer name is required";
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.requiredDate) newErrors.requiredDate = "Required date is required";

    // Date validation
    if (formData.startDate && formData.requiredDate) {
      const start = new Date(formData.startDate);
      const required = new Date(formData.requiredDate);
      if (start > required) {
        newErrors.requiredDate = "Required date cannot be before start date";
      }
    }

    // Sub job validation
    if (subJobs.length === 0) {
      newErrors.subJobs = "Please add at least one sub job";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSubJob = () => {
    const newErrors = {};

    if (!formData.color.trim()) newErrors.color = "Color is required";
    if (!formData.cardSize.trim()) newErrors.cardSize = "Card size is required";
    if (!formData.cardQty || parseInt(formData.cardQty) <= 0) newErrors.cardQty = "Valid card quantity is required";
    if (!formData.itemQty || parseInt(formData.itemQty) <= 0) newErrors.itemQty = "Valid item quantity is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddSubJob = (e) => {
    e.preventDefault();
    
    if (!validateSubJob()) {
      return;
    }

    const subJobDetails = {
      subJobId: formData.subJobId,
      color: formData.color,
      cardSize: formData.cardSize,
      cardQty: formData.cardQty ? parseInt(formData.cardQty, 10) : 0,
      itemQty: formData.itemQty ? parseInt(formData.itemQty, 10) : 0,
      description: formData.description,
      selectedTasks: {...selectedTasks},
      machine_id: selectedMachines, 
    };

    if (editingSubJob !== null) {
      const updatedSubJobs = [...subJobs];
      updatedSubJobs[editingSubJob] = subJobDetails;
      setSubJobs(updatedSubJobs);
      setEditingSubJob(null);
    } else {
      setSubJobs((prev) => [...prev, subJobDetails]);
    }

    const currentSubJobId = parseInt(formData.subJobId) || 0;
    setFormData((prev) => ({
      ...prev,
      subJobId: String(
        editingSubJob !== null ? currentSubJobId : currentSubJobId + 1
      ),
      color: "",
      cardSize: "",
      cardQty: "",
      itemQty: "",
      description: "",
      Printing: false,
    }));
    
    setSelectedTasks({});
    setSelectedMachines([]);
    setErrors({});
    
    setTimeout(() => {
      if (subJobsTableRef.current) {
        subJobsTableRef.current.scrollTop = subJobsTableRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleDeleteSubJob = (index) => {
    const updatedSubJobs = subJobs.filter((_, i) => i !== index);
    setSubJobs(updatedSubJobs);
    if (updatedSubJobs.length === 0) {
      setFormData((prev) => ({ ...prev, subJobId: "1" }));
    }
  };

  const handleEditSubJob = (index) => {
    const subJobToEdit = subJobs[index];
    setFormData((prev) => ({
      ...prev,
      subJobId: subJobToEdit.subJobId,
      color: subJobToEdit.color,
      cardSize: subJobToEdit.cardSize,
      cardQty: subJobToEdit.cardQty.toString(),
      itemQty: subJobToEdit.itemQty.toString(),
      description: subJobToEdit.description,
      Printing: subJobToEdit.machine_id && subJobToEdit.machine_id.length > 0,
    }));
    setSelectedTasks(subJobToEdit.selectedTasks || {});
    setSelectedMachines(subJobToEdit.machine_id ? [...subJobToEdit.machine_id] : []);
    setEditingSubJob(index);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert("Please complete the job card form properly before submitting");
      return;
    }

    try {
      const requestData = {
        job_id: formData.jobId,
        customer_name: formData.customer,
        start_date: formData.startDate,
        required_date: formData.requiredDate,
        user_uid: userUID,
        sub_jobs: subJobs.map(subJob => ({
          sub_job_id: subJob.subJobId,
          color: subJob.color,
          card_size: subJob.cardSize,
          card_quantity: subJob.cardQty,
          item_quantity: subJob.itemQty,
          description: subJob.description,
          processes: subJob.selectedTasks || {},
          machine_id: subJob.machine_id || []  
        }))
      };
      
      console.log('Sending data to backend:', JSON.stringify(requestData, null, 2));
  
      const response = await fetch("/api/submit-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });
  
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit");
  
      alert("✅ Job card successfully submitted");
      console.log("Job created:", data);
  
      // Reset form after successful submission
      setFormData({
        jobId: "",
        customer: "",
        startDate: "",
        requiredDate: "",    
        subJobId: "1",
        color: "",
        cardSize: "",
        cardQty: "",
        itemQty: "",
        description: "",
        Printing: false,
      });
      setSubJobs([]);
      setSelectedTasks({});
      setSelectedMachines([]);
      setErrors({});
  
    } catch (error) {
      console.error("Error submitting job card:", error);
      alert("❌ Error: " + error.message);
    }
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    setIsMenuOpen(false);
    
    if (page === "Printing") {
      setShowMachineForm(true);
      setShowPrintingModal(false);
    } else {
      setShowMachineForm(false);
      setShowPrintingModal(false);
    }
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

  if (userRole !== "admin") {
    return null;
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
              Job Card Form
            </h1>
          </div>
          
          {/* Main Content */}
          <div className={`rounded-xl p-6 border shadow-2xl backdrop-blur-lg transition-all duration-300 ${
            isDark
              ? 'bg-black/40 border-purple-500/30 text-white'
              : 'bg-white/20 border-white/30 text-purple-900'
          }`}>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Top Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Job ID *
                  </label>
                  <input
                    name="jobId"
                    type="text"
                    autoComplete="off"
                    value={formData.jobId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.jobId ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    placeholder="Enter Job ID"
                    required
                  />
                  {errors.jobId && (
                    <p className="text-red-500 text-sm mt-1">{errors.jobId}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Customer *
                  </label>
                  <input
                    name="customer"
                    type="text"
                    autoComplete="off"
                    value={formData.customer}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.customer ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    placeholder="Enter Customer Name"
                    required
                  />
                  {errors.customer && (
                    <p className="text-red-500 text-sm mt-1">{errors.customer}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Start Date *
                  </label>
                  <input
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.startDate ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    required
                  />
                  {errors.startDate && (
                    <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Required Date *
                  </label>
                  <input
                    name="requiredDate"
                    type="date"
                    value={formData.requiredDate}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.requiredDate ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    required
                  />
                  {errors.requiredDate && (
                    <p className="text-red-500 text-sm mt-1">{errors.requiredDate}</p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/20 my-6"></div>

              {/* Sub Job Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Sub Job ID
                  </label>
                  <input
                    name="subJobId"
                    type="text"
                    autoComplete="off"
                    value={formData.subJobId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="Sub Job ID"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Color *
                  </label>
                  <input
                    name="color"
                    type="text"
                    autoComplete="off"
                    value={formData.color}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.color ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    placeholder="Color"
                  />
                  {errors.color && (
                    <p className="text-red-500 text-sm mt-1">{errors.color}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Card Size *
                  </label>
                  <input
                    name="cardSize"
                    type="text"
                    autoComplete="off"
                    value={formData.cardSize}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.cardSize ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    placeholder="Card Size"
                  />
                  {errors.cardSize && (
                    <p className="text-red-500 text-sm mt-1">{errors.cardSize}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Card Quantity *
                  </label>
                  <input
                    name="cardQty"
                    type="number"
                    value={formData.cardQty}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.cardQty ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    placeholder="Card Quantity"
                  />
                  {errors.cardQty && (
                    <p className="text-red-500 text-sm mt-1">{errors.cardQty}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Item Quantity *
                  </label>
                  <input
                    name="itemQty"
                    type="number"
                    value={formData.itemQty}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.itemQty ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    placeholder="Item Quantity"
                  />
                  {errors.itemQty && (
                    <p className="text-red-500 text-sm mt-1">{errors.itemQty}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg resize-none ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    } ${errors.description ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}
                    placeholder="Description"
                  />
                  {errors.description && (
                    <p className="text-red-500 text-sm mt-1">{errors.description}</p>
                  )}
                </div>
              </div>

              {/* Checkboxes Section */}
              <div className="pt-4">
                <label className={`block text-sm font-semibold mb-4 ${
                  isDark ? 'text-purple-200' : 'text-purple-900'
                }`}>
                  Select Processes:
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {processesList.map((processName) => (
                    <label 
                      key={processName} 
                      className={`flex items-center gap-2 text-sm backdrop-blur-sm p-2 rounded-lg border ${
                        isDark 
                          ? 'bg-white/10 border-white/20 text-white' 
                          : 'bg-white/30 border-white/30 text-purple-900'
                      } ${
                        // Add visual indicator for mutually exclusive options
                        (exclusiveGroups.lamination.includes(processName) || 
                         exclusiveGroups.varnish.includes(processName)) 
                          ? 'border-yellow-400/50' 
                          : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTasks[processName] || false}
                        onChange={() => handleTaskChange(processName)}
                        className="w-4 h-4"
                        disabled={isTaskDisabled(processName)}
                      />
                      <span className={isTaskDisabled(processName) ? 'opacity-50 line-through' : ''}>
                        {processName}
                      </span>
                    </label>
                  ))}
                  
                  <label className={`flex items-center gap-2 text-sm backdrop-blur-sm p-2 rounded-lg border ${
                    isDark 
                      ? 'bg-white/10 border-white/20 text-white' 
                      : 'bg-white/30 border-white/30 text-purple-900'
                  }`}>
                    <input
                      type="checkbox"
                      name="Printing"
                      checked={formData.Printing || false}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <span>Select Machine for Printing</span>
                  </label>
                </div>
              </div>

              {/* Add Sub Job Button */}
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={handleAddSubJob}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r border backdrop-blur-sm ${
                    isDark
                      ? 'from-purple-500 to-blue-500 text-white border-purple-400/50 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                      : 'from-purple-500 to-blue-500 text-white border-white/30 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                  }`}
                >
                  {editingSubJob !== null ? "UPDATE SUB JOB" : "ADD SUB JOB"}
                </button>
              </div>

              {/* Sub Jobs Table */}
              {subJobs.length > 0 && (
                <div
                  ref={subJobsTableRef}
                  className={`mt-6 p-4 rounded-lg border backdrop-blur-sm ${
                    isDark 
                      ? 'bg-white/10 border-white/20' 
                      : 'bg-white/30 border-white/30'
                  }`}
                >
                  <h3 className={`text-lg font-semibold mb-4 text-center ${
                    isDark ? 'text-white' : 'text-purple-900'
                  }`}>
                    Sub Jobs Details
                  </h3>

                  <div className={`overflow-x-auto ${
                    subJobs.length > 3 ? "max-h-[160px] overflow-y-auto" : ""
                  }`}>
                    <table className={`min-w-full border-collapse rounded-lg overflow-hidden ${
                      isDark ? 'bg-white/10' : 'bg-white/20'
                    }`}>
                      <thead className={`sticky top-0 ${
                        isDark ? 'bg-purple-900/50' : 'bg-white/30'
                      }`}>
                        <tr className={`text-sm ${
                          isDark ? 'text-purple-200' : 'text-purple-900'
                        }`}>
                          <th className="py-3 px-4 text-left border-b border-white/20">Sub Job ID</th>
                          <th className="py-3 px-4 text-left border-b border-white/20">Item Qty</th>
                          <th className="py-3 px-4 text-left border-b border-white/20">Description</th>
                          <th className="py-3 px-4 text-left border-b border-white/20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subJobs.map((job, index) => (
                          <tr
                            key={index}
                            className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                              isDark ? 'text-white' : 'text-purple-900'
                            }`}
                          >
                            <td className="py-3 px-4">{job.subJobId}</td>
                            <td className="py-3 px-4">{job.itemQty}</td>
                            <td className="py-3 px-4 max-w-xs truncate" title={job.description}>
                              {job.description || "N/A"}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditSubJob(index)}
                                  className="px-3 py-1 text-sm text-white rounded-lg transition-all duration-200 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 shadow-lg backdrop-blur-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubJob(index)}
                                  className="px-3 py-1 text-sm text-white rounded-lg transition-all duration-200 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg backdrop-blur-sm"
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

              {errors.subJobs && (
                <div className="text-red-500 text-sm text-center mt-2">
                  {errors.subJobs}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-white/20 my-6"></div>

              {/* Main Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r border backdrop-blur-sm ${
                    isDark
                      ? 'from-purple-500 to-blue-500 text-white border-purple-400/50 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                      : 'from-purple-500 to-blue-500 text-white border-white/30 hover:from-purple-600 hover:to-blue-600 hover:shadow-xl'
                  }`}
                >
                  SUBMIT JOB CARD
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Printing Modal */}
      {showPrintingModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 backdrop-blur-sm">
          <div className={`rounded-xl p-6 border shadow-2xl backdrop-blur-lg transition-all duration-300 w-full max-w-4xl ${
            isDark
              ? 'bg-black/60 border-purple-500/30 text-white'
              : 'bg-white/90 border-white/30 text-purple-900'
          }`}>
            <div className={`py-3 px-6 rounded-t-xl -mt-6 -mx-6 mb-6 ${
              isDark ? 'bg-purple-900/50' : 'bg-blue-500/10'
            }`}>
              <div className="flex justify-between items-center">
                <h1 className={`text-xl font-semibold ${
                  isDark ? 'text-white' : 'text-purple-900'
                }`}>Printing Details</h1>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintingModal(false);
                    setFormData((prev) => ({ ...prev, Printing: false }));
                    setSelectedMachines([]);
                  }}
                  className={`text-2xl hover:opacity-70 ${
                    isDark ? 'text-white' : 'text-purple-900'
                  }`}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {machines.map((machine) => (
                <div
                  key={machine.id}
                  className={`border rounded-xl p-4 shadow-lg transition duration-200 backdrop-blur-sm ${
                    selectedMachines.includes(machine.id)
                      ? isDark 
                        ? 'border-purple-400 bg-purple-500/20' 
                        : 'border-blue-400 bg-blue-500/20'
                      : isDark
                        ? 'border-white/30 bg-white/10 hover:bg-white/15'
                        : 'border-white/30 bg-white/30 hover:bg-white/40'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h2 className={`text-base font-semibold ${
                      isDark ? 'text-white' : 'text-purple-900'
                    }`}>
                      {machine.name}
                    </h2>
                    <input
                      type="checkbox"
                      checked={selectedMachines.includes(machine.id)}
                      onChange={() => toggleMachine(machine.id)}
                      className="h-4 w-4 text-blue-500"
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><strong>Size:</strong> {machine.size}</p>
                    <p><strong>Capacity:</strong> {machine.capacity}</p>
                    <p><strong>Description:</strong> {machine.description}</p>
                    <p><strong>Days:</strong> {machine.available_days}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowPrintingModal(false);
                  setFormData((prev) => ({ ...prev, Printing: false }));
                  setSelectedMachines([]);
                }}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 border backdrop-blur-sm ${
                  isDark
                    ? 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                    : 'bg-white/20 text-purple-900 border-white/30 hover:bg-white/30'
                }`}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrintingModal(false);
                  // Don't set Printing to false here - keep it true if machines are selected
                  if (selectedMachines.length > 0) {
                    setFormData((prev) => ({ ...prev, Printing: true }));
                  } else {
                    setFormData((prev) => ({ ...prev, Printing: false }));
                  }
                }}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r border backdrop-blur-sm ${
                  isDark
                    ? 'from-purple-500 to-blue-500 text-white border-purple-400/50 hover:from-purple-600 hover:to-blue-600'
                    : 'from-purple-500 to-blue-500 text-white border-white/30 hover:from-purple-600 hover:to-blue-600'
                }`}
              >
                SUBMIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Machine Info Modal */}
      {showMachineForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className={`rounded-xl p-6 border shadow-2xl backdrop-blur-lg transition-all duration-300 w-full max-w-md ${
            isDark
              ? 'bg-black/60 border-purple-500/30 text-white'
              : 'bg-white/90 border-white/30 text-purple-900'
          }`}>
            <div className={`py-3 px-6 rounded-t-xl -mt-6 -mx-6 mb-6 ${
              isDark ? 'bg-purple-900/50' : 'bg-blue-500/10'
            }`}>
              <h2 className={`text-lg font-semibold text-center ${
                isDark ? 'text-white' : 'text-purple-900'
              }`}>
                Machine Info
              </h2>
            </div>
            
            <form onSubmit={handleMachineFormSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-purple-200' : 'text-purple-900'
                }`}>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={machineFormData.name}
                  onChange={handleMachineFormChange}
                  className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                    isDark 
                      ? 'bg-white/20 border-white/30 text-white' 
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="e.g., HB-01"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>Size:</label>
                  <input
                    type="text"
                    name="size"
                    value={machineFormData.size}
                    onChange={handleMachineFormChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 20x30"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${
                    isDark ? 'text-purple-200' : 'text-purple-900'
                  }`}>Capacity:</label>
                  <input
                    type="text"
                    name="capacity"
                    value={machineFormData.capacity}
                    onChange={handleMachineFormChange}
                    className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                    placeholder="e.g., 1200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-purple-200' : 'text-purple-900'
                }`}>Description:</label>
                <textarea
                  className={`w-full px-3 py-2 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg resize-none ${
                    isDark 
                      ? 'bg-white/20 border-white/30 text-white' 
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="Short description"
                  rows="1"
                  name="description"
                  value={machineFormData.description}
                  onChange={handleMachineFormChange}
                  required
                />
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-purple-200' : 'text-purple-900'
                }`}>Available Days:</label>
                <input
                  type="text"
                  name="availableDays"
                  value={machineFormData.availableDays}
                  onChange={handleMachineFormChange}
                  className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                    isDark 
                      ? 'bg-white/20 border-white/30 text-white' 
                      : 'bg-white/20 border-white/30 text-purple-900'
                  }`}
                  placeholder="e.g., 5"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMachineForm(false)}
                  className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 border backdrop-blur-sm ${
                    isDark
                      ? 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                      : 'bg-white/20 text-purple-900 border-white/30 hover:bg-white/30'
                  }`}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r border backdrop-blur-sm ${
                    isDark
                      ? 'from-purple-500 to-blue-500 text-white border-purple-400/50 hover:from-purple-600 hover:to-blue-600'
                      : 'from-purple-500 to-blue-500 text-white border-white/30 hover:from-purple-600 hover:to-blue-600'
                  }`}
                >
                  SUBMIT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}