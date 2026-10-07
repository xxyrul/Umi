import fs from 'fs';

const configPath = `${process.env.USERPROFILE}\\.config\\configstore\\firebase-tools.json`;
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const idToken = config.tokens.id_token;

async function testQuery() {
  console.log('Testing query with user idToken...');
  const res = await fetch('https://firestore.googleapis.com/v1/projects/umiren-d6a66/databases/(default)/documents/users', {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  console.log('Status:', res.status, res.statusText);
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testQuery().catch(console.error);
