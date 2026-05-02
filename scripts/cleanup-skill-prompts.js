const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const replacements = [
  { from: /You are Claude/g, to: 'You are WorkBuddy' },
  { from: /你叫 Claude/g, to: '你叫 WorkBuddy' },
  { from: /你是一个 AI 助手/g, to: '你是 WorkBuddy，一个开源的 AI 助手' },
];

let count = 0;

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skillMd = path.join(fullPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        let content = fs.readFileSync(skillMd, 'utf-8');
        let modified = false;
        for (const { from, to } of replacements) {
          if (from.test(content)) {
            content = content.replace(from, to);
            modified = true;
          }
        }
        if (modified) {
          fs.writeFileSync(skillMd, content, 'utf-8');
          count++;
          console.log(`  ✓ ${entry.name}/SKILL.md`);
        }
      }
    }
  }
}

console.log('Cleaning skill prompts...');
processDir(SKILLS_DIR);
console.log(`Done! Modified ${count} files.`);
