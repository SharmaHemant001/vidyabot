import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateContentWithRetryAndFallback } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { subjects, class_level } = await request.json();

    const selectedSubjects = subjects && subjects.length > 0 ? subjects : ['General Science', 'Mathematics'];
    const selectedClass = class_level || 10;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    
    const systemPrompt = `You are a helpful education assistant that generates exactly 3 multiple choice questions for an Indian school student in Class ${selectedClass} studying the following subjects: ${selectedSubjects.join(', ')}.
    
    Generate questions that test conceptual understanding, suitable for Class ${selectedClass} curriculum (CBSE/ICSE level).
    Use real-life Indian context or simple examples where possible.
    
    Return ONLY a JSON array. Do not include markdown code block formatting (do not wrap in \`\`\`json). The JSON array must follow this exact format:
    [
      {
        "question": "Question text here?",
        "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
        "correct": "Option A text", 
        "explanation": "Why this answer is correct in simple terms."
      }
    ]
    
    Note: The "correct" value must be the EXACT string match of one of the items inside the "options" array.`;

    let responseText = "[]";
    try {
      const quizResult = await generateContentWithRetryAndFallback(
        genAI,
        "Generate 3 multiple choice questions now.",
        {
          systemPrompt,
          responseMimeType: "application/json"
        }
      );
      responseText = quizResult.text || '[]';
    } catch (genError) {
      console.error("Gemini quiz generation error:", genError);
      throw genError;
    }

    // Parse the generated JSON to verify format
    const parsedQuiz = JSON.parse(responseText.trim());

    return NextResponse.json({
      quiz: parsedQuiz
    }, { status: 200 });

  } catch (error) {
    console.error("Quiz generation API error:", error);
    // Fallback quiz questions in case of error
    const fallbackQuiz = [
      {
        question: "What is the unit of electric current?",
        options: ["Volt", "Ampere", "Ohm", "Watt"],
        correct: "Ampere",
        explanation: "Electric current is measured in Ampere (A). Volt is for voltage, Ohm for resistance, and Watt for power."
      },
      {
        question: "Which of the following is a quadratic equation?",
        options: ["x + 5 = 0", "x^2 - 4x + 4 = 0", "x^3 - x = 0", "1/x + x = 2"],
        correct: "x^2 - 4x + 4 = 0",
        explanation: "A quadratic equation has the general form ax^2 + bx + c = 0, where the highest degree is 2."
      },
      {
        question: "Which gas is key to the process of photosynthesis?",
        options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
        correct: "Carbon Dioxide",
        explanation: "Plants take in Carbon Dioxide (CO2) from the air to make glucose and release Oxygen during photosynthesis."
      }
    ];

    return NextResponse.json({
      quiz: fallbackQuiz,
      warning: "Fallback questions loaded due to generation failure."
    }, { status: 200 });
  }
}
