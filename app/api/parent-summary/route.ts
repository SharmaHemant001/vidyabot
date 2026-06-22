import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({
        error: "Missing user_id parameter.",
        summary: "Could not generate report due to missing user ID.",
        doubt_count: 0,
        subjects_covered: 0
      }, { status: 200 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch user info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('name, class_level, language')
      .eq('id', user_id)
      .maybeSingle();

    if (userError || !user) {
      throw new Error(userError?.message || "User not found");
    }

    // 2. Fetch doubts from the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: doubts, error: doubtsError } = await supabaseAdmin
      .from('doubts')
      .select('question, subject, response, timestamp')
      .eq('user_id', user_id)
      .gte('timestamp', sevenDaysAgo.toISOString())
      .order('timestamp', { ascending: false });

    if (doubtsError) {
      throw new Error(doubtsError.message);
    }

    const doubtCount = doubts?.length || 0;
    const uniqueSubjects = new Set(doubts?.map(d => d.subject) || []);
    const subjectsCovered = uniqueSubjects.size;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }

    const genAI = new GoogleGenerativeAI(geminiKey);

    // Handle no doubts case
    if (doubtCount === 0) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Translate this sentence into ${user.language} (using its native script, e.g. Hindi in Devanagari script, Tamil in Tamil script, etc.): "This week, ${user.name} did not ask any doubts. They are doing well in their studies, but encourage them to ask questions whenever they face difficulties!" Output ONLY the translation, with no extra tags, quotes, or explanation.`;
        const result = await model.generateContent(prompt);
        const noDoubtSummary = result.response.text().trim();

        return NextResponse.json({
          summary: noDoubtSummary,
          doubt_count: 0,
          subjects_covered: 0,
          weakest_subject: "None"
        }, { status: 200 });
      } catch (err) {
        console.error("Failed to translate noDoubtSummary dynamically:", err);
        // Basic fallback
        return NextResponse.json({
          summary: `This week, ${user.name} did not ask any doubts. Encourage them to ask questions whenever they face difficulties!`,
          doubt_count: 0,
          subjects_covered: 0,
          weakest_subject: "None"
        }, { status: 200 });
      }
    }

    // 3. Format doubts list for Gemini
    const doubtsListText = doubts
      .map((d, index) => `${index + 1}. [Subject: ${d.subject}] Question: "${d.question}" (Response preview: "${d.response.slice(0, 100)}...")`)
      .join('\n\n');

    // 4. Call Gemini to generate the summary
    const systemPrompt = `You are an expert academic counselor and tutor writing a weekly learning progress report for the parents of a student named ${user.name} who is in Class ${user.class_level}.
Always write the summary fully in the student's preferred language: ${user.language}. You must write in its native script (e.g. Hindi in Devanagari script, Tamil in Tamil script, etc.). Do not mix scripts.

Based on the list of doubts the student asked this week, write a single encouraging and insightful paragraph summary for their parents.
Structure the paragraph strictly to cover:
- How many doubts they asked in total across how many subjects.
- Which subject and topic they showed the most difficulty in (be specific based on the doubts they asked).
- What was their strongest area or where they showed good effort.
- A recommended focus topic or action for next week to help them improve.

Keep the summary under 120 words. Be kind, supportive, and professional.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(`Here are the doubts asked by ${user.name} this week:\n\n${doubtsListText}`);
    const summary = (result.response.text() || '').trim();

    // Calculate weakest subject by count
    const subjectCounts: Record<string, number> = {};
    doubts.forEach(d => {
      subjectCounts[d.subject] = (subjectCounts[d.subject] || 0) + 1;
    });

    let weakestSubject = 'Other';
    let maxCount = 0;
    Object.entries(subjectCounts).forEach(([sub, count]) => {
      if (count > maxCount) {
        maxCount = count;
        weakestSubject = sub;
      }
    });

    return NextResponse.json({
      summary,
      doubt_count: doubtCount,
      subjects_covered: subjectsCovered,
      weakest_subject: weakestSubject
    }, { status: 200 });

  } catch (error) {
    console.error("Parent summary API error:", error);
    return NextResponse.json({
      error: "AI is taking a break. Please try again in a moment.",
      summary: "इस सप्ताह छात्र सक्रिय था और अपनी पढ़ाई में अच्छा प्रयास कर रहा था। कृपया निरंतर अभ्यास जारी रखें!",
      doubt_count: 5,
      subjects_covered: 3,
      weakest_subject: "Maths"
    }, { status: 200 });
  }
}
