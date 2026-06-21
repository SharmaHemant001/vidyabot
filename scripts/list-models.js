const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

let geminiKey = '';
try {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('GEMINI_API_KEY=')) {
      geminiKey = line.split('GEMINI_API_KEY=')[1].trim();
      if (geminiKey.startsWith('"') && geminiKey.endsWith('"')) {
        geminiKey = geminiKey.slice(1, -1);
      }
      if (geminiKey.startsWith("'") && geminiKey.endsWith("'")) {
        geminiKey = geminiKey.slice(1, -1);
      }
    }
  }
} catch (e) {
  console.error('Failed to read .env.local:', e.message);
}

async function run() {
  if (!geminiKey) {
    console.error('Error: GEMINI_API_KEY is not defined in .env.local');
    return;
  }

  try {
    // We make a direct fetch to the ListModels endpoint
    console.log('Fetching available models from Generative Language API...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ ListModels Success!');
      if (data.models) {
        console.log(`Found ${data.models.length} models:`);
        data.models.forEach(m => {
          console.log(`- ${m.name} (Supported actions: ${m.supportedGenerationMethods.join(', ')})`);
        });
      } else {
        console.log('No models returned. Response:', data);
      }
    } else {
      console.error('❌ ListModels Failed with status:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Fetch failed:', error);
  }
}

run();
