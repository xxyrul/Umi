import fs from 'fs';

const configPath = `${process.env.USERPROFILE}\\.config\\configstore\\firebase-tools.json`;
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;

async function checkRules() {
  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/umiren-d6a66/rulesets/42487030-9f6e-4a97-bdd8-c981fa921fa0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rulesetData = await rulesetRes.json();
  console.log('Active rules full content:\n', rulesetData.source?.files?.[0]?.content);
}

checkRules().catch(console.error);
