import fs from 'fs';

const configPath = `${process.env.USERPROFILE}\\.config\\configstore\\firebase-tools.json`;
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;

async function cleanPending() {
  const uid = 'CgkgztUTqfV9zQyoOOV1anzqRLj2';
  const url = `https://firestore.googleapis.com/v1/projects/umiren-d6a66/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=status&updateMask.fieldPaths=approved&updateMask.fieldPaths=role&updateMask.fieldPaths=rejectedAt&updateMask.fieldPaths=rejectionReason`;
  
  const body = {
    fields: {
      status: { stringValue: 'PENDING_APPROVAL' },
      approved: { booleanValue: false },
      role: { stringValue: 'agent' },
      rejectedAt: { nullValue: null },
      rejectionReason: { stringValue: '' }
    }
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log('Cleaned:', JSON.stringify(data, null, 2));
}

cleanPending().catch(console.error);
