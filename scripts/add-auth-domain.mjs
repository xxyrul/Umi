/**
 * Adds artharen.web.app to Firebase Auth authorized domains.
 * Run with: node scripts/add-auth-domain.mjs
 */
import { execSync } from 'child_process';

const PROJECT_ID = 'umiren-d6a66';
const DOMAIN_TO_ADD = 'artharen.web.app';

try {
  // Get firebase CLI access token
  const token = execSync('firebase --token "" auth:export /dev/null 2>&1 || echo ""', { encoding: 'utf8' });
  
  // Use the Identity Toolkit Admin API via firebase-tools internal token
  // firebase-tools stores OAuth tokens in ~/.config/configstore/firebase-tools.json
  const configPath = process.env.APPDATA 
    ? `${process.env.APPDATA}\\Roaming\\configstore\\firebase-tools.json`
    : `${process.env.HOME}/.config/configstore/firebase-tools.json`;

  let fbConfig;
  try {
    const { readFileSync } = await import('fs');
    fbConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    const altPath = `${process.env.APPDATA}\\configstore\\firebase-tools.json`;
    const { readFileSync } = await import('fs');
    fbConfig = JSON.parse(readFileSync(altPath, 'utf8'));
  }

  const tokens = fbConfig.tokens;
  const accessToken = tokens?.access_token;
  
  if (!accessToken) {
    console.error('No access token found. Run: firebase login');
    process.exit(1);
  }

  // Get current authorized domains
  const getRes = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!getRes.ok) {
    const err = await getRes.text();
    console.error('GET config failed:', err);
    process.exit(1);
  }

  const config = await getRes.json();
  const currentDomains = config.authorizedDomains || [];
  
  console.log('Current authorized domains:', currentDomains);
  
  if (currentDomains.includes(DOMAIN_TO_ADD)) {
    console.log(`✅ ${DOMAIN_TO_ADD} is already authorized.`);
    process.exit(0);
  }

  const newDomains = [...currentDomains, DOMAIN_TO_ADD];

  // Update authorized domains
  const patchRes = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authorizedDomains: newDomains }),
    }
  );

  if (!patchRes.ok) {
    const err = await patchRes.text();
    console.error('PATCH failed:', err);
    process.exit(1);
  }

  const result = await patchRes.json();
  console.log('✅ Updated authorized domains:', result.authorizedDomains);

} catch (err) {
  console.error('Script failed:', err.message);
  process.exit(1);
}
