const fs = require('fs');
const lines = fs.readFileSync('components/ProfileSetup.tsx', 'utf8').split(/\r?\n/);
for (let i = 330; i < 406; i++) {
  const line = lines[i] || '';
  const indent = line.match(/^\s*/)[0].length;
  console.log(`${i+1}:${indent}:${line}`);
}
