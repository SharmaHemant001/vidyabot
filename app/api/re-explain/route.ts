import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveDoubtAndIncrementSession } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const original_question = body.original_question;
    const original_response = body.original_response;
    const language = body.language;
    const subject = body.subject;
    const user_id = body.user_id || body.userId;
    const class_level = body.class_level || body.classLevel;

    console.log("Language received:", language);
    console.log("Language passed to Gemini:", language);

    if (!original_question || !original_response || !user_id || !class_level || !language) {
      return NextResponse.json({
        error: "Missing required parameters.",
        response: "Sorry, I am missing some context to explain this again. Please try asking your doubt again!"
      }, { status: 200 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

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

Student Class: ${class_level}

SUBJECT DETECTION: Since this is a re-explanation, do NOT output the [SUBJECT: X] header. Just give the explanation directly.

EXPLANATION STYLE (CRITICAL FOR RE-EXPLAIN):
- The student did not understand the previous explanation. You MUST use a COMPLETELY DIFFERENT analogy or real-life Indian example now.
- For example, if the previous explanation used cricket, you could now use a train journey, kitchen recipes (dal-chawal), market shopping, or festival celebrations. Never repeat the same example.
- Explain step-by-step, like a kind teacher sitting next to the student.
- Keep explanations under 200 words — short and clear beats long and complex.
- End every response with an encouraging line in the student's language.

TONE: Warm, patient, never condescending. You are the best teacher the student has ever had.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    // Start a chat session in Gemini to maintain the context
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: original_question }]
        },
        {
          role: "model",
          parts: [{ text: original_response }]
        }
      ]
    });

    // Translate the follow-up request dynamically to prevent language confusion
    let followUpQuery = "I did not understand this explanation. Please explain again using a completely different example or analogy.";
    const langLower = language.toLowerCase();
    if (langLower === 'hindi') {
      followUpQuery = "मुझे यह उदाहरण या तरीका समझ नहीं आया। कृपया किसी बिल्कुल अलग उदाहरण या तरीके से फिर से समझाइए।";
    } else if (langLower === 'tamil') {
      followUpQuery = "எனக்கு இந்த விளக்கம் புரியவில்லை. தயவுசெய்து வேறு ஒரு புதிய உதாரணத்துடன் மீண்டும் விளக்கவும்.";
    } else if (langLower === 'bengali') {
      followUpQuery = "আমি এই ব্যাখ্যাটি বুঝতে পারিনি। দয়া করে সম্পূর্ণ আলাদা একটি উদাহরণ দিয়ে আবার বুঝিয়ে বলুন।";
    } else if (langLower === 'telugu') {
      followUpQuery = "నాకు ఈ వివరణ అర్థం కాలేదు. దయచేసి మరొక కొత్త ఉదాహరణతో మళ్ళీ వివరించండి.";
    } else if (langLower === 'marathi') {
      followUpQuery = "मला हे स्पष्टीकरण समजले नाही. कृपया दुसऱ्या नवीन उदाहरणासह पुन्हा समजावून सांगा.";
    } else if (langLower === 'kannada') {
      followUpQuery = "ನನಗೆ ಈ ವಿವರಣೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಂದು ಹೊಸ ಉದಾಹರಣೆಯೊಂದಿಗೆ ಮತ್ತೆ ವಿವರಿಸಿ.";
    }

    const result = await chat.sendMessage(followUpQuery);
    let responseText = result.response.text() || '';

    // Response Validation (Requirement 6)
    if (language === "English" && /[\u0900-\u097F]/.test(responseText)) {
      console.log("Validation Failed (Re-explain): Hindi character detected in English response. Regenerating...");
      const strictResult = await chat.sendMessage(
        "Your previous answer was not in English. Respond ONLY in English."
      );
      responseText = strictResult.response.text() || responseText;
    }

    const cleanResponse = responseText.replace(/\[SUBJECT:\s*[^\]\n]+\]\n?/i, '').trim();

    // Save this re-explanation to doubts history so dashboard counts are accurate
    await saveDoubtAndIncrementSession({
      userId: user_id,
      question: `Re-explain: ${original_question}`,
      subject: subject || 'Other',
      response: cleanResponse,
      inputType: 'text'
    });

    return NextResponse.json({
      response: cleanResponse
    }, { status: 200 });

  } catch (error) {
    console.error("Re-explain API error:", error);
    return NextResponse.json({
      error: "AI is taking a break. Please try again in a moment.",
      response: "Sorry, I couldn't generate a new explanation right now. Please try again!"
    }, { status: 200 });
  }
}
