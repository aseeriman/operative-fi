"use client";
import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { supabase } from "@/lib/supabase-browser";
import { useTheme } from "@/contexts/ThemeContext";

export default function Lamination() {
  const [laminationType, setLaminationType] = useState("matte");
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [userEmployeeCode, setUserEmployeeCode] = useState("");
  const [updatingJobs, setUpdatingJobs] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [customerNames, setCustomerNames] = useState({});
  const { isDark } = useTheme();

  // Process IDs for different types
  const processIds = {
    matte: 15,
    shine: 16
  };

  const getUserEmployeeCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('employee_code')
          .eq('id', user.id)
          .single();
        
        if (profile && profile.employee_code) {
          setUserEmployeeCode(profile.employee_code);
        }
      }
    } catch (err) {
      console.error("Error getting user employee code:", err);
    }
  };

  const fetchCustomerNames = async (jobIds) => {
    try {
      if (jobIds.length === 0) return;
      
      const { data, error } = await supabase
        .from("job_cards")
        .select("job_id, customer_name")
        .in("job_id", jobIds);

      if (error) return;

      const customerMap = {};
      data.forEach(job => {
        customerMap[job.job_id] = job.customer_name;
      });
      setCustomerNames(customerMap);
    } catch (err) {
      console.error("Error in fetchCustomerNames:", err);
    }
  };

  const fetchJobs = async () => {
    const currentProcessId = processIds[laminationType];
    const { data, error } = await supabase
      .from("job_processes")
      .select("*")
      .eq("process_id", currentProcessId);

    if (!error) {
      setJobs(data);
      setAllJobs(data);
      
      const uniqueJobIds = [...new Set(data.map(job => job.job_id))];
      fetchCustomerNames(uniqueJobIds);
    }
    setLoading(false);
  };

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

  const handleStatusChange = async (jobId, subJobId) => {
    if (!userEmployeeCode) {
      alert("Error: Could not identify your employee code.");
      return;
    }

    const jobKey = `${jobId}-${subJobId}`;
    setUpdatingJobs(prev => new Set(prev).add(jobKey));
    
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.job_id === jobId && job.sub_job_id === subJobId
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
      const currentProcessId = processIds[laminationType];
      const { error } = await supabase
        .from("job_processes")
        .update({ 
          status: "completed",
          employee_code: userEmployeeCode,
          updated_at: new Date().toISOString()
        })
        .eq("job_id", jobId)
        .eq("sub_job_id", subJobId)
        .eq("process_id", currentProcessId);

      if (error) {
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
      fetchJobs();
      setUpdatingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobKey);
        return newSet;
      });
    }
  };

  useEffect(() => {
    getUserEmployeeCode();
    fetchJobs();

    const channel = supabase
      .channel("job_processes_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_processes" },
        (payload) => {
          fetchJobs();
          if (payload.new && payload.new.job_id && payload.new.sub_job_id) {
            const jobKey = `${payload.new.job_id}-${payload.new.sub_job_id}`;
            setUpdatingJobs(prev => {
              const newSet = new Set(prev);
              newSet.delete(jobKey);
              return newSet;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [laminationType]);

  const filteredJobs = filter === "all" ? jobs : jobs.filter((j) => j.status.toLowerCase() === filter);

  if (loading) {
    return (
      <PageLayout title="Lamination">
        <div className="flex justify-center items-center h-64">
          <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Loading jobs...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Lamination">
      <div className="p-6">
        {/* Type Selector Tabs */}
        <div className="flex gap-4 mb-6">
          <div className="flex gap-2">
            {["matte", "shine"].map((type) => (
              <button
                key={type}
                className={`px-5 py-2 rounded-full font-medium transition-all duration-200 border backdrop-blur-sm ${
                  laminationType === type
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg"
                    : isDark
                      ? "bg-white/20 text-white hover:bg-white/30 hover:shadow-md border-white/20"
                      : "bg-white/20 text-purple-900 hover:bg-white/30 hover:shadow-md border-white/20"
                }`}
                onClick={() => setLaminationType(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)} Lamination
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
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

        {/* Table */}
        <div className={`backdrop-blur-lg overflow-hidden rounded-lg border shadow-2xl ${
          isDark ? 'bg-white/20 border-white/30' : 'bg-white/20 border-white/30'
        }`}>
          {/* Header */}
          <div className={`grid grid-cols-5 font-semibold backdrop-blur-sm p-4 border-b ${
            isDark 
              ? 'bg-white/30 text-purple-900 border-white/30' 
              : 'bg-white/30 text-purple-900 border-white/30'
          }`}>
            <p>Job ID</p>
            <p>Customer</p>
            <p>Sub Job</p>
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
              const jobKey = `${job.job_id}-${job.sub_job_id}`;
              const isUpdating = updatingJobs.has(jobKey);
              const customerName = customerNames[job.job_id] || "Loading...";
              
              return (
                <div
                  key={job.id}
                  className={`grid grid-cols-5 items-center p-4 hover:bg-white/10 transition-all duration-200 border-b last:border-b-0 ${
                    isDark ? 'border-white/20' : 'border-white/20'
                  }`}
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
                    </span>
                    {isUpdating && (
                      <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                  </div>

                  {job.status.toLowerCase() === "pending" ? (
                    <button
                      onClick={() => handleStatusChange(job.job_id, job.sub_job_id)}
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