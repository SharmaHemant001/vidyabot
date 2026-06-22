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
* You MUST respond ONLY in ${language} using its native script (e.g. Hindi in Devanagari script, Tamil in Tamil script, etc.).
* Never switch languages unless explicitly asked by the student.
* Do not mix languages. The selected language (${language}) is strictly mandatory.

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

    // Map the follow-up request prompt to the student's exact language
    const followUpQueries: Record<string, string> = {
      english: "I did not understand this explanation. Please explain again using a completely different example or analogy.",
      hindi: "मुझे यह उदाहरण या तरीका समझ नहीं आया। कृपया किसी बिल्कुल अलग उदाहरण या तरीके से फिर से समझाइए।",
      bengali: "আমি এই ব্যাখ্যাটি বুঝতে পারিনি। দয়া করে সম্পূর্ণ আলাদা একটি উদাহরণ দিয়ে আবার বুঝিয়ে বলুন।",
      telugu: "నాకు ఈ వివరణ అర్థం కాలేదు. దయచేసి మరొక కొత్త ఉదాహరణతో మళ్ళీ వివరించండి.",
      marathi: "मला हे स्पष्टीकरण समजले नाही. कृपया दुसऱ्या नवीन उदाहरणासह पुन्हा समजावून सांगा.",
      tamil: "எனக்கு இந்த விளக்கம் புரியவில்லை. தயவுசெய்து வேறு ஒரு புதிய உதாரணத்துடன் மீண்டும் விளக்கவும்.",
      urdu: "مجھے یہ وضاحت سمجھ نہیں آئی۔ براہ کرم بالکل مختلف مثال یا تشبیہ کا استعمال کرتے ہوئے دوبارہ وضاحت کریں۔",
      gujarati: "મને આ સમજૂતી સમજાઈ નથી. કૃપા કરીને સંપૂર્ણપણે અલગ ઉદાહરણ અથવા સામ્યતાનો ઉપયોગ કરીને ફરીથી સમજાવો.",
      kannada: "ನನಗೆ ಈ ವಿವರಣೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಂದು ಹೊಸ ಉದಾಹರಣೆಯೊಂದಿಗೆ ಮತ್ತೆ ವಿವರಿಸಿ.",
      odia: "ମୁଁ ଏହି ବ୍ୟାଖ୍ୟา ବୁଝିପାରିଲି ନାହିଁ | ଦୟାକରି ଏକ ସମ୍ପୂର୍ଣ୍ଣ ଭିନ୍ନ ଉଦାହରଣ ବ୍ୟବହାର କରି ପୁଣି ବୁଝାନ୍ତୁ |",
      punjabi: "ਮੈਨੂੰ ਇਹ ਵਿਆਖਿਆ ਸਮਝ ਨਹੀਂ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵੱਖਰੀ ਮਿਸਾਲ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਦੁਬਾਰਾ ਸਮਝਾਓ।",
      malayalam: "എനിക്ക് ഈ വിശദീകരണം മനസ്സിലായില്ല. ദയവായി മറ്റൊരു പുതിയ ഉദാഹരണം ഉപയോഗിച്ച് വീണ്ടും വിശദീകരിക്കുക.",
      assamese: "মই এই ব্যাখ্যাটো বুজি নাপালোঁ। অনুগ্ৰহ কৰি এটা সম্পূৰ্ণ বেলেগ উদাহৰণ ব্যৱহাৰ কৰি আকৌ বুজাই দিয়ক।",
      maithili: "हमरा ई बात नै बुझायल। कृपा कऽ कोनो दोसर अलग उदाहरण दैत पुनः समझाउ।",
      santali: "ᱤᱧ ᱫᱚ ᱱᱚᱣᱟ ᱵᱷᱟᱜᱮ ᱛᱮ ᱵᱟᱹᱧ ᱵᱩᱡᱷᱟᱹᱣ ᱞᱮᱫᱟ ᱾ ᱫᱟᱭᱟ ᱠᱟᱛે ᱮᱴᱟᱜ ᱞᱮᱠᱟᱱ ᱥᱟᱹᱫᱷᱟᱹᱨᱚᱱ ᱛե ᱟᱨᱦۆᱸ ᱵᱩᱡᱷᱟᱹᱣ ᱤᱧ ᱢᱮ ᱾",
      kashmiri: "ميٚہ آو نَہ ييٚہ وَضاحَت سَمجھ۔ مَہرَبٲنی کٔرِتھ وَضاحَت کَرِو پَتہِ کُنہِ بیٚیہِ مِثالہِ سِت।",
      nepali: "मैले यो स्पष्टीकरण बुझिनँ। कृपया अर्को बिल्कुलै फरक उदाहरण प्रयोग गरेर फेरि सम्झाउनुहोस्।",
      sindhi: "مون کي هي وضاحت سمجهه ۾ نه آئي. مهرباني ڪري هڪ مختلف مثال استعمال ڪندي ٻيهر وضاحت ڪريو.",
      konkani: "म्हाका हें स्पष्टीकरण समजलें ना. कृपा करून एका वेगळ्या उदाहरणाचो उपेग करून परत समजावन सांगात.",
      dogri: "गी ऐ समझ नी आया। कृपा करियै कोई बक्खरा उदाहरण देइयै परत समझायो।",
      manipuri: "ঐহাক্না ৱারোল অসি খঙদে। অন্য অতোপ্পা খুদম অমগা লোয়ননা অমুক্তা অমুক হন্না তাকপীয়ু।",
      bodo: "आं बे बियाखौ बुजियाखिसै। अननानै गुबुन मोनसे बिदिनथि होनानै फिन बुजायफिन।"
    };

    const langLower = language.toLowerCase();
    const followUpQuery = followUpQueries[langLower] || followUpQueries.english;

    let responseText = "";
    let activeChat = chat;
    try {
      const result = await chat.sendMessage(followUpQuery);
      responseText = result.response.text() || '';
    } catch (chatError) {
      console.warn("Primary chat session gemini-2.5-flash failed, trying fallback gemini-flash-latest:", chatError);
      const fallbackModel = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        systemInstruction: systemPrompt,
      });
      const fallbackChat = fallbackModel.startChat({
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
      activeChat = fallbackChat;
      const result = await fallbackChat.sendMessage(followUpQuery);
      responseText = result.response.text() || '';
    }

    // Response Validation (Requirement 6)
    if (language === "English" && /[\u0900-\u097F]/.test(responseText)) {
      console.log("Validation Failed (Re-explain): Hindi character detected in English response. Regenerating...");
      try {
        const strictResult = await activeChat.sendMessage(
          "Your previous answer was not in English. Respond ONLY in English."
        );
        responseText = strictResult.response.text() || responseText;
      } catch (valError) {
        console.warn("Validation regeneration failed:", valError);
      }
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
      error: error instanceof Error ? error.message : "AI is taking a break. Please try again in a moment.",
      response: "Sorry, I couldn't generate a new explanation right now. Please try again!"
    }, { status: 200 });
  }
}
