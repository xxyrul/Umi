import fs from 'fs';

const configPath = `${process.env.USERPROFILE}\\.config\\configstore\\firebase-tools.json`;
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;

async function check() {
  console.log('Fetching users via REST API...');
  const res = await fetch('https://firestore.googleapis.com/v1/projects/umiren-d6a66/databases/(default)/documents/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.documents) {
    console.log(`Found ${data.documents.length} users:`);
    for (const doc of data.documents) {
      const id = doc.name.split('/').pop();
      const email = doc.fields?.email?.stringValue || 'no email';
      const role = doc.fields?.role?.stringValue || 'no role';
      const status = doc.fields?.status?.stringValue || 'no status';
      const approved = doc.fields?.approved?.booleanValue ?? 'no approved';
      const name = doc.fields?.displayName?.stringValue || 'no name';
      console.log(` - ID: ${id}, Email: ${email}, Name: ${name}, Role: ${role}, Status: ${status}, Approved: ${approved}`);
    }
  } else {
    console.log('No documents or error:', JSON.stringify(data));
  }
}

check().catch(console.error);
