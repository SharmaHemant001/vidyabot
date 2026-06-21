# 🏆 Hackathon Submission: VidyaBot

## 💡 The Problem
In India, millions of school students studying in regional languages (Hindi, Tamil, Telugu, Bengali, Kannada, etc.) face a severe lack of high-quality, personalized academic support outside of school hours. 
* Traditional digital educational tools are highly centered around English-only instructions.
* Translation services fail to capture colloquial learning tones, cultural analogies, and conversational "Hinglish" or local hybrid speech patterns.
* Students in low-connectivity areas struggle to type out complex queries, requiring multi-modal ways (voice and photos) to explain doubts.
* Parents are frequently excluded from their children's learning lifecycle due to language and technical barriers.

---

## 🌟 The Solution
**VidyaBot** is an AI-powered multilingual tutor built for Bharat. It provides an encouraging, patient, and conversational study assistant tailored specifically for Indian school students in grades 6–12.
* **Instant Conversational Doubts**: Students ask academic questions via text, voice, or photo.
* **Strict Regional Instructions**: VidyaBot responds strictly in the student's chosen language, utilizing culturally relevant analogies (e.g. cricket for statistics, dal-chawal for fractions, and local markets for percentages).
* **Gamified Motivation**: Students earn XP and maintain study streaks which updates in a database.
* **Parental Inclusion**: Weekly AI reports summarize progress, highlight weak topics, and outline action items for parents in their regional language.

---

## 🚀 Key Innovations
1. **Colloquial Regional Focus**: Multi-language prompts enforce natural, region-specific responses without script mixing, utilizing local, real-world analogies that bridge abstract academic concepts to the student's daily life.
2. **Deterministic Response Validation**: If "English" is chosen, a backend regex filter detects Devanagari characters in the AI response and triggers an automatic, transparent regeneration, ensuring language instructions are strictly adhered to.
3. **Multi-Modal Flow**: Seamlessly pipes Whisper transcription, Google Gemini Flash OCR/analysis, and ElevenLabs speech generation into a cohesive web experience.
4. **Resilient Local Mode**: If the Supabase database is disconnected, the frontend automatically falls back to an offline simulated Guest Mode using `localStorage` state management, preventing study interruptions.

---

## 📐 Architecture
* **Frontend**: Next.js (App Router, Tailwind CSS, TypeScript) for responsive UI design with skeleton states and local session synchronization.
* **Backend API Layer**: Next.js serverless route handlers managing orchestrations, logging payload telemetry, and communicating with external model APIs.
* **Database & Auth**: Supabase PostgreSQL tables storing users, doubts, and study sessions. Custom PostgreSQL RPC functions (`increment_xp`, `update_streak`) maintain data integrity during concurrent transactions.
* **AI Model Engine**:
  * **Google Gemini API** (`gemini-flash-latest`): Selected for cost-efficiency, large context size, fast execution speeds, and native multi-lingual support.
  * **OpenAI Whisper** (`whisper-1`): Performs accurate voice-to-text transcribing.
  * **ElevenLabs API** (`eleven_multilingual_v2`): Re-synthesizes the regional explanations back into fluent text-to-speech voiceovers.

---

## 🛠️ Features Breakdown
* **Regional Input/Output**: Interactive switcher instantly updates context throughout text, photo, voice, and re-explain operations.
* **Photo Question Solver**: Automated OCR extracts printed or handwritten text and resolves academic answers step-by-step.
* **Voice Doubt Reader**: Easy record and play controls allowing students to listen to explanations.
* **Interactive Quick Quiz Modal**: Tailors quizzes based on historical doubt topics to test comprehension.
* **AI Parent Reporting**: Formulates structured summary blocks in the parent's preferred script.

---

## 📈 Scalability
* **Optimized API Operations**: Next.js serverless route handlers scale automatically on demand.
* **Cost-Efficient Intelligence**: Leveraging Gemini Flash keeps cost per token extremely low, enabling free tier usage at scale.
* **Concurrent Metric Updates**: Custom database triggers and RPCs offload compute stress from the application backend directly to PostgreSQL.
* **State Caching**: Client-side state hydration limits redundant network reads to Supabase.

---

## 🌍 Social Impact
* **Democratizing Education**: Breaks down linguistic inequality in educational technology, enabling students from rural schools to access the same high-level tutoring as private English-medium schools.
* **Family Engagement**: Parents who cannot read English can now actively participate in their child's academic growth.
* **Retention Boost**: Turning doubt-solving into a rewarding game with levels, streak milestones, and quizzes.

---

## 🔮 Future Scope
* **PWA Offline Capabilities**: Service worker sync to allow voice caching and local doubt collection in rural zones with intermittent network access.
* **Custom Syllabi Maps**: Integrations mapping national curriculums (CBSE, state boards) directly to visual concepts.
* **Study Group Arenas**: Multi-player quiz competitions to foster collaboration.
