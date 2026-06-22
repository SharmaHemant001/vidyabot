/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenerativeAI } from '@google/generative-ai';


interface GenerationOptions {
  systemPrompt?: string;
  responseMimeType?: string;
  maxRetries?: number;
  initialDelayMs?: number;
}

/**
 * Generates content using Gemini with automatic rate-limit retries and model fallback.
 */
export async function generateContentWithRetryAndFallback(
  genAI: GoogleGenerativeAI,
  promptOrParts: any,
  options: GenerationOptions = {}
) {
  const {
    systemPrompt,
    responseMimeType,
    maxRetries = 3,
    initialDelayMs = 2000
  } = options;

  const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of models) {
    let delayMs = initialDelayMs;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const config: any = {};
        if (systemPrompt) {
          config.systemInstruction = systemPrompt;
        }
        if (responseMimeType) {
          config.generationConfig = { responseMimeType };
        }

        const model = genAI.getGenerativeModel({
          model: modelName,
          ...config
        });

        const result = await model.generateContent(promptOrParts);
        const text = result.response.text();
        return {
          text,
          modelUsed: modelName
        };
      } catch (err: any) {
        lastError = err;
        const isRateLimit = 
          err?.status === 429 || 
          err?.message?.includes('429') || 
          err?.message?.includes('Quota exceeded') ||
          err?.message?.includes('Too Many Requests');
        
        if (isRateLimit && attempt < maxRetries - 1) {
          console.warn(`[Gemini Retry] Model ${modelName} rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
          continue;
        }
        
        console.warn(`[Gemini Fallback] Model ${modelName} failed. Trying next model. Error: ${err.message}`);
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

/**
 * Sends a message in a chat session with automatic rate-limit retries and model fallback.
 */
export async function sendMessageWithRetryAndFallback(
  genAI: GoogleGenerativeAI,
  history: any[],
  message: string,
  options: GenerationOptions = {}
) {
  const {
    systemPrompt,
    maxRetries = 3,
    initialDelayMs = 2000
  } = options;

  const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of models) {
    let delayMs = initialDelayMs;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const config: any = {};
        if (systemPrompt) {
          config.systemInstruction = systemPrompt;
        }

        const model = genAI.getGenerativeModel({
          model: modelName,
          ...config
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(message);
        const text = result.response.text();
        return {
          text,
          modelUsed: modelName,
          chat
        };
      } catch (err: any) {
        lastError = err;
        const isRateLimit = 
          err?.status === 429 || 
          err?.message?.includes('429') || 
          err?.message?.includes('Quota exceeded') ||
          err?.message?.includes('Too Many Requests');
        
        if (isRateLimit && attempt < maxRetries - 1) {
          console.warn(`[Gemini Chat Retry] Model ${modelName} rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }
        
        console.warn(`[Gemini Chat Fallback] Model ${modelName} failed. Trying next model. Error: ${err.message}`);
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini models failed to send message in chat.");
}
