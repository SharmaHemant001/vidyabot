const fs = require('fs');
const path = require('path');

let elevenLabsKey = '';
try {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('ELEVENLABS_API_KEY=')) {
      elevenLabsKey = line.split('ELEVENLABS_API_KEY=')[1].trim();
      if (elevenLabsKey.startsWith('"') && elevenLabsKey.endsWith('"')) {
        elevenLabsKey = elevenLabsKey.slice(1, -1);
      }
      if (elevenLabsKey.startsWith("'") && elevenLabsKey.endsWith("'")) {
        elevenLabsKey = elevenLabsKey.slice(1, -1);
      }
    }
  }
} catch (e) {
  console.error('Failed to read .env.local:', e.message);
}

async function run() {
  if (!elevenLabsKey) {
    console.error('Error: ELEVENLABS_API_KEY is not defined in .env.local');
    return;
  }

  console.log('Testing ElevenLabs API...');
  const voiceId = "EXAVITQu4vr4xnSDxMaL";
  const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  try {
    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: "Hello! This is a test of the speech synthesis pipeline.",
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    console.log(`Status code: ${response.status}`);
    console.log(`Status text: ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ SUCCESS! The ElevenLabs key is valid and has sufficient quota.');
    } else {
      const errorText = await response.text();
      console.error('❌ FAILED! Error response body:', errorText);
    }
  } catch (err) {
    console.error('❌ Fetch error:', err);
  }
}

run();
