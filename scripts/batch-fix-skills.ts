import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SKILLS_DIR = process.env.WORKBUDDY_SKILLS_DIR || join(__dirname, '..', 'skills');

// Smart default: infer allowed-tools from skill content
function inferAllowedTools(slug: string, content: string, hasScripts: boolean): string {
  // Check for explicit tool mentions in the body
  const tools = new Set<string>();
  
  // Default base tools for most skills
  tools.add('Read');
  
  if (content.includes('Write') || content.includes('write') || content.includes('create') || content.includes('generate')) {
    tools.add('Write');
  }
  
  if (content.includes('Edit') || content.includes('edit') || content.includes('replace') || content.includes('update')) {
    tools.add('Edit');
  }
  
  if (content.includes('Bash') || content.includes('shell') || content.includes('run ') || content.includes('execute') || content.includes('CLI') || content.includes('command') || hasScripts) {
    tools.add('Bash');
  }
  
  if (content.includes('Glob') || content.includes('find ') || content.includes('pattern') || content.includes('*.ts') || content.includes('*.md')) {
    tools.add('Glob');
  }
  
  if (content.includes('Grep') || content.includes('search') || content.includes('grep') || content.includes('regex')) {
    tools.add('Grep');
  }
  
  if (content.includes('WebFetch') || content.includes('fetch') || content.includes('URL') || content.includes('http') || content.includes('web')) {
    tools.add('WebFetch');
  }
  
  if (content.includes('WebSearch') || content.includes('search the web') || content.includes('Google') || content.includes('search engine')) {
    tools.add('WebSearch');
  }
  
  // If nothing specific was inferred, use a reasonable default
  if (tools.size <= 1) {
    return 'Read, Write, Bash, Glob, Grep';
  }
  
  return Array.from(tools).join(', ');
}

// Skills that need special treatment
const SPECIAL_TOOLS: Record<string, string> = {
  'deep-research': 'Read, Write, Glob, Grep, WebSearch, WebFetch',
  'github': 'Read, Write, Bash, Glob, Grep',
  'email-skill': 'Read, Write, Bash',
  'web-scraper': 'Read, Write, Bash, WebFetch, WebSearch, Glob, Grep',
  'mcp-builder': 'Read, Write, Bash, Glob, Grep',
  'frontend-dev': 'Read, Write, Bash, Glob, Grep',
  'fullstack-dev': 'Read, Write, Bash, Glob, Grep',
  'novel-writer': 'Read, Write, Bash',
  'blogwatcher': 'Read, Write, Bash, WebFetch',
  'stock-analysis': 'Read, Write, Bash, WebFetch',
  'education': 'Read, Write, Bash',
  'obsidian': 'Read, Write, Bash, Glob, Grep',
  'note-organizer': 'Read, Write, Bash, Glob, Grep',
  'llm-wiki': 'Read, Write, Bash, Glob, Grep',
  'weather': 'Read, Bash, WebFetch',
  'summarize': 'Read, Write, Bash, WebFetch',
  'tmux': 'Read, Write, Bash',
  'trello': 'Read, Write, Bash, WebFetch',
  'skills-security-check': 'Read, Write, Bash, Glob, Grep',
  'skill-creator': 'Read, Write, Bash, Glob',
  'skill-scanner': 'Read, Write, Bash, Glob, Grep',
  'skill-vetter': 'Read, Write, Bash, Glob, Grep',
  'agent-team-orchestration': 'Read, Write, Bash, Glob',
  'cangjie-skill': 'Read, Write, Bash, Glob, Grep',
  'nuwa-skill': 'Read, Write, Bash, Glob',
  'yourself-skill': 'Read, Write, Bash, Glob',
  'colleague-skill': 'Read, Write, Bash, Glob',
  'boss-skills': 'Read, Write, Bash',
  'browser': 'Read, Write, Bash',
  'browser-use': 'Read, Write, Bash',
  'stealth-browser': 'Read, Write, Bash',
  'smooth-browser': 'Read, Write, Bash',
  'playwright-browser-automation': 'Read, Write, Bash',
  'playwright-scraper-skill': 'Read, Write, Bash, WebFetch',
  'multi-search-engine': 'Read, Write, Bash, WebSearch, WebFetch',
  'market-researcher': 'Read, Write, Bash, WebSearch, WebFetch',
  'autoresearch': 'Read, Write, Bash, WebSearch, WebFetch',
  'citation-manager': 'Read, Write, Bash, WebFetch',
  'xurl': 'Read, Write, Bash, WebFetch',
  'arxiv-watcher': 'Read, Write, Bash, WebFetch',
  'arxiv-reader': 'Read, Write, Bash, WebFetch',
  'news-summary': 'Read, Write, Bash, WebFetch',
  'macro-monitor': 'Read, Write, Bash, WebFetch',
  'notebooklm-studio': 'Read, Write, Bash',
  'infographic-maker': 'Read, Write, Bash',
  'canvas-design': 'Read, Write, Bash',
  'deck-generator': 'Read, Write, Bash',
  'pptx-generator': 'Read, Write, Bash',
  'pdfkit-py': 'Read, Write, Bash',
  'nano-pdf': 'Read, Write, Bash',
  'remotion-video-toolkit': 'Read, Write, Bash',
  'video-frames': 'Read, Write, Bash',
  'gifgrep': 'Read, Write, Bash',
  'gif-sticker-maker': 'Read, Write, Bash',
  'songsee': 'Read, Write, Bash',
  'sag': 'Read, Write, Bash',
  'peekaboo': 'Read, Write, Bash',
  'himalaya': 'Read, Write, Bash',
  'imap-smtp-email': 'Read, Write, Bash',
  'gmail': 'Read, Write, Bash',
  'gog': 'Read, Write, Bash',
  'caldav-calendar': 'Read, Write, Bash',
  'apple-notes': 'Read, Write, Bash',
  'apple-reminders': 'Read, Write, Bash',
  'things-mac': 'Read, Write, Bash',
  'imsg': 'Read, Write, Bash',
  'wacli': 'Read, Write, Bash',
  'tutor-skills': 'Read, Write, Bash, Glob, Grep',
  'open-lesson': 'Read, Write, Bash, WebFetch',
  'healthcheck': 'Read, Write, Bash',
  'goal-tracker': 'Read, Write, Bash',
  'habit-tracker': 'Read, Write, Bash',
  'earnings-tracker': 'Read, Write, Bash, WebFetch',
  'stock-analyzer': 'Read, Write, Bash, WebFetch',
  'us-stock-analysis': 'Read, Write, Bash, WebFetch',
  'westock-data': 'Read, Write, Bash, WebFetch',
  'finance-ops': 'Read, Write, Bash',
  'sales-pipeline': 'Read, Write, Bash, WebFetch',
  'sales-playbook': 'Read, Write, Bash',
  'revenue-intelligence': 'Read, Write, Bash, WebFetch',
  'growth-engine': 'Read, Write, Bash, WebFetch',
  'outbound-engine': 'Read, Write, Bash',
  'marketing-skills': 'Read, Write, Bash, WebFetch',
  'seo-ops': 'Read, Write, Bash, WebFetch',
  'conversion-ops': 'Read, Write, Bash, WebFetch',
  'podcast-ops': 'Read, Write, Bash',
  'content-factory': 'Read, Write, Bash',
  'content-ops': 'Read, Write, Bash',
  'content-repurposer': 'Read, Write, Bash',
  'x-longform-post': 'Read, Write, Bash',
  'fbs-bookwriter': 'Read, Write, Bash',
  'khazix-writer': 'Read, Write, Bash',
  'novel-writing': 'Read, Write, Bash',
  'open-novel-writing': 'Read, Write, Bash',
  'my-novel-writer': 'Read, Write, Bash',
  'novel': 'Read, Write, Bash',
  'brand-guidelines': 'Read, Write, Bash',
  'awesome-design-md': 'Read, Write, Bash',
  'excalidraw-diagram': 'Read, Write, Bash',
  'idea-validator': 'Read, Write, Bash, WebSearch, WebFetch',
  'the-entrepreneurship-handbook': 'Read, Write',
  'legal-logic-analysis': 'Read, Write, Bash',
  'prompt-engineering-expert': 'Read, Write',
  'oracle': 'Read, Write, Bash',
  'impeccable': 'Read, Write, Bash',
  'humanizer': 'Read, Write',
  'capability-evolver': 'Read, Write, Bash',
  'darwin-skill': 'Read, Write, Bash',
  'anti-distill': 'Read, Write, Bash, Glob, Grep',
  'workrally': 'Read, Write, Bash',
  'lark-unified': 'Read, Write, Bash, WebFetch',
  'cli-anything-hub': 'Read, Write, Bash',
  'api-gateway': 'Read, Write, Bash, WebFetch',
  'android-native-dev': 'Read, Write, Bash',
  'flutter-dev': 'Read, Write, Bash',
  'ios-application-dev': 'Read, Write, Bash',
  'react-native-dev': 'Read, Write, Bash',
  'shader-dev': 'Read, Write, Bash',
  'github-ai-trends': 'Read, Write, Bash, WebFetch',
  'github-trending-cn': 'Read, Write, Bash, WebFetch',
  'mcporter': 'Read, Write, Bash',
  'model-usage': 'Read, Write, Bash',
  'charity-finance-assistant': 'Read, Write, Bash',
  'charity-writing-assistant': 'Read, Write, Bash',
  'porteden-email': 'Read, Write, Bash',
  'email-daily-summary': 'Read, Write, Bash',
  'clawbrowser': 'Read, Write, Bash',
  'agent-mail': 'Read, Write, Bash',
  'agent-browser-core': 'Read, Write, Bash',
  'ima-skills': 'Read, Write, Bash',
  'qmd': 'Read, Write, Bash, Glob',
  'nano-banana-pro': 'Read, Write, Bash',
  'xiaohongshu': 'Read, Write, Bash, WebFetch',
  'admapix': 'Read, Write, Bash, WebFetch',
  'cos-vectors': 'Read, Write, Bash',
  'migraq': 'Read, Write, Bash, WebFetch',
  'markitdown-skill': 'Read, Write, Bash',
  'crash-expert-skill': 'Read, Write, Bash',
  'skills-security-check': 'Read, Write, Bash, Glob, Grep',
  'neodata-financial-search': 'Read, Write, Bash, WebFetch',
  'yt-competitive-analysis': 'Read, Write, Bash, WebFetch',
};

function fixSkill(slug: string): { fixed: boolean; message: string } {
  const skillMd = join(SKILLS_DIR, slug, 'SKILL.md');
  if (!existsSync(skillMd)) return { fixed: false, message: 'SKILL.md not found' };

  const content = readFileSync(skillMd, 'utf-8');
  let modified = false;
  let messages: string[] = [];

  // Check if there's frontmatter at all
  const hasFrontmatter = content.match(/^---\r?\n/m);
  
  if (!hasFrontmatter) {
    // Create minimal frontmatter
    const hasScripts = existsSync(join(SKILLS_DIR, slug, 'scripts'));
    const tools = SPECIAL_TOOLS[slug] || inferAllowedTools(slug, content, hasScripts);
    const newFrontmatter = `---
name: ${slug}
description: "Skill for ${slug.replace(/-/g, ' ')}"
version: 0.1.0
allowed-tools: ${tools}
---

`;
    writeFileSync(skillMd, newFrontmatter + content, 'utf-8');
    messages.push('Created frontmatter');
    return { fixed: true, message: messages.join(', ') };
  }

  // Parse existing frontmatter
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { fixed: false, message: 'No frontmatter match' };

  let yaml = match[1].replace(/\r/g, '');
  const body = content.slice(match[0].length);

  // Fix missing version
  if (!/^version:/m.test(yaml)) {
    yaml += '\nversion: 0.1.0';
    modified = true;
    messages.push('Added version');
  }

  // Fix missing allowed-tools
  if (!/^allowed-tools:/m.test(yaml)) {
    const hasScripts = existsSync(join(SKILLS_DIR, slug, 'scripts'));
    const tools = SPECIAL_TOOLS[slug] || inferAllowedTools(slug, body, hasScripts);
    yaml += `\nallowed-tools: ${tools}`;
    modified = true;
    messages.push(`Added allowed-tools: ${tools}`);
  }

  // Fix missing name
  if (!/^name:/m.test(yaml)) {
    yaml = `name: ${slug}\n` + yaml;
    modified = true;
    messages.push('Added name');
  }

  // Fix missing description
  if (!/^description:/m.test(yaml)) {
    yaml = `description: "Skill for ${slug.replace(/-/g, ' ')}"\n` + yaml;
    modified = true;
    messages.push('Added description');
  }

  if (modified) {
    const newContent = `---\n${yaml}\n---\n${body}`;
    writeFileSync(skillMd, newContent, 'utf-8');
  }

  return { fixed: modified, message: messages.join(', ') || 'No changes needed' };
}

function main() {
  if (!existsSync(SKILLS_DIR)) {
    console.error(`Skills directory not found: ${SKILLS_DIR}`);
    process.exit(1);
  }

  const skillDirs = readdirSync(SKILLS_DIR).filter(name => {
    const fullPath = join(SKILLS_DIR, name);
    return statSync(fullPath).isDirectory();
  }).sort();

  console.log(`Processing ${skillDirs.length} skills...\n`);

  let totalFixed = 0;
  const details: { slug: string; message: string }[] = [];

  for (const slug of skillDirs) {
    const result = fixSkill(slug);
    if (result.fixed || result.message.includes('Created') || result.message.includes('Added')) {
      totalFixed++;
      details.push({ slug, message: result.message });
    }
  }

  console.log(`Fixed ${totalFixed} skills:\n`);
  details.forEach(d => console.log(`  ${d.slug}: ${d.message}`));
}

main();
