
const fs = require('fs');
const content = fs.readFileSync('.env', 'utf8');
const lines = content.split('\n');
for (const line of lines) {
  if (line.startsWith('DATABASE_URL')) {
    console.log('Line length:', line.length);
    console.log('Hex:', Buffer.from(line).toString('hex'));
    for (let i = 0; i < line.length; i++) {
        console.log(`Char at ${i}: [${line[i]}] (code: ${line.charCodeAt(i)})`);
    }
  }
}
