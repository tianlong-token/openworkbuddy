import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const SKILLS_DIR = join(__dirname, '..', 'skills');
const ALLOWED_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'Agent', 'Glob', 'Grep',
  'TodoWrite', 'Task', 'Skill', 'Bash', 'Read', 'Write', 'Edit'
];

interface SkillMeta {
  name?: string;
  description?: string;
  description_zh?: string;
  version?: string;
  allowed_tools?: string;
  'allowed-tools'?: string;
}

function parseFrontmatter(content: string): SkillMeta {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1].replace(/\r/g, '');
  const meta: SkillMeta = {};

  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) meta.name = nameMatch[1].trim().replace(/['"]/g, '');

  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) meta.description = descMatch[1].trim().replace(/['"]/g, '');

  const descZhMatch = yaml.match(/^description_zh:\s*(.+)$/m);
  if (descZhMatch) meta.description_zh = descZhMatch[1].trim().replace(/['"]/g, '');

  const verMatch = yaml.match(/^version:\s*(.+)$/m);
  if (verMatch) meta.version = verMatch[1].trim().replace(/['"]/g, '');

  const toolsMatch = yaml.match(/^allowed-tools:\s*(.+)$/m);
  if (toolsMatch) meta['allowed-tools'] = toolsMatch[1].trim();

  return meta;
}

function validateSkill(slug: string, meta: SkillMeta): string[] {
  const errors: string[] = [];

  if (!meta.name) errors.push(`${slug}: missing 'name'`);
  if (!meta.description) errors.push(`${slug}: missing 'description'`);
  if (meta.description && meta.description.length > 300) errors.push(`${slug}: description too long (>300 chars)`);
  if (!meta.version) errors.push(`${slug}: missing 'version'`);
  if (meta.version && !/^\d+\.\d+\.\d+/.test(meta.version)) errors.push(`${slug}: invalid version format '${meta.version}'`);
  if (!meta['allowed-tools']) errors.push(`${slug}: missing 'allowed-tools'`);
  if (!/^[a-z0-9-]+$/.test(slug)) errors.push(`${slug}: invalid slug format (must be kebab-case)`);

  return errors;
}

function main() {
  if (!existsSync(SKILLS_DIR)) {
    console.error(`Skills directory not found: ${SKILLS_DIR}`);
    process.exit(1);
  }

  const skillDirs = readdirSync(SKILLS_DIR).filter((d) => {
    const fullPath = join(SKILLS_DIR, d);
    return existsSync(join(fullPath, 'SKILL.md'));
  });

  console.log(`Found ${skillDirs.length} skills\n`);

  let totalErrors = 0;
  const allErrors: string[] = [];

  for (const slug of skillDirs) {
    const skillPath = join(SKILLS_DIR, slug, 'SKILL.md');
    const content = readFileSync(skillPath, 'utf-8');
    const meta = parseFrontmatter(content);
    const errors = validateSkill(slug, meta);
    totalErrors += errors.length;
    allErrors.push(...errors);
  }

  if (totalErrors === 0) {
    console.log('All skills passed validation!');
  } else {
    console.error(`Found ${totalErrors} error(s):\n`);
    allErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}

main();
