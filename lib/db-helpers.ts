import { getSupabaseAdmin } from './supabase';

export interface SaveDoubtParams {
  userId: string;
  question: string;
  subject: string;
  response: string;
  inputType: 'text' | 'photo' | 'voice';
}

export async function saveDoubtAndIncrementSession({
  userId,
  question,
  subject,
  response,
  inputType
}: SaveDoubtParams) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Save doubt
    const { data: doubtData, error: doubtError } = await supabaseAdmin
      .from('doubts')
      .insert({
        user_id: userId,
        question,
        subject,
        response,
        input_type: inputType
      })
      .select()
      .single();

    if (doubtError) {
      console.error('Error saving doubt to database:', doubtError);
    }

    // 2. Increment session doubt count
    const today = new Date().toISOString().split('T')[0];
    const { data: sessData } = await supabaseAdmin
      .from('sessions')
      .select('id, doubt_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (sessData) {
      await supabaseAdmin
        .from('sessions')
        .update({ doubt_count: sessData.doubt_count + 1 })
        .eq('id', sessData.id);
    } else {
      await supabaseAdmin
        .from('sessions')
        .insert({
          user_id: userId,
          date: today,
          doubt_count: 1
        });
    }

    // 3. Increment XP in Supabase
    const xpGain = inputType === 'voice' ? 20 : inputType === 'photo' ? 15 : 10;
    try {
      if (userId && !userId.startsWith('local-')) {
        const { error: xpError } = await supabaseAdmin.rpc('increment_xp', {
          user_id_param: userId,
          xp_amount: xpGain
        });
        if (xpError) {
          console.warn('Error calling increment_xp RPC:', xpError.message);
        }
      }
    } catch (e) {
      console.warn('Failed to increment XP in DB:', e);
    }

    // 4. Update Streak in Supabase
    try {
      if (userId && !userId.startsWith('local-')) {
        const { error: streakError } = await supabaseAdmin.rpc('update_streak', {
          user_id_param: userId
        });
        if (streakError) {
          console.warn('Error calling update_streak RPC:', streakError.message);
        }
      }
    } catch (e) {
      console.warn('Failed to update streak in DB:', e);
    }

    return doubtData;
  } catch (err) {
    console.error('Database helper crash:', err);
    return null;
  }
}
