const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/build-info.ts');
const timestamp = Math.floor(Date.now() / 1000);

const content = `// Este arquivo é atualizado automaticamente durante o build
// Não edite manualmente
export const BUILD_TIME = ${timestamp};
`;

fs.writeFileSync(filePath, content);
console.log(`Updated build time to ${timestamp}`);
