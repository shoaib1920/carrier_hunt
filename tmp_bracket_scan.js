const fs = require('fs');
const text = fs.readFileSync('components/ProfileSetup.tsx', 'utf8');
const lines = text.split(/\r?\n/);
const stack = [];
let line = 1;
let inString = null;
let inComment = null;
let escape = false;
for (const ln of lines) {
  let col = 0;
  for (let i = 0; i < ln.length; i++, col++) {
    const ch = ln[i];
    const next = ln[i + 1];
    if (inComment) {
      if (inComment === '//' ) break;
      if (inComment === '/*' && ch === '*' && next === '/') {
        inComment = null;
        i++; col++;
        continue;
      }
      continue;
    }
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inComment = '//';
      i++; col++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = '/*';
      i++; col++;
      continue;
    }
    if ('([{'.includes(ch)) {
      stack.push({ ch, line, col });
      continue;
    }
    if (ch === ')') {
      const top = stack[stack.length - 1];
      if (!top || top.ch !== '(') {
        console.log('unmatched ) at', line, col);
      } else {
        stack.pop();
      }
      continue;
    }
    if (ch === '}') {
      const top = stack[stack.length - 1];
      if (!top || top.ch !== '{') {
        console.log('unmatched } at', line, col);
      } else {
        stack.pop();
      }
      continue;
    }
    if (ch === ']') {
      const top = stack[stack.length - 1];
      if (!top || top.ch !== '[') {
        console.log('unmatched ] at', line, col);
      } else {
        stack.pop();
      }
      continue;
    }
  }
  line++;
}
console.log('remaining', stack.map(x => `${x.ch}@${x.line}:${x.col}`));
