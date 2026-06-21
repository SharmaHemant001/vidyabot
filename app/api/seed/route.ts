import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const ROHAN_ID = '00000000-0000-0000-0000-000000000001';

    // 1. Seed Rohan
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: ROHAN_ID,
        name: 'Rohan',
        class_level: 10,
        language: 'Hindi',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'id' });

    if (userError) {
      console.error('Error seeding user:', userError);
      return NextResponse.json({ error: 'Failed to seed user profile', details: userError.message }, { status: 500 });
    }

    // 2. Prepare 8 preset doubts with relative times and fixed IDs
    const now = new Date();
    const getDateRelative = (daysAgo: number, hoursAgo: number) => {
      const d = new Date();
      d.setDate(now.getDate() - daysAgo);
      d.setHours(now.getHours() - hoursAgo);
      return d.toISOString();
    };

    const presetDoubts = [
      {
        id: 'd0000000-0000-0000-0000-000000000001',
        user_id: ROHAN_ID,
        question: 'द्विघात समीकरण x² - 5x + 6 = 0 के मूल कैसे ज्ञात करें?',
        subject: 'Maths',
        input_type: 'text',
        response: '[SUBJECT: Maths]\nद्विघात समीकरण x² - 5x + 6 = 0 को हल करने के लिए हम गुणनखंड विधि (Factorization Method) का उपयोग करेंगे।\n\n1. सबसे पहले समीकरण को देखें: x² - 5x + 6 = 0\n2. हमें ऐसी दो संख्याएँ चाहिए जिनका गुणा करने पर 6 (स्थिरांक) आए और जोड़ने पर -5 (x का गुणांक) आए।\n3. वे दो संख्याएँ -2 और -3 हैं। क्योंकि (-2) * (-3) = 6 और (-2) + (-3) = -5।\n4. अब समीकरण को इस प्रकार लिखें: x² - 2x - 3x + 6 = 0\n5. गुणनखंड निकालें: x(x - 2) - 3(x - 2) = 0\n6. (x - 2)(x - 3) = 0\n7. इसलिए x - 2 = 0 या x - 3 = 0, जिससे हमें x = 2 और x = 3 मिलता है।\n\nयही इस समीकरण के मूल (roots) हैं। शाबाश रोहन, अभ्यास करते रहो!',
        timestamp: getDateRelative(4, 5)
      },
      {
        id: 'd0000000-0000-0000-0000-000000000002',
        user_id: ROHAN_ID,
        question: 'एक दुकानदार ने 500 रुपये में एक वस्तु खरीदी और 600 रुपये में बेची। लाभ प्रतिशत क्या होगा?',
        subject: 'Maths',
        input_type: 'photo',
        response: '[SUBJECT: Maths]\nचलो रोहन, इसे बाज़ार के उदाहरण से समझते हैं:\n\n1. क्रय मूल्य (Cost Price - जिस दाम पर खरीदा): ₹500\n2. विक्रय मूल्य (Selling Price - जिस दाम पर बेचा): ₹600\n3. लाभ (Profit) = विक्रय मूल्य - क्रय मूल्य = 600 - 500 = ₹100\n4. लाभ प्रतिशत (Profit Percentage) का सूत्र: (लाभ / क्रय मूल्य) * 100\n5. मान रखने पर: (100 / 500) * 100 = (1 / 5) * 100 = 20%\n\nदुकानदार को कुल 20% का लाभ हुआ है! आप बहुत अच्छा कर रहे हैं!',
        timestamp: getDateRelative(3, 8)
      },
      {
        id: 'd0000000-0000-0000-0000-000000000003',
        user_id: ROHAN_ID,
        question: 'समरूप त्रिभुज (Similar Triangles) क्या होते हैं और इनकी विशेषताएं क्या हैं?',
        subject: 'Maths',
        input_type: 'text',
        response: '[SUBJECT: Maths]\nसमरूप त्रिभुज (Similar Triangles) वे त्रिभुज होते हैं जो दिखने में एक जैसे होते हैं, भले ही उनका आकार (size) छोटा या बड़ा हो। जैसे एक छोटा समोसा और एक बड़ा समोसा - दोनों का आकार त्रिकोणीय है!\n\nइसकी दो प्रमुख विशेषताएं हैं:\n1. संगत कोण (Corresponding angles) बराबर होते हैं।\n2. संगत भुजाओं का अनुपात (Ratio of corresponding sides) समान होता है।\n\nयदि त्रिभुज ABC और PQR समरूप हैं, तो AB/PQ = BC/QR = AC/PR। बहुत बढ़िया सवाल रोहन!',
        timestamp: getDateRelative(2, 4)
      },
      {
        id: 'd0000000-0000-0000-0000-000000000004',
        user_id: ROHAN_ID,
        question: 'प्रकाश संश्लेषण (Photosynthesis) की प्रक्रिया को आसान शब्दों में समझाएं।',
        subject: 'Science',
        input_type: 'text',
        response: '[SUBJECT: Science]\nप्रकाश संश्लेषण पौधों के रसोईघर की तरह है! जैसे माँ रसोई में खाना बनाती हैं, वैसे ही पौधे सूरज की धूप का उपयोग करके अपना भोजन बनाते हैं।\n\nप्रक्रिया:\n1. **सामग्री**: पौधे हवा से कार्बन डाइऑक्साइड (CO₂), ज़मीन से पानी (H₂O) और पत्तियों में मौजूद क्लोरोफिल लेते हैं।\n2. **ऊर्जा**: सूरज की रोशनी ऊर्जा देती है।\n3. **भोजन**: इन सबको मिलाकर पौधे ग्लूकोज (भोजन) बनाते हैं और हमारे सांस लेने के लिए ऑक्सीजन (O₂) बाहर छोड़ते हैं।\n\nसमीकरण: 6CO₂ + 6H₂O + धूप → C₆H₁₂O₆ + 6O₂\n\nपत्तियों का हरा रंग क्लोरोफिल के कारण ही होता है। तुम बहुत उत्सुक छात्र हो रोहन, बहुत अच्छे!',
        timestamp: getDateRelative(2, 10)
      },
      {
        id: 'd0000000-0000-0000-0000-000000000005',
        user_id: ROHAN_ID,
        question: 'न्यूटन का गति का तीसरा नियम (Newton\'s Third Law of Motion) क्या है? दैनिक जीवन के उदाहरण दें।',
        subject: 'Science',
        input_type: 'voice',
        response: '[SUBJECT: Science]\nन्यूटन का तीसरा नियम कहता है: "प्रत्येक क्रिया के लिए हमेशा एक बराबर और विपरीत प्रतिक्रिया होती है" (Every action has an equal and opposite reaction)।\n\nइसे हम क्रिकेट या रोज़मर्रा के खेल से समझ सकते हैं:\n1. **क्रिकेट बैटिंग**: जब आप बल्ले से गेंद को ज़ोर से मारते हैं (क्रिया), तो गेंद भी बल्ले पर विपरीत दिशा में बल लगाती है (प्रतिक्रिया), जिससे बल्ला पीछे की ओर झटका महसूस करता है।\n2. **तैरना**: तैरते समय आप पानी को हाथों से पीछे धकेलते हैं (क्रिया), और बदले में पानी आपके शरीर को आगे की ओर धकेलता है (प्रतिक्रिया)।\n3. **रॉकेट का उड़ना**: रॉकेट नीचे की तरफ गैस छोड़ता है (क्रिया) और गैस रॉकेट को ऊपर धकेलती है (प्रतिक्रिया)।\n\nभौतिकी बहुत आसान है जब हम इसे आसपास की चीज़ों से जोड़ते हैं। शाबाश रोहन!',
        timestamp: getDateRelative(1, 2)
      },
      {
        id: 'd0000000-0000-0000-0000-000000000006',
        user_id: ROHAN_ID,
        question: 'फ्रांसीसी क्रांति (French Revolution) के मुख्य कारण क्या थे?',
        subject: 'Social Studies',
        input_type: 'text',
        response: '[SUBJECT: Social Studies]\nफ्रांसीसी क्रांति (1789) इतिहास की एक बहुत बड़ी घटना थी। इसे हम एक उदाहरण से समझते हैं: मान लीजिए एक घर के खर्चे केवल सबसे गरीब सदस्य को उठाने पड़ें और अमीर सदस्य मजे करें। फ्रांस में ऐसा ही हो रहा था।\n\nमुख्य कारण:\n1. **सामाजिक असमानता**: समाज तीन हिस्सों (Estates) में बंटा था। केवल तीसरा हिस्सा (गरीब किसान और मध्यम वर्ग) टैक्स देता था, जबकि पहले दो हिस्सों (पादरी और कुलीन) को टैक्स से छूट थी।\n2. **आर्थिक संकट**: राजा लुई XVI की फिजूलखर्ची और युद्धों के कारण फ्रांस का खजाना खाली हो गया था।\n3. **महंगाई और अकाल**: रोटी की कीमतें इतनी बढ़ गईं कि गरीब उसे खरीद भी नहीं सकते थे।\n\nइससे गुस्साए लोगों ने राजा के खिलाफ विद्रोह कर दिया। इतिहास से सीखना बहुत ज़रूरी है, बहुत अच्छा सवाल!',
        timestamp: getDateRelative(1, 6)
      },
      {
        id: 'd0000000-0000-0000-0000-000000000007',
        user_id: ROHAN_ID,
        question: 'भारतीय संविधान (Indian Constitution) की मुख्य विशेषताएं क्या हैं?',
        subject: 'Social Studies',
        input_type: 'text',
        response: '[SUBJECT: Social Studies]\nभारतीय संविधान हमारे देश की मार्गदर्शिका (Guidebook) है, जैसे स्कूल का डायरी नियम होता है जो सबको समानता देता है।\n\nमुख्य विशेषताएं:\n1. **सबसे लंबा लिखित संविधान**: यह दुनिया का सबसे बड़ा लिखित संविधान है ताकि हर बात स्पष्ट रहे।\n2. **लोकतांत्रिक व्यवस्था**: भारत में जनता अपनी सरकार खुद चुनती है।\n3. **मौलिक अधिकार**: यह हर नागरिक को समानता, स्वतंत्रता और धर्म का अधिकार देता है।\n4. **धर्मनिरपेक्षता (Secularism)**: देश का अपना कोई राजकीय धर्म नहीं है, सभी धर्मों का समान सम्मान है।\n\nडॉ. बी.आर. अंबेडकर इसके मुख्य शिल्पकार थे। नागरिक शास्त्र पढ़ना गर्व की बात है रोहन!',
        timestamp: getDateRelative(0, 3)
      },
      {
        id: 'd0000000-0000-0000-0000-000000000008',
        user_id: ROHAN_ID,
        question: 'Please explain Active and Passive Voice with easy examples.',
        subject: 'English',
        input_type: 'text',
        response: '[SUBJECT: English]\nLet\'s understand Active and Passive Voice using a simple example of playing cricket:\n\n1. **Active Voice (कर्तृवाच्य)**: Here, the person performing the action is main.\n   * *Example*: "Rohan hits the ball." (यहाँ रोहन काम कर रहा है और मुख्य है।)\n\n2. **Passive Voice (कर्मवाच्य)**: Here, the action or the object receiving the action becomes main.\n   * *Example*: "The ball is hit by Rohan." (यहाँ गेंद पर काम हो रहा है और वह मुख्य बन गई है।)\n\n**Rule of Thumb**:\n- Active: Subject (Rohan) + Verb (hits) + Object (ball).\n- Passive: Object (ball) + Verb (is hit) + by + Subject (Rohan).\n\nKeep learning English grammar, you are doing fantastic!',
        timestamp: getDateRelative(0, 1)
      }
    ];

    // Seed doubts
    for (const doubt of presetDoubts) {
      const { error } = await supabaseAdmin
        .from('doubts')
        .upsert(doubt, { onConflict: 'id' });

      if (error) {
        console.error(`Error seeding doubt ${doubt.id}:`, error);
      }
    }

    // 3. Seed daily sessions to form a 5-day active streak (relative dates)
    const presetSessions = [
      { user_id: ROHAN_ID, date: getDateRelative(4, 0).split('T')[0], doubt_count: 1 },
      { user_id: ROHAN_ID, date: getDateRelative(3, 0).split('T')[0], doubt_count: 1 },
      { user_id: ROHAN_ID, date: getDateRelative(2, 0).split('T')[0], doubt_count: 2 },
      { user_id: ROHAN_ID, date: getDateRelative(1, 0).split('T')[0], doubt_count: 2 },
      { user_id: ROHAN_ID, date: getDateRelative(0, 0).split('T')[0], doubt_count: 2 }
    ];

    for (const session of presetSessions) {
      const { error } = await supabaseAdmin
        .from('sessions')
        .upsert(session, { onConflict: 'user_id, date' });

      if (error) {
        console.error(`Error seeding session for ${session.date}:`, error);
      }
    }

    return NextResponse.json({
      message: 'Demo database seeded successfully!',
      user_id: ROHAN_ID,
      profile: {
        name: 'Rohan',
        class_level: 10,
        language: 'Hindi'
      },
      doubts_count: presetDoubts.length,
      sessions_count: presetSessions.length
    }, { status: 200 });

  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('Seed script crash:', error);
    return NextResponse.json({
      error: 'Failed to complete database seeding',
      details: errMessage
    }, { status: 500 });
  }
}
