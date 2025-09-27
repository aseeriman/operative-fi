"use client";
import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { supabase } from "@/lib/supabase-browser";
import { useTheme } from "@/contexts/ThemeContext";

export default function ProcessesForm({ title, processId, showMachine = false }) {
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [machinesList, setMachinesList] = useState([]); 
  const [machineNames, setMachineNames] = useState({});
  const [machineCounts, setMachineCounts] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [userEmployeeCode, setUserEmployeeCode] = useState("");
  const [updatingJobs, setUpdatingJobs] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [customerNames, setCustomerNames] = useState({});
  const [activeMachine, setActiveMachine] = useState(null);
  const { isDark } = useTheme();

  // get user employee code
  const getUserEmployeeCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('employee_code')
          .eq('id', user.id)
          .single();

        if (!error && profile?.employee_code) {
          setUserEmployeeCode(profile.employee_code);
        }
      }
    } catch (err) {
      console.error("Error getting user employee code:", err);
    }
  };

  // fetch all machines
  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase
        .from("machines")
        .select("id, name")
        .order("name");
      if (error) {
        console.error("Error fetching machines:", error);
        return;
      }
      setMachinesList(data || []);
      const map = {};
      (data || []).forEach(m => { map[m.id] = m.name; });
      setMachineNames(map);
    } catch (err) {
      console.error("fetchMachines error:", err);
    }
  };

  // fetch customer names
  const fetchCustomerNames = async (jobIds) => {
    try {
      if (!jobIds || jobIds.length === 0) return;
      const { data, error } = await supabase
        .from("job_cards")
        .select("job_id, customer_name")
        .in("job_id", jobIds);
      if (error) {
        console.error("Error fetching customer names:", error);
        return;
      }
      const customerMap = {};
      data.forEach(job => (customerMap[job.job_id] = job.customer_name));
      setCustomerNames(customerMap);
    } catch (err) {
      console.error("Error in fetchCustomerNames:", err);
    }
  };

  // fetch jobs - IMPROVED VERSION (neeche wale code se)
  const fetchJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("job_processes")
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching jobs:", error);
        setJobs([]);
        setAllJobs([]);
        return;
      }

      console.log("Fetched jobs:", data?.length);
      setJobs(data || []);
      setAllJobs(data || []);

      const uniqueJobIds = [...new Set((data || []).map(job => job.job_id))];
      if (uniqueJobIds.length > 0) {
        fetchCustomerNames(uniqueJobIds);
      }

      if (showMachine) {
        if (machinesList.length === 0) {
          await fetchMachines();
        }
        const counts = {};
        (machinesList || []).forEach(m => (counts[m.id] = 0));
        (data || []).forEach(job => {
          const mid = job.machine_id;
          if (mid != null) counts[mid] = (counts[mid] || 0) + 1;
        });
        setMachineCounts(counts);
      }
    } catch (err) {
      console.error("fetchJobs unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const initializeData = async () => {
      if (!mounted) return;
      
      await getUserEmployeeCode();
      if (showMachine) {
        await fetchMachines();
      }
      await fetchJobs();
    };

    initializeData();

    // Real-time subscription (neeche wale code se improved)
    const channel = supabase
      .channel("job_processes_changes")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "job_processes",
          filter: `process_id=eq.${processId}`
        },
        (payload) => {
          if (mounted) {
            fetchJobs();
            if (payload.new && payload.new.job_id && payload.new.sub_job_id) {
              const jobKey = showMachine 
                ? `${payload.new.job_id}-${payload.new.sub_job_id}-${payload.new.machine_id}`
                : `${payload.new.job_id}-${payload.new.sub_job_id}`;
              
              setUpdatingJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(jobKey);
                return newSet;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [processId, showMachine]);

  // search function (upar wale code se)
  const handleSearch = (term) => {
    setSearchTerm(term);
    
    if (!term.trim()) {
      setJobs(allJobs);
      return;
    }

    const filtered = allJobs.filter(job => 
      job.job_id.toLowerCase().includes(term.toLowerCase()) ||
      (customerNames[job.job_id] && 
       customerNames[job.job_id].toLowerCase().includes(term.toLowerCase()))
    );
    
    setJobs(filtered);
  };

  // mark completed (neeche wale code se improved)
  const handleStatusChange = async (jobId, subJobId, machineId = null) => {
    if (!userEmployeeCode) {
      alert("Error: Could not identify your employee code.");
      return;
    }

    const jobKey = showMachine ? `${jobId}-${subJobId}-${machineId}` : `${jobId}-${subJobId}`;
    
    // Optimistic update
    setUpdatingJobs(prev => new Set(prev).add(jobKey));
    
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.job_id === jobId && job.sub_job_id === subJobId && (!showMachine || job.machine_id === machineId)
          ? { 
              ...job, 
              status: "completed", 
              employee_code: userEmployeeCode,
              updated_at: new Date().toISOString()
            }
          : job
      )
    );

    try {
      let query = supabase
        .from("job_processes")
        .update({ 
          status: "completed",
          employee_code: userEmployeeCode,
          updated_at: new Date().toISOString()
        })
        .eq("job_id", jobId)
        .eq("sub_job_id", subJobId)
        .eq("process_id", processId);

      if (showMachine && machineId) {
        query = query.eq("machine_id", machineId);
      }

      const { error } = await query;

      if (error) {
        console.error("Error updating job status:", error);
        alert("Error: " + error.message);
        
        fetchJobs();
        setUpdatingJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobKey);
          return newSet;
        });
      } else {
        setTimeout(() => {
          setUpdatingJobs(prev => {
            const newSet = new Set(prev);
            newSet.delete(jobKey);
            return newSet;
          });
        }, 3000);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      fetchJobs();
      setUpdatingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobKey);
        return newSet;
      });
    }
  };

  // Check if all machines for a job are completed (neeche wale code se)
  const isJobFullyCompleted = (jobId, subJobId) => {
    const jobMachines = allJobs.filter(job => 
      job.job_id === jobId && job.sub_job_id === subJobId
    );
    return jobMachines.length > 0 && jobMachines.every(job => job.status === "completed");
  };

  const filteredJobs =
    filter === "all"
      ? jobs
      : jobs.filter((j) => j.status.toLowerCase() === filter);

  if (loading) {
    return (
      <PageLayout title={title}>
        <div className="flex justify-center items-center h-64">
          <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Loading jobs...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={title}>
      <div className="p-6">
        {/* Search and Filter Section - UPAR WALE CODE KA EXACT UI */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Job ID or Customer Name..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className={`w-full px-4 py-3 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                  isDark 
                    ? 'bg-white/20 border-white/30 text-white' 
                    : 'bg-white/20 border-white/30 text-purple-900'
                }`}
              />
              <div className={`absolute right-3 top-3 ${
                isDark ? 'text-white/70' : 'text-purple-900/70'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {["all", "pending", "completed"].map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 rounded-full font-medium transition-all duration-200 border backdrop-blur-sm ${
                  filter === tab
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg"
                    : isDark
                      ? "bg-white/20 text-white hover:bg-white/30 hover:shadow-md border-white/20"
                      : "bg-white/20 text-purple-900 hover:bg-white/30 hover:shadow-md border-white/20"
                }`}
                onClick={() => setFilter(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Machines Dashboard - Neeche wale code ki functionality */}
        {showMachine && machinesList.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
              {machinesList.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveMachine(m.id);
                    const filtered = allJobs.filter(j => j.machine_id === m.id);
                    setJobs(filtered);
                  }}
                  className={`block p-3 border rounded-lg transition-all text-left backdrop-blur-sm ${
                    activeMachine === m.id 
                      ? isDark
                        ? "bg-purple-600/50 border-purple-400 shadow-lg" 
                        : "bg-blue-100 border-blue-500 shadow-lg"
                      : isDark
                        ? "bg-white/20 border-white/30 hover:bg-white/30" 
                        : "bg-white/20 border-white/30 hover:bg-white/30"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className={`truncate font-medium text-sm ${
                      isDark ? 'text-white' : 'text-purple-900'
                    }`}>{m.name}</div>
                    <div className={`ml-2 px-2 py-1 rounded-full text-xs font-bold min-w-[24px] text-center ${
                      isDark 
                        ? 'bg-purple-500/30 text-purple-200' 
                        : 'bg-blue-500/20 text-blue-700'
                    }`}>
                      {machineCounts[m.id] || 0}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {activeMachine && (
              <button
                onClick={() => {
                  setActiveMachine(null);
                  setJobs(allJobs);
                }}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium backdrop-blur-sm border ${
                  isDark 
                    ? 'bg-white/20 text-white border-white/30 hover:bg-white/30' 
                    : 'bg-white/20 text-purple-900 border-white/30 hover:bg-white/30'
                }`}
              >
                Show All Machines
              </button>
            )}
          </div>
        )}

        {/* Table - UPAR WALE CODE KA EXACT UI */}
        <div className={`backdrop-blur-lg overflow-hidden rounded-lg border shadow-2xl ${
          isDark ? 'bg-white/20 border-white/30' : 'bg-white/20 border-white/30'
        }`}>
          {/* Header */}
          <div className={`grid ${showMachine ? "grid-cols-6" : "grid-cols-5"} font-semibold backdrop-blur-sm p-4 border-b ${
            isDark 
              ? 'bg-white/30 text-purple-900 border-white/30' 
              : 'bg-white/30 text-purple-900 border-white/30'
          }`}>
            <p>Job ID</p>
            <p>Customer</p>
            <p>Sub Job</p>
            {showMachine && <p>Machine</p>}
            <p>Status</p>
            <p>Action</p>
          </div>

          {/* Data Rows */}
          {filteredJobs.length === 0 ? (
            <div className={`p-8 text-center bg-white/10 ${
              isDark ? 'text-white/70' : 'text-purple-900/70'
            }`}>
              {searchTerm ? `No results found for "${searchTerm}"` : "No jobs found."}
            </div>
          ) : (
            filteredJobs.map((job) => {
              const jobKey = showMachine 
                ? `${job.job_id}-${job.sub_job_id}-${job.machine_id}`
                : `${job.job_id}-${job.sub_job_id}`;
              
              const isUpdating = updatingJobs.has(jobKey);
              const customerName = customerNames[job.job_id] || "Loading...";
              const machineName = showMachine
                ? (machineNames[job.machine_id] || "Unassigned")
                : null;
              
              const isFullyCompleted = isJobFullyCompleted(job.job_id, job.sub_job_id);
              
              return (
                <div
                  key={job.id}
                  className={`grid ${showMachine ? "grid-cols-6" : "grid-cols-5"} items-center p-4 hover:bg-white/10 transition-all duration-200 border-b last:border-b-0 ${
                    isDark ? 'border-white/20' : 'border-white/20'
                  } ${isFullyCompleted ? 'bg-green-500/10' : ''}`}
                >
                  <p className={`text-sm font-medium ${
                    isDark ? 'text-white' : 'text-purple-900'
                  }`}>{job.job_id}</p>
                  
                  <p className={`text-sm ${
                    isDark ? 'text-white/90' : 'text-purple-900/90'
                  }`}>{customerName}</p>
                  
                  <p className={`text-sm ${
                    isDark ? 'text-white' : 'text-purple-900'
                  }`}>{job.sub_job_id}</p>
                  
                  {showMachine && (
                    <p className={`text-sm ${
                      isDark ? 'text-white' : 'text-purple-900'
                    }`}>{machineName}</p>
                  )}
                  
                  <div className="flex items-center">
                    <span
                      className={`px-3 py-1 text-sm rounded-full text-white text-center w-fit ${
                        job.status.toLowerCase() === "completed"
                          ? "bg-gradient-to-r from-green-600/80 to-emerald-600/80"
                          : "bg-gradient-to-r from-amber-600/80 to-orange-600/80"
                      } ${isUpdating ? "opacity-70" : ""}`}
                    >
                      {isUpdating ? "Updating..." : 
                        job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      {isFullyCompleted && job.status === "completed" && " ✓"}
                    </span>
                    {isUpdating && (
                      <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                  </div>

                  {job.status.toLowerCase() === "pending" ? (
                    <button
                      onClick={() => handleStatusChange(job.job_id, job.sub_job_id, job.machine_id)}
                      disabled={isUpdating}
                      className={`px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 ${
                        isUpdating 
                          ? "bg-gray-400 cursor-not-allowed" 
                          : "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {isUpdating ? "Updating..." : "Mark Completed"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 text-sm bg-gradient-to-r from-green-400/20 to-emerald-400/20 text-green-900 rounded-lg cursor-not-allowed border border-green-400/30 backdrop-blur-sm"
                    >
                      Completed by: {job.employee_code || "Unknown"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </PageLayout>
  );
}