import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveDoubtAndIncrementSession } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const userId = formData.get('user_id') as string | null || formData.get('userId') as string | null;
    const classLevel = formData.get('class_level') as string | null || formData.get('classLevel') as string | null;
    const language = formData.get('language') as string | null;

    console.log("Language received:", language);
    console.log("Language passed to Gemini:", language);

    if (!imageFile || !userId || !classLevel || !language) {
      return NextResponse.json({
        error: "Missing required parameters.",
        response: "Sorry, I am missing some information about your request. Please try again!"
      }, { status: 200 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    // 1. Convert image to Generative AI inline data part
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: imageFile.type
      }
    };

    // 2. Call Gemini 2.5 Flash to perform OCR and extract the academic question
    const genAI = new GoogleGenerativeAI(geminiKey);
    const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const geminiPrompt = "Extract the written academic question or text from this image. Only return the extracted question text as is, without adding extra words, greetings, or formatting.";
    
    let extractedQuestion = "";
    try {
      const geminiResult = await geminiModel.generateContent([geminiPrompt, imagePart]);
      extractedQuestion = geminiResult.response.text().trim();
    } catch (ocrError) {
      console.error("Gemini OCR error:", ocrError);
      extractedQuestion = "Could not extract question from photo.";
    }

    if (!extractedQuestion || extractedQuestion === "Could not extract question from photo.") {
      return NextResponse.json({
        error: "We couldn't read the question from the photo. Please make sure the writing is clear and try again!",
        response: "Sorry, I couldn't read the text from that picture. Can you write it out or try taking another photo?"
      }, { status: 200 });
    }

    // 3. Call Gemini with the extracted question to get the explanation
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

    const explainModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await explainModel.generateContent(extractedQuestion);
    let responseText = result.response.text() || '';

    // Response Validation (Requirement 6)
    if (language === "English" && /[\u0900-\u097F]/.test(responseText)) {
      console.log("Validation Failed (Photo doubt): Hindi character detected in English response. Regenerating...");
      const strictResult = await explainModel.generateContent(
        `${extractedQuestion}\n\n[SYSTEM NOTE: Your previous answer contained Hindi characters. You must respond ONLY in English. Do not use Hindi script or words.]`
      );
      responseText = strictResult.response.text() || responseText;
    }

    // Regex subject extraction
    const subjectMatch = responseText.match(/\[SUBJECT:\s*([^\]\n]+)\]/i);
    const rawSubject = subjectMatch ? subjectMatch[1].trim() : 'Other';

    // Clean subject (map to allowed database enum values)
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

    // Save doubt and increment the daily sessions counter
    await saveDoubtAndIncrementSession({
      userId,
      question: extractedQuestion,
      subject,
      response: cleanResponse,
      inputType: 'photo'
    });

    return NextResponse.json({
      extracted_question: extractedQuestion,
      response: cleanResponse,
      subject
    }, { status: 200 });

  } catch (error) {
    console.error("Photo doubt API error:", error);
    return NextResponse.json({
      error: "AI is taking a break. Please try again in a moment.",
      response: "Sorry, I couldn't process your photo doubt right now. Please try again!"
    }, { status: 200 });
  }
}
