import { supabase } from '@/lib/supabase-browser';

export const generateJobReport = async (jobCardId) => {
  try {
    const { data: reportData, error } = await supabase
      .from('reports')
      .insert({
        job_card_id: jobCardId,
        report_data: {
          generated_at: new Date().toISOString(),
          report_type: 'job_summary'
        },
        generated_by: (await supabase.auth.getUser()).data.user.id
      })
      .select(`
        id,
        job_card_id,
        report_data,
        created_at,
        job_cards:job_card_id (job_id, customer_name)
      `)
      .single();

    if (error) throw error;
    return reportData;

  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
};

export const getJobReport = async (jobCardId) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        job_cards:job_card_id (*),
        sub_job_cards:sub_job_card_id (*),
        processes:process_id (*)
      `)
      .eq('job_card_id', jobCardId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;

  } catch (error) {
    console.error('Error fetching report:', error);
    throw error;
  }
};