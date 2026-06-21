import { NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveDoubtAndIncrementSession } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const userId = formData.get('user_id') as string | null || formData.get('userId') as string | null;
    const classLevel = formData.get('class_level') as string | null || formData.get('classLevel') as string | null;
    const language = formData.get('language') as string | null;

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

    if (!openaiKey || !geminiKey) {
      throw new Error("Required API keys (OpenAI/Gemini) are not defined in environment variables");
    }

    // 1. Transcribe the audio using OpenAI Whisper
    const openai = new OpenAI({ apiKey: openaiKey });
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Convert buffer to file format Whisper expects
    const file = await toFile(buffer, 'audio.webm', { type: audioFile.type || 'audio/webm' });
    
    let transcript = "";
    try {
      const whisperResult = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
      });
      transcript = whisperResult.text.trim();
    } catch (whisperError) {
      console.error("OpenAI Whisper transcription error:", whisperError);
      return NextResponse.json({
        error: "We had trouble hearing your voice. Please try again or type your doubt.",
        response: "Sorry, I couldn't transcribe your voice. Please try speaking clearly or use text!"
      }, { status: 200 });
    }

    if (!transcript) {
      return NextResponse.json({
        error: "No voice detected. Please try speaking again.",
        response: "Sorry, I didn't hear anything. Please try speaking again or use text!"
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
      model: "gemini-flash-latest",
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

  } catch (error) {
    console.error("Voice doubt API error:", error);
    return NextResponse.json({
      error: "AI is taking a break. Please try again in a moment.",
      response: "Sorry, I couldn't process your voice doubt right now. Please try again!"
    }, { status: 200 });
  }
}
