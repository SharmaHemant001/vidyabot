const http = require('http');

console.log('Sending seeding request to http://localhost:3000/api/seed...');
http.get('http://localhost:3000/api/seed', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log('✅ Database Seeding Success!');
        console.log('User Seeded:', parsed.profile.name, '(Class ' + parsed.profile.class_level + ', ' + parsed.profile.language + ')');
        console.log('Total Doubts Pre-populated:', parsed.doubts_count);
        console.log('Total Sessions Pre-populated:', parsed.sessions_count);
      } else {
        console.error('❌ Database Seeding Failed:', parsed.error || data);
        if (parsed.details) {
          console.error('Details:', parsed.details);
        }
      }
    } catch (e) {
      console.error('❌ Failed to parse response as JSON. Response received:', data);
    }
  });
}).on('error', (err) => {
  console.error('❌ Local Next.js server is not running on http://localhost:3000.');
  console.error('Please run "npm run dev" in one terminal, then run "npm run seed" in another.');
  console.error('Error details:', err.message);
});
