"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import PageLayout from "@/components/PageLayout";
import { useTheme } from "@/contexts/ThemeContext";

export default function JobStatus() {
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [processNames, setProcessNames] = useState({});
  const [subJobDescriptions, setSubJobDescriptions] = useState({});
  const [userEmployeeCode, setUserEmployeeCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerNames, setCustomerNames] = useState({});
  const { isDark } = useTheme();

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

  const fetchSubJobDescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("sub_job_cards")
        .select("sub_job_id, description");

      if (error) {
        console.error("Error fetching sub job descriptions:", error);
        return;
      }

      const descriptionMap = {};
      data.forEach(subJob => {
        descriptionMap[subJob.sub_job_id] = subJob.description;
      });
      setSubJobDescriptions(descriptionMap);
    } catch (err) {
      console.error("Error in fetchSubJobDescriptions:", err);
    }
  };

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

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("job_processes")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching reports:", error);
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
    }
    setLoading(false);
  };

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

  const undoStatus = async (jobId, subJobId, processId, recordId) => {
    try {
      const { error } = await supabase
        .from("job_processes")
        .update({ 
          status: "pending",
          updated_at: new Date().toISOString(),
          employee_code: null
        })
        .eq("id", recordId);

      if (error) {
        console.error("Error updating status:", error);
        alert("Error undoing status: " + error.message);
        return;
      }

      alert("Status changed to pending successfully!");
      fetchReports();
    } catch (err) {
      console.error("Error in undo operation:", err);
      alert("Error: " + err.message);
    }
  };

  const completeStatus = async (jobId, subJobId, processId, recordId) => {
    try {
      if (!userEmployeeCode) {
        await getUserEmployeeCode();
        if (!userEmployeeCode) {
          alert("Error: Could not identify your employee code. Please refresh the page.");
          return;
        }
      }

      const updateData = { 
        status: "completed",
        updated_at: new Date().toISOString(),
        employee_code: userEmployeeCode
      };

      const { error } = await supabase
        .from("job_processes")
        .update(updateData)
        .eq("id", recordId);

      if (error) {
        console.error("Error updating status:", error);
        alert("Error completing status: " + error.message);
        return;
      }

      alert("Status changed to completed successfully!");
      fetchReports();
    } catch (err) {
      console.error("Error in complete operation:", err);
      alert("Error: " + err.message);
    }
  };

  useEffect(() => {
    getUserEmployeeCode();
    fetchProcessNames();
    fetchSubJobDescriptions();
    fetchReports();

    const channel = supabase
      .channel("reports-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_processes" },
        (payload) => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const filteredGroupedReports = Object.keys(groupedReports).reduce((acc, jobId) => {
    const jobData = groupedReports[jobId];
    const filteredJob = {};
    
    Object.keys(jobData).forEach(subJobId => {
      const filteredSubJobs = jobData[subJobId].filter(
        (r) => filter === "all" || r.status?.toLowerCase() === filter
      );
      
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
      <PageLayout title="Reports">
        <div className="flex justify-center items-center h-64">
          <p className={`${isDark ? 'text-white' : 'text-purple-900'}`}>Loading reports...</p>
        </div>
      </PageLayout>
    );
  }

  return (
<PageLayout title="Job Status Management">      
    <div className="p-6">
        {/* Search and Filter Section */}
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

        {/* Reports Table - Now 8 columns instead of 9 */}
        <div className={`backdrop-blur-lg rounded-lg border overflow-hidden shadow-2xl ${
          isDark ? 'bg-white/20 border-white/30' : 'bg-white/20 border-white/30'
        }`}>
          {/* Header Row - Updated to 8 columns */}
          <div className={`grid grid-cols-8 backdrop-blur-sm p-4 font-semibold border-b ${
            isDark 
              ? 'bg-white/30 text-purple-900 border-white/30' 
              : 'bg-white/30 text-purple-900 border-white/30'
          }`}>
            <div>Job ID</div>
            <div>Customer</div>
            <div>Sub Job</div>
            <div>Description</div>
            <div>Process</div>
            <div>Status</div>
            <div>Completed By</div>
            <div>Actions</div>
            {/* Details column removed */}
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
                    const description = subJobDescriptions[subJobId] || "No description";
                    
                    return subJobReports.map((report, index) => (
                      <div key={`${subJobId}-${index}`} className="grid grid-cols-8 p-4 items-center hover:bg-white/10 border-t border-white/10">
                        {/* Job ID */}
                        <div className={`text-sm font-medium ${
                          isDark ? 'text-white' : 'text-purple-900'
                        }`}>
                          {index === 0 ? jobId : ""}
                        </div>
                        
                        {/* Customer Name */}
                        <div className={`text-sm font-medium ${
                          isDark ? 'text-white' : 'text-purple-900'
                        }`}>
                          {index === 0 ? customerName : ""}
                        </div>
                        
                        {/* Sub Job ID */}
                        <div className={`text-sm font-medium ${
                          isDark ? 'text-white' : 'text-purple-900'
                        }`}>
                          {index === 0 ? subJobId : ""}
                        </div>
                        
                        {/* Description */}
                        <div className={`text-sm ${
                          isDark ? 'text-white/90' : 'text-purple-900/90'
                        }`}>
                          {index === 0 ? description : ""}
                        </div>
                        
                        {/* Process */}
                        <div className={`text-sm ${
                          isDark ? 'text-white' : 'text-purple-900'
                        }`}>
                          {processNames[report.processId] || `Process ${report.processId}`}
                        </div>
                        
                        {/* Status */}
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            report.status?.toLowerCase() === "completed"
                              ? "bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white"
                              : "bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white"
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        
                        {/* Completed By */}
                        <div className={`text-xs ${
                          isDark ? 'text-white/80' : 'text-purple-900/80'
                        }`}>
                          {report.status === "completed" ? report.completedBy : "Not completed"}
                        </div>
                        
                        {/* Actions - Only Undo/Complete buttons */}
                        <div>
                          {report.status?.toLowerCase() === "completed" ? (
                            <button
                              onClick={() => undoStatus(report.jobId, report.subJobId, report.processId, report.id)}
                              className="px-3 py-1 text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded hover:from-blue-600 hover:to-purple-600 transition-colors shadow-md"
                            >
                              Undo
                            </button>
                          ) : (
                            <button
                              onClick={() => completeStatus(report.jobId, report.subJobId, report.processId, report.id)}
                              className="px-3 py-1 text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded hover:from-green-600 hover:to-emerald-600 transition-colors shadow-md"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                        
                        {/* View Details Button COMPLETELY REMOVED */}
                      </div>
                    ));
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </PageLayout>
  );
}