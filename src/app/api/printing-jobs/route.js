import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET() {
  try {
    // Job + Machine join
    const { data, error } = await supabase
      .from("job_processes")
      .select(`
        id,
        job_id,
        sub_job_id,
        status,
        machine_id,
        machines!job_processes_machine_id_fkey (
          name,
          size,
          capacity
        )
      `);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Machine-wise grouping
    const grouped = {};
    data.forEach((job) => {
      const machineId = job.machine_id;
      const machineName = job.machines?.name || "Unknown Machine";

      if (!grouped[machineId]) {
        grouped[machineId] = {
          id: machineId,
          name: machineName,
          jobs: [],
        };
      }

      grouped[machineId].jobs.push({
        id: job.id,
        jobId: job.job_id,
        subJobId: job.sub_job_id,
        status: job.status,
      });
    });

    return NextResponse.json({ machines: Object.values(grouped) });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}