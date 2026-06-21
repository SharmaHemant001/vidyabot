import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveDoubtAndIncrementSession } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const userId = formData.get('user_id') as string | null || formData.get('userId') as string | null;
    const classLevel = formData.get('class_level') as string | null || formData.get('classLevel') as string | null;
    const language = formData.get('language') as string | null;

    console.log("Voice route hit");
    if (audioFile) {
      console.log("Audio blob size:", audioFile.size);
      console.log("Audio mime type:", audioFile.type);
    }

    console.log("Language received:", language);
    console.log("Language passed to Gemini:", language);

    if (!audioFile || !userId || !classLevel || !language) {
      return NextResponse.json({
        error: "Missing required parameters.",
        response: "Sorry, I am missing some information about your request. Please try again!"
      }, { status: 200 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    console.log("OPENAI_API_KEY exists:", !!openaiKey);

    if (!openaiKey || !geminiKey) {
      throw new Error("Required API keys (OpenAI/Gemini) are not defined in environment variables");
    }

    // 1. Transcribe the audio using OpenAI Whisper
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let transcript = "";
    let whisperFailedWithQuota = false;
    let whisperErrorMsg = "";

    try {
      const mimeType = audioFile.type || 'audio/webm';
      const extension = mimeType.includes('mp4') ? 'mp4' : 
                        mimeType.includes('wav') ? 'wav' : 
                        mimeType.includes('ogg') ? 'ogg' : 'webm';
      
      const whisperFormData = new FormData();
      const audioBlob = new Blob([buffer], { type: mimeType });
      whisperFormData.append('file', audioBlob, `recording.${extension}`);
      whisperFormData.append('model', 'whisper-1');

      console.log("Sending to Whisper: recording." + extension, "size:", audioBlob.size, "mime:", mimeType);
      
      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`
        },
        body: whisperFormData
      });
      
      const whisperData = await whisperRes.json();
      
      if (!whisperRes.ok) {
        const errorDetail = whisperData.error?.message || JSON.stringify(whisperData);
        const isQuotaError = whisperRes.status === 429 || 
                             errorDetail.toLowerCase().includes("quota") || 
                             errorDetail.toLowerCase().includes("insufficient_quota");
        if (isQuotaError) {
          whisperFailedWithQuota = true;
          console.error("Whisper quota exceeded:", errorDetail);
        }
        throw new Error(`OpenAI Whisper API returned status ${whisperRes.status}: ${errorDetail}`);
      }
      
      transcript = (whisperData.text || "").trim();
      console.log("Transcript:", transcript);
    } catch (whisperError) {
      const errMsg = whisperError instanceof Error ? whisperError.message : String(whisperError);
      whisperErrorMsg = errMsg;
      const isQuotaError = errMsg.includes("429") || 
                           errMsg.toLowerCase().includes("quota") || 
                           errMsg.toLowerCase().includes("insufficient_quota");
      if (isQuotaError) {
        whisperFailedWithQuota = true;
        console.error("Whisper quota exceeded:", whisperError);
      } else {
        console.error("Whisper error:", whisperError);
      }
    }

    // A. Read the fallback transcript from client if available (Requirement 4)
    const browserTranscript = formData.get('browser_transcript') as string | null || formData.get('browserTranscript') as string | null;
    console.log("Fallback browser transcript received:", browserTranscript);

    if ((!transcript || whisperFailedWithQuota) && browserTranscript && browserTranscript.trim()) {
      console.log("Using browser speech recognition transcript fallback:", browserTranscript);
      transcript = browserTranscript.trim();
    }

    if (!transcript) {
      return NextResponse.json({
        response: "Voice transcription temporarily unavailable. Please type your question.",
        subject: "Other",
        error: whisperErrorMsg || "No transcript generated"
      }, { status: 200 });
    }

    // 2. Call Gemini to explain the doubt step-by-step
    const genAI = new GoogleGenerativeAI(geminiKey);
    const systemPrompt = `You are VidyaBot, a patient, kind, and encouraging AI tutor for Indian school students.

IMPORTANT:
Respond ONLY in ${language}.

Language rules:
* If language = English → answer only in English.
* If language = Hindi → answer only in Hindi.
* If language = Tamil → answer only in Tamil.
* If language = Telugu → answer only in Telugu.
* Never switch languages unless explicitly asked.
* Do not mix Hindi and English.
* The selected language is mandatory.

Student Class: ${classLevel}

SUBJECT DETECTION: First identify which subject this question belongs to: Maths, Science, English, Social Studies, or Other. Start your response with [SUBJECT: X] on the first line.

EXPLANATION STYLE:
- Explain step-by-step, like a kind teacher sitting next to the student
- Use real-life Indian examples: cricket for statistics, dal-chawal for fractions, train journeys for speed/distance, monsoon for water cycle, market prices for percentages
- Never just give the final answer — always explain WHY
- Keep explanations under 200 words — short and clear beats long and complex
- End every response with an encouraging line in the student's language

RE-EXPLAIN MODE: If the student says anything like "samajh nahi aaya", "didn't understand", "explain again", "ek baar aur", "once more", "confusing", "पुரியவில்லை", "అర్థం కాలేదు", "বুঝলাম না" — you MUST re-explain using a COMPLETELY DIFFERENT analogy. Never repeat the same example.

TONE: Warm, patient, never condescending. You are the best teacher the student has ever had.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(transcript);
    let responseText = result.response.text() || '';

    // Response Validation (Requirement 6)
    if (language === "English" && /[\u0900-\u097F]/.test(responseText)) {
      console.log("Validation Failed (Voice doubt): Hindi character detected in English response. Regenerating...");
      const strictResult = await model.generateContent(
        `${transcript}\n\n[SYSTEM NOTE: Your previous answer contained Hindi characters. You must respond ONLY in English. Do not use Hindi script or words.]`
      );
      responseText = strictResult.response.text() || responseText;
    }

    // Regex subject extraction
    const subjectMatch = responseText.match(/\[SUBJECT:\s*([^\]\n]+)\]/i);
    const rawSubject = subjectMatch ? subjectMatch[1].trim() : 'Other';

    // Clean subject
    const allowedSubjects = ['Maths', 'Science', 'English', 'Social Studies', 'Other'];
    let subject = 'Other';
    for (const sub of allowedSubjects) {
      if (rawSubject.toLowerCase().includes(sub.toLowerCase())) {
        subject = sub;
        break;
      }
    }
    if (rawSubject.toLowerCase().includes('social')) {
      subject = 'Social Studies';
    }

    // Strip [SUBJECT: X] line
    const cleanResponse = responseText.replace(/\[SUBJECT:\s*[^\]\n]+\]\n?/i, '').trim();

    // 3. Generate Audio via ElevenLabs (optional, handles error gracefully)
    let audioBase64 = null;
    if (elevenLabsKey) {
      try {
        // Rachel voice ID: 21m00Tcm4TlvDq8ikWAM (supports multilingual)
        const voiceId = "21m00Tcm4TlvDq8ikWAM";
        const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        
        const ttsResponse = await fetch(ttsUrl, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: cleanResponse,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (ttsResponse.ok) {
          const ttsArrayBuffer = await ttsResponse.arrayBuffer();
          const ttsBuffer = Buffer.from(ttsArrayBuffer);
          audioBase64 = ttsBuffer.toString('base64');
        } else {
          console.warn("ElevenLabs returned non-ok status:", ttsResponse.status, ttsResponse.statusText);
        }
      } catch (ttsError) {
        console.error("ElevenLabs speech synthesis error:", ttsError);
      }
    }

    // Save to database
    await saveDoubtAndIncrementSession({
      userId,
      question: transcript,
      subject,
      response: cleanResponse,
      inputType: 'voice'
    });

    return NextResponse.json({
      transcript,
      response: cleanResponse,
      audio_base64: audioBase64,
      subject
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Voice doubt error:', message);
    return NextResponse.json({
      response: 'Voice transcription unavailable. Please type your question.',
      subject: 'Other',
      error: message
    }, { status: 200 });
  }
}
