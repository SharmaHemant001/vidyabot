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

async function testModel(genAI, modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    console.log(`\n🤖 Testing model: "${modelName}"...`);
    const result = await model.generateContent('Say exactly: "Model ' + modelName + ' is working."');
    const text = result.response.text();
    console.log(`✅ SUCCESS! Response: "${text.trim()}"`);
    return { success: true, modelName };
  } catch (error) {
    console.error(`❌ FAILED for "${modelName}":`, error.message);
    return { success: false, error: error.message };
  }
}

async function run() {
  if (!geminiKey) {
    console.error('Error: GEMINI_API_KEY is not defined in .env.local');
    return;
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash'
  ];

  console.log('Starting model sweep...');
  let workingModel = null;
  for (const m of modelsToTest) {
    const res = await testModel(genAI, m);
    if (res.success) {
      workingModel = m;
      break;
    }
    // Add a small 1s wait between calls to be safe
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (workingModel) {
    console.log(`\n🎉 Sweeper complete! Working model found: "${workingModel}"`);
  } else {
    console.log('\n❌ Sweeper complete! No working models found. All tested models returned quota limits or authorization failures.');
  }
}

run();
