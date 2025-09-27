import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Received data:', body);

    if (!body.user_uid) {
      return NextResponse.json({ error: 'User UID is required' }, { status: 400 });
    }

    console.log('Fetching profile for user_uid:', body.user_uid);

    // ✅ Profile fetch karein
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, employee_code')
      .eq('id', body.user_uid)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 });
    }

    console.log('User profile found:', userProfile);

    const createdByUUID = userProfile.id;
    const employeeCodeString = userProfile.employee_code;

    console.log('Using created_by (UUID):', createdByUUID);
    console.log('Employee code (string):', employeeCodeString);

    // 1. Insert into job_cards
    const { data: jobData, error: jobError } = await supabase
      .from('job_cards')
      .insert({
        job_id: body.job_id,
        customer_name: body.customer_name,
        start_date: body.start_date,
        required_date: body.required_date,
        created_by: createdByUUID,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job card error:', jobError);
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    // Agar sub_jobs nahi hain to return kar do
    if (!body.sub_jobs || body.sub_jobs.length === 0) {
      return NextResponse.json(
        {
          message: 'Job card created successfully (no sub jobs)',
          job_id: jobData.job_id,
          job_code: jobData.job_code,
        },
        { status: 201 }
      );
    }

    // 2. Insert into sub_job_cards
    const subJobsToInsert = body.sub_jobs.map((sub) => ({
      sub_job_id: sub.sub_job_id,
      job_id: jobData.job_id,
      job_code: jobData.job_code,
      description: sub.description,
      color: sub.color,
      card_size: sub.card_size,
      card_quantity: sub.card_quantity,
      item_quantity: sub.item_quantity,
    }));

    console.log('Sub jobs to insert:', subJobsToInsert);

    const { data: subJobData, error: subJobError } = await supabase
      .from('sub_job_cards')
      .insert(subJobsToInsert)
      .select();

    if (subJobError) {
      console.error('Sub job error:', subJobError);
      await supabase.from('job_cards').delete().eq('job_id', jobData.job_id);
      return NextResponse.json({ error: subJobError.message }, { status: 500 });
    }

    console.log('Sub jobs created successfully:', subJobData);

    // 3. Process the selected tasks for each sub job WITH MACHINE ID
    const jobProcesses = [];

    for (const subJob of body.sub_jobs) {
      if (subJob.processes) {
        const selectedProcesses = Object.entries(subJob.processes)
          .filter(([_, isSelected]) => isSelected)
          .map(([processName]) => processName);

        console.log('Selected processes for sub job:', subJob.sub_job_id, selectedProcesses);

        if (selectedProcesses.length > 0) {
          const { data: processesData, error: processesError } = await supabase
            .from('processes')
            .select('process_id, process_name')
            .in('process_name', selectedProcesses);

          if (processesError) {
            console.error('Processes error:', processesError);
            continue;
          }

          console.log('Found processes in DB:', processesData);

          const insertedSubJob = subJobData.find(
            (sj) => sj.sub_job_id === subJob.sub_job_id
          );

          if (insertedSubJob) {
            for (const process of processesData) {
              // ✅ MACHINE ID EXTRACT KAREIN
              // Frontend se machine_id array mein aata hai: subJob.machine_id
              let machineId = null;
              
              // Agar machine_id array hai aur usme values hain
              if (subJob.machine_id && Array.isArray(subJob.machine_id) && subJob.machine_id.length > 0) {
                // Process-specific machine ID find karein
                // Maan lein ke machine_id array mein objects hain: [{process: 'Printing', machine: '1'}, ...]
                const machineForProcess = subJob.machine_id.find(m => m.process === process.process_name);
                if (machineForProcess) {
                  machineId = machineForProcess.machine;
                }
                // Ya simple array mein direct machine IDs hain
                else if (subJob.machine_id[0]) {
                  machineId = subJob.machine_id[0]; // Pehli machine ID use karein
                }
              }
              
              // Agar koi machine ID nahi mili, toh default logic
              if (!machineId) {
                // Aapke existing data ke hisab se default machine IDs
                const defaultMachineMap = {
                  'Pre_Press': '1',
                  'Printing': '1', 
                  'Card_Cutting': '1',
                  'Varnish: Shine': '1',
                  'Lamination: Matte': '1',
                  'Joint': '1',
                  'Die_Cutting': '1',
                  'Foil': '1',
                  'Pasting': '1',
                  'Screen_Printing': '1',
                  'Embose': '1',
                  'Double_Tape': '1',
                  'Sorting': '1'
                };
                machineId = defaultMachineMap[process.process_name] || null;
              }

              jobProcesses.push({
                sub_job_id: insertedSubJob.sub_job_id,
                job_id: jobData.job_id,
                process_id: process.process_id,
                status: 'pending',
                machine_id: machineId, // ✅ MACHINE ID ADD KAREIN
              });
            }
          }
        }
      }
    }

    // 4. Insert all job_processes entries WITH MACHINE ID
    if (jobProcesses.length > 0) {
      console.log('Inserting job processes with machine IDs:', jobProcesses);

      const jobProcessesWithDefaults = jobProcesses.map(process => ({
        sub_job_id: process.sub_job_id,
        job_id: process.job_id,
        process_id: process.process_id,
        status: 'pending',
        employee_code: employeeCodeString,
        assigned_to: null,
        start_time: null,
        end_time: null,
        notes: null,
        machine_id: process.machine_id, // ✅ MACHINE ID YAHAN BHI
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      console.log('Job processes with machine_id:', jobProcessesWithDefaults);

      const { error: jobProcessError } = await supabase
        .from('job_processes')
        .insert(jobProcessesWithDefaults);

      if (jobProcessError) {
        console.error('Job process error:', jobProcessError);
        
        // Rollback
        await supabase.from('sub_job_cards').delete().eq('job_id', jobData.job_id);
        await supabase.from('job_cards').delete().eq('job_id', jobData.job_id);
        
        return NextResponse.json(
          { error: `Job processes creation failed: ${jobProcessError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        message: 'Job card created successfully with machine IDs',
        job_id: jobData.job_id,
        job_code: jobData.job_code,
        sub_jobs_count: subJobData.length,
        processes_count: jobProcesses.length,
        created_by: createdByUUID,
        employee_code: employeeCodeString
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}