
const fs = require('fs');
const content = fs.readFileSync('.env', 'utf8');
const lines = content.split('\n');
for (const line of lines) {
  if (line.includes('DATABASE_URL')) {
    console.log('--- FOUND LINE ---');
    console.log('Length:', line.length);
    console.log('Raw:', JSON.stringify(line));
    console.log('------------------');
  }
}
