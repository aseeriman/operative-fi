"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import RoleBasedNavbar from "@/components/RoleBasedNavbar";
import { useTheme } from "@/contexts/ThemeContext";

const COMPACT_GRID_STYLE = {
  gridTemplateColumns: '60px 140px 80px 220px 1fr',
};

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [processNames, setProcessNames] = useState({});
  const [subJobDescriptions, setSubJobDescriptions] = useState({});
  const [userEmployeeCode, setUserEmployeeCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerNames, setCustomerNames] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [viewMode, setViewMode] = useState("compact"); // 'compact' or 'detailed'
  const { isDark } = useTheme();

  // Get user employee code - FIXED
  const getUserEmployeeCode = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('employee_code')
          .eq('id', user.id)
          .single();
        
        if (profileError) throw profileError;
        
        if (profile && profile.employee_code) {
          setUserEmployeeCode(profile.employee_code);
          return profile.employee_code;
        }
      }
    } catch (err) {
      console.error("Error getting user employee code:", err);
    }
    return null;
  };

  // Fetch process names - FIXED
  const fetchProcessNames = async () => {
    try {
      const { data, error } = await supabase
        .from("processes")
        .select("process_id, process_name");

      if (error) {
        console.error("Error fetching process names:", error);
        return;
      }

      const processMap = {};
      data.forEach(process => {
        processMap[process.process_id] = process.process_name;
      });
      setProcessNames(processMap);
    } catch (err) {
      console.error("Error in fetchProcessNames:", err);
    }
  };

  // Fetch sub job descriptions - FIXED for description issue
  const fetchSubJobDescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("sub_job_cards")
        .select("sub_job_id, description, job_id");

      if (error) {
        console.error("Error fetching sub job descriptions:", error);
        return;
      }

      const descriptionMap = {};
      data.forEach(subJob => {
        // Unique key using both job_id and sub_job_id to avoid description conflicts
        descriptionMap[`${subJob.job_id}-${subJob.sub_job_id}`] = subJob.description;
      });
      setSubJobDescriptions(descriptionMap);
    } catch (err) {
      console.error("Error in fetchSubJobDescriptions:", err);
    }
  };

  // Fetch customer names - FIXED
  const fetchCustomerNames = async (jobIds) => {
    try {
      if (jobIds.length === 0) return;
      
      const { data, error } = await supabase
        .from("job_cards")
        .select("job_id, customer_name")
        .in("job_id", jobIds);

      if (error) {
        console.error("Error fetching customer names:", error);
        return;
      }

      const customerMap = {};
      data.forEach(job => {
        customerMap[job.job_id] = job.customer_name;
      });
      setCustomerNames(customerMap);
    } catch (err) {
      console.error("Error in fetchCustomerNames:", err);
    }
  };

  // Fetch reports - FIXED with better error handling
  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("job_processes")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching reports:", error);
        alert("Error loading reports: " + error.message);
        return;
      }

      const mapped = data.map((row) => ({
        id: row.id,
        jobId: row.job_id,
        subJobId: row.sub_job_id,
        processId: row.process_id,
        status: row.status,
        employeeCode: row.employee_code,
        updatedAt: row.updated_at,
        completedBy: row.status === "completed" && row.employee_code 
          ? `${row.employee_code} (${new Date(row.updated_at).toLocaleString()})` 
          : "Not completed"
      }));

      setReports(mapped);
      setAllReports(mapped);
      
      const uniqueJobIds = [...new Set(mapped.map(report => report.jobId))];
      fetchCustomerNames(uniqueJobIds);
    } catch (err) {
      console.error("Error in fetchReports:", err);
      alert("Error loading reports: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Search function - FIXED
  const handleSearch = (term) => {
    setSearchTerm(term);
    
    if (!term.trim()) {
      setReports(allReports);
      return;
    }

    const filtered = allReports.filter(report => 
      report.jobId.toLowerCase().includes(term.toLowerCase()) ||
      (customerNames[report.jobId] && 
       customerNames[report.jobId].toLowerCase().includes(term.toLowerCase()))
    );
    
    setReports(filtered);
  };

  // Toggle row expand - FIXED
  const toggleRowExpand = (jobId, subJobId) => {
    const key = `${jobId}-${subJobId}`;
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Real-time subscription - FIXED
  useEffect(() => {
    const initializeData = async () => {
      await getUserEmployeeCode();
      await fetchProcessNames();
      await fetchSubJobDescriptions();
      await fetchReports();
    };

    initializeData();

    // Real-time subscription
    const channel = supabase
      .channel("reports-real-time")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "job_processes" 
        },
        (payload) => {
          console.log("Real-time update:", payload);
          fetchReports(); // Refresh data on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Group by job and sub-job for compact view
  const groupedBySubJob = reports.reduce((acc, report) => {
    const key = `${report.jobId}_${report.subJobId}`;
    if (!acc[key]) {
      acc[key] = {
        jobId: report.jobId,
        subJobId: report.subJobId,
        processes: [],
        customerName: customerNames[report.jobId] || "Loading..."
      };
    }
    acc[key].processes.push({
      processId: report.processId,
      status: report.status,
      completedBy: report.completedBy,
      processName: processNames[report.processId] || `Process ${report.processId}`
    });
    return acc;
  }, {});

  // Group for detailed view
  const groupedReports = reports.reduce((acc, report) => {
    if (!acc[report.jobId]) {
      acc[report.jobId] = {};
    }
    if (!acc[report.jobId][report.subJobId]) {
      acc[report.jobId][report.subJobId] = [];
    }
    acc[report.jobId][report.subJobId].push(report);
    return acc;
  }, {});

  // FIXED: Enhanced filter function for compact view with proper status filtering
  const subJobReports = Object.values(groupedBySubJob).filter(subJob => {
    const matchesSearch = searchTerm === "" || 
      subJob.jobId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subJob.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === "all") {
      return matchesSearch;
    }
    
    // Enhanced status filtering logic
    if (filter === "completed") {
      // Show only if ALL processes are completed
      const allCompleted = subJob.processes.every(process => 
        process.status?.toLowerCase() === "completed"
      );
      return matchesSearch && allCompleted;
    }
    
    if (filter === "pending") {
      // Show only if ALL processes are pending
      const allPending = subJob.processes.every(process => 
        process.status?.toLowerCase() === "pending"
      );
      return matchesSearch && allPending;
    }
    
    return matchesSearch;
  });

  // FIXED: Enhanced filter function for detailed view
  const filteredGroupedReports = Object.keys(groupedReports).reduce((acc, jobId) => {
    const jobData = groupedReports[jobId];
    const filteredJob = {};
    
    Object.keys(jobData).forEach(subJobId => {
      let filteredSubJobs = jobData[subJobId];
      
      // Apply search filter first
      const customerName = customerNames[jobId] || "";
      const matchesSearch = searchTerm === "" || 
        jobId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) {
        return;
      }
      
      // Apply status filter with enhanced logic
      if (filter !== "all") {
        if (filter === "completed") {
          // Show only if ALL processes in the sub-job are completed
          const allCompleted = filteredSubJobs.every(
            (r) => r.status?.toLowerCase() === "completed"
          );
          if (!allCompleted) return;
        } else if (filter === "pending") {
          // Show only if ALL processes in the sub-job are pending
          const allPending = filteredSubJobs.every(
            (r) => r.status?.toLowerCase() === "pending"
          );
          if (!allPending) return;
        }
      }
      
      if (filteredSubJobs.length > 0) {
        filteredJob[subJobId] = filteredSubJobs;
      }
    });
    
    if (Object.keys(filteredJob).length > 0) {
      acc[jobId] = filteredJob;
    }
    
    return acc;
  }, {});

  if (loading) {
    return (
      <div className={`min-h-screen relative transition-colors duration-300 ${
        isDark 
          ? 'dark-theme bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800' 
          : 'light-theme'
      }`}>
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
          <div className={`absolute inset-0 ${
            isDark 
              ? 'bg-gradient-to-br from-gray-900/80 via-purple-900/60 to-gray-800/80' 
              : 'bg-gradient-to-br from-blue-400/20 via-purple-500/20 to-pink-400/20'
          }`}></div>
        </div>
        
        <div className="relative z-10">
          <RoleBasedNavbar />
          <div className="flex justify-center items-center h-64">
            <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Loading reports...</p>
          </div>
        </div>
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
        
        {/* Full width container with no max-width restriction */}
        <div className="w-full p-4">
          {/* Page Title and View Toggle */}
          <div className="flex justify-between items-center mb-4">
            <h1 className={`text-2xl font-bold drop-shadow-lg ${
              isDark ? 'text-white' : 'text-purple-900'
            }`}>
              Reports
            </h1>
            
            {/* View Mode Toggle */}
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 border backdrop-blur-sm ${
                  viewMode === "compact"
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg"
                    : isDark
                      ? "bg-white/20 text-white hover:bg-white/30 hover:shadow-md border-white/20"
                      : "bg-white/20 text-purple-900 hover:bg-white/30 hover:shadow-md border-white/20"
                }`}
                onClick={() => setViewMode("compact")}
              >
                Compact View
              </button>
              <button
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 border backdrop-blur-sm ${
                  viewMode === "detailed"
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg"
                    : isDark
                      ? "bg-white/20 text-white hover:bg-white/30 hover:shadow-md border-white/20"
                      : "bg-white/20 text-purple-900 hover:bg-white/30 hover:shadow-md border-white/20"
                }`}
                onClick={() => setViewMode("detailed")}
              >
                Detailed View
              </button>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className={`rounded-xl p-4 border shadow-2xl backdrop-blur-lg transition-all duration-300 ${
            isDark
              ? 'bg-black/40 border-purple-500/30 text-white'
              : 'bg-white/20 border-white/30 text-purple-900'
          }`}>
            {/* Search and Filter Section */}
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Job ID or Customer Name..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className={`w-full px-3 py-2 backdrop-blur-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-white/70 shadow-lg ${
                      isDark 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-white/20 border-white/30 text-purple-900'
                    }`}
                  />
                  <div className={`absolute right-3 top-2 ${
                    isDark ? 'text-white/70' : 'text-purple-900/70'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1">
                {["all", "pending", "completed"].map((tab) => (
                  <button
                    key={tab}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 border backdrop-blur-sm ${
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

            {/* COMPACT VIEW - Horizontal Scroll */}
            {viewMode === "compact" && (
              <div className={`rounded-lg border overflow-hidden shadow-2xl w-full ${
                isDark ? 'bg-white/10 border-white/30' : 'bg-white/20 border-white/30'
              }`}>
                {/* Header Row - Fixed alignment */}
                <div 
                  className="grid p-3 font-semibold border-b bg-white/30 border-white/30 text-purple-900"
                  style={COMPACT_GRID_STYLE}
                >
                  <div className="text-sm flex items-center justify-center">Job ID</div>
                  <div className="text-sm flex items-center justify-center">Customer</div>
                  <div className="text-sm flex items-center justify-center">Sub Job</div>
                  <div className="text-sm flex items-center justify-center">Description</div>
                  <div className="text-sm flex items-center justify-center">Processes & Status</div>
                </div>

                {/* Data Rows - Compact design */}
                {subJobReports.length === 0 ? (
                  <div className={`p-6 text-center bg-white/10 ${
                    isDark ? 'text-white/70' : 'text-purple-900/70'
                  }`}>
                    {searchTerm ? `No results found for "${searchTerm}"` : "No reports found for the selected filter."}
                  </div>
                ) : (
                  subJobReports.map((subJob) => {
                    const descriptionKey = `${subJob.jobId}-${subJob.subJobId}`;
                    const description = subJobDescriptions[descriptionKey] || "No description";
                    
                    return (
                      <div 
                        key={descriptionKey} 
                        className="grid p-2 items-center hover:bg-white/10 border-b border-white/10 last:border-b-0 gap-2"
                        style={COMPACT_GRID_STYLE}
                      >
                        {/* Job ID */}
                        <div className="w-full flex justify-center">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-2 border border-white/20 h-full min-h-[80px] flex items-center justify-center w-full">
                            <span className={`text-xs font-medium text-center break-words ${
                              isDark ? 'text-white' : 'text-purple-900'
                            }`}>
                              {subJob.jobId}
                            </span>
                          </div>
                        </div>
                        
                        {/* Customer Name */}
                        <div className="w-full flex justify-center">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-3 border border-white/20 h-full min-h-[80px] flex items-center justify-center w-full">
                            <span className={`text-xs font-medium text-center break-words ${
                              isDark ? 'text-white' : 'text-purple-900'
                            }`}>
                              {subJob.customerName}
                            </span>
                          </div>
                        </div>
                        
                        {/* Sub Job ID */}
                        <div className="w-full flex justify-center">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-2 border border-white/20 h-full min-h-[80px] flex items-center justify-center w-full">
                            <span className={`text-xs font-medium text-center break-words ${
                              isDark ? 'text-white' : 'text-purple-900'
                            }`}>
                              {subJob.subJobId}
                            </span>
                          </div>
                        </div>
                        
                        {/* Description */}
                        <div className="w-full flex justify-center">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-3 border border-white/20 h-full min-h-[80px] flex items-center justify-center w-full">
                            <span className={`text-xs text-center break-words ${
                              isDark ? 'text-white/90' : 'text-purple-900/90'
                            }`}>
                              {description}
                            </span>
                          </div>
                        </div>
                        
                        {/* Processes - Horizontal scroll */}
                        <div className="overflow-x-auto">
                          <div className="flex gap-2 min-w-max">
                            {subJob.processes.map((process, index) => (
                              <div 
                                key={index} 
                                className="flex flex-col gap-1 min-w-[120px] bg-white/20 backdrop-blur-sm rounded-lg px-3 py-3 border border-white/20 flex-shrink-0 h-full min-h-[80px] justify-between"
                              >
                                <span className={`text-xs font-semibold text-center break-words ${
                                  isDark ? 'text-white' : 'text-purple-900'
                                }`}>
                                  {process.processName}
                                </span>
                                <div className="flex flex-col gap-1">
                                  <span className={`px-2 py-1 text-xs rounded-full font-medium text-center ${
                                    process.status?.toLowerCase() === "completed"
                                      ? "bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white"
                                      : "bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white"
                                  }`}>
                                    {process.status}
                                  </span>
                                  {process.status === "completed" && (
                                    <span className={`text-[10px] text-center break-words ${
                                      isDark ? 'text-white/70' : 'text-purple-900/70'
                                    }`}>
                                      {process.completedBy}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* DETAILED VIEW - Dropdown Expandable */}
            {viewMode === "detailed" && (
              <div className={`backdrop-blur-lg rounded-lg border overflow-hidden shadow-2xl ${
                isDark ? 'bg-white/20 border-white/30' : 'bg-white/20 border-white/30'
              }`}>
                {/* Header Row - 6 columns */}
                <div className={`grid grid-cols-6 backdrop-blur-sm p-4 font-semibold border-b ${
                  isDark 
                    ? 'bg-white/30 text-purple-900 border-white/30' 
                    : 'bg-white/30 text-purple-900 border-white/30'
                }`}>
                  <div className="flex items-center justify-center">Job ID</div>
                  <div className="flex items-center justify-center">Customer</div>
                  <div className="flex items-center justify-center">Sub Job</div>
                  <div className="flex items-center justify-center">Description</div>
                  <div className="flex items-center justify-center">Status</div>
                  <div className="flex items-center justify-center">Completed By</div>
                </div>

                {/* Data Rows */}
                {Object.keys(filteredGroupedReports).length === 0 ? (
                  <div className={`p-8 text-center bg-white/10 ${
                    isDark ? 'text-white/70' : 'text-purple-900/70'
                  }`}>
                    {searchTerm ? `No results found for "${searchTerm}"` : "No reports found for the selected filter."}
                  </div>
                ) : (
                  Object.keys(filteredGroupedReports).map((jobId) => {
                    const jobSubJobs = filteredGroupedReports[jobId];
                    const subJobIds = Object.keys(jobSubJobs);
                    const customerName = customerNames[jobId] || "Loading...";
                    
                    return (
                      <div key={jobId} className={`border-b last:border-b-0 ${
                        isDark ? 'border-purple-900/20' : 'border-white/20'
                      }`}>
                        {/* Job Header */}
                        <div className="bg-white/10 backdrop-blur-sm p-3 flex justify-between items-center">
                          <div>
                            <span className={`font-semibold ${
                              isDark ? 'text-white' : 'text-purple-900'
                            }`}>Job ID: {jobId}</span>
                            <span className={`ml-4 ${
                              isDark ? 'text-white/90' : 'text-purple-900/90'
                            }`}>Customer: {customerName}</span>
                          </div>
                          <span className={`text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm ${
                            isDark ? 'text-purple-900' : 'text-purple-900'
                          }`}>
                            {subJobIds.length} sub-job(s)
                          </span>
                        </div>
                        
                        {/* Sub Jobs */}
                        {subJobIds.map((subJobId) => {
                          const subJobReports = jobSubJobs[subJobId];
                          const descriptionKey = `${jobId}-${subJobId}`;
                          const description = subJobDescriptions[descriptionKey] || "No description";
                          const isExpanded = expandedRows[`${jobId}-${subJobId}`];
                          
                          return (
                            <div key={subJobId}>
                              {/* Main Row - Only show once per sub job */}
                              <div 
                                className="grid grid-cols-6 p-4 items-center hover:bg-white/10 border-t border-white/10 cursor-pointer transition-all duration-200"
                                onClick={() => toggleRowExpand(jobId, subJobId)}
                              >
                                {/* Job ID - Show only once */}
                                <div className={`text-sm font-medium flex items-center justify-center ${
                                  isDark ? 'text-white' : 'text-purple-900'
                                }`}>
                                  {jobId}
                                </div>
                                
                                {/* Customer Name - Show only once */}
                                <div className={`text-sm font-medium flex items-center justify-center ${
                                  isDark ? 'text-white' : 'text-purple-900'
                                }`}>
                                  {customerName}
                                </div>
                                
                                {/* Sub Job ID - Show only once */}
                                <div className={`text-sm font-medium flex items-center justify-center ${
                                  isDark ? 'text-white' : 'text-purple-900'
                                }`}>
                                  {subJobId}
                                </div>
                                
                                {/* Description - Show only once */}
                                <div className={`text-sm flex items-center justify-center ${
                                  isDark ? 'text-white/90' : 'text-purple-900/90'
                                }`}>
                                  {description}
                                </div>
                                
                                {/* Status with dropdown icon */}
                                <div className="flex items-center justify-center gap-2">
                                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                                    subJobReports.every(r => r.status?.toLowerCase() === "completed")
                                      ? "bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white"
                                      : subJobReports.some(r => r.status?.toLowerCase() === "completed")
                                      ? "bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white"
                                      : "bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white"
                                  }`}>
                                    {subJobReports.every(r => r.status?.toLowerCase() === "completed") 
                                      ? "All Completed" 
                                      : subJobReports.some(r => r.status?.toLowerCase() === "completed")
                                      ? "Partial" 
                                      : "All Pending"}
                                  </span>
                                  <svg 
                                    className={`w-4 h-4 transform transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180' : ''
                                    } ${isDark ? 'text-white' : 'text-purple-900'}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                                
                                {/* Completed By - Summary */}
                                <div className={`text-xs flex items-center justify-center ${
                                  isDark ? 'text-white/80' : 'text-purple-900/80'
                                }`}>
                                  {subJobReports.filter(r => r.status === "completed").length} of {subJobReports.length} completed
                                </div>
                              </div>

                              {/* Expanded Details - Show all processes */}
                              {isExpanded && (
                                <div className="bg-white/5 border-t border-white/10">
                                  <div className="p-4">
                                    <h4 className={`font-semibold mb-3 ${
                                      isDark ? 'text-white' : 'text-purple-900'
                                    }`}>
                                      Process Details for Sub Job {subJobId}
                                    </h4>
                                    
                                    {/* Process Details */}
                                    {subJobReports.map((processReport, processIndex) => (
                                      <div 
                                        key={processReport.id}
                                        className={`grid grid-cols-6 p-3 items-center border-b ${
                                          isDark ? 'border-white/10' : 'border-purple-900/10'
                                        } ${processIndex % 2 === 0 ? 'bg-white/5' : ''}`}
                                      >
                                        {/* Empty for Job ID */}
                                        <div></div>
                                        
                                        {/* Empty for Customer */}
                                        <div></div>
                                        
                                        {/* Empty for Sub Job */}
                                        <div></div>
                                        
                                        {/* Process Name (now aligns with Description column) */}
                                        <div className={`text-sm font-medium flex items-center justify-center ${
                                          isDark ? 'text-white' : 'text-purple-900'
                                        }`}>
                                          {processNames[processReport.processId] || `Process ${processReport.processId}`}
                                        </div>
                                        
                                        {/* Status */}
                                        <div className="flex items-center justify-center gap-2">
                                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                                            processReport.status?.toLowerCase() === "completed"
                                              ? "bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white"
                                              : "bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white"
                                          }`}>
                                            {processReport.status}
                                          </span>
                                        </div>
                                        
                                        {/* Completed By */}
                                        <div className={`text-xs flex items-center justify-center ${
                                          isDark ? 'text-white/80' : 'text-purple-900/80'
                                        }`}>
                                          {processReport.completedBy}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}