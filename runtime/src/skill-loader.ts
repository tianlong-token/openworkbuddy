import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Skill, SkillFrontmatter } from './types';

const ALLOWED_TOOL_NAMES = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'Agent', 'TodoWrite', 'Task', 'Skill',
  'AskUserQuestion',
] as const;

const TOOL_ALIASES: Record<string, string> = {
  'Ask': 'AskUserQuestion',
};

function normalizeToolName(raw: string): string {
  let tool = raw.trim();
  // Strip YAML list prefix (e.g., "- Read" -> "Read")
  if (tool.startsWith('- ')) tool = tool.substring(2).trim();
  // Extract base tool name from parameterized format (e.g., "Bash(subcmd:*)" -> "Bash")
  const parenIdx = tool.indexOf('(');
  if (parenIdx > 0) tool = tool.substring(0, parenIdx).trim();
  // Resolve known aliases
  if (TOOL_ALIASES[tool]) tool = TOOL_ALIASES[tool];
  return tool;
}

export function parseFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('No YAML frontmatter found in SKILL.md');
  }

  const yaml = match[1].replace(/\r/g, '');
  const meta: Record<string, unknown> = {};

  const simpleKeys = ['name', 'description', 'description_zh', 'description_en', 'version', 'homepage'];
  for (const key of simpleKeys) {
    // Handle quoted values (possibly multi-line)
    const quotedRegex = new RegExp(`^${key}:\\s*"([^"]*)"`, 'm');
    const qm = yaml.match(quotedRegex);
    if (qm) {
      meta[key] = qm[1].trim().replace(/\s+/g, ' ');
      continue;
    }
    // Handle single-quoted values
    const singleQuotedRegex = new RegExp(`^${key}:\\s*'([^']*)'`, 'm');
    const sm = yaml.match(singleQuotedRegex);
    if (sm) {
      meta[key] = sm[1].trim().replace(/\s+/g, ' ');
      continue;
    }
    // Handle unquoted single-line values
    const unquotedRegex = new RegExp(`^${key}:\\s*([^\\n]+)`, 'm');
    const um = yaml.match(unquotedRegex);
    if (um) meta[key] = um[1].trim().replace(/^["']|["']$/g, '');
  }

  const allowedToolsMatch = yaml.match(/^allowed-tools:\s*(.+)$/m);
  if (allowedToolsMatch) {
    const raw = allowedToolsMatch[1].trim();
    meta['allowed-tools'] = raw;
  }

  const metadataSection = yaml.match(/^metadata:\s*\n((?:[ \t]+.+\n?)+)/m);
  if (metadataSection) {
    const md: Record<string, unknown> = {};
    const lines = metadataSection[1].split('\n');
    for (const line of lines) {
      const kv = line.match(/^\s+(\w+):\s*(.+)$/);
      if (kv) {
        const [, key, val] = kv;
        if (key === 'tags' || key === 'requires') {
          const items = val.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
          md[key] = items;
        } else {
          md[key] = val.trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    meta.metadata = md;
  }

  return meta as unknown as SkillFrontmatter;
}

export function validateSkill(frontmatter: SkillFrontmatter, slug: string): string[] {
  const errors: string[] = [];

  if (!frontmatter.name) errors.push(`missing 'name'`);
  if (frontmatter.name && frontmatter.name !== slug) errors.push(`name '${frontmatter.name}' does not match slug '${slug}'`);
  if (!frontmatter.description) errors.push(`missing 'description'`);
  if (frontmatter.description && frontmatter.description.length > 300) errors.push(`description exceeds 300 chars (${frontmatter.description.length})`);
  if (!frontmatter.version) errors.push(`missing 'version'`);
  if (frontmatter.version && !/^\d+\.\d+\.\d+/.test(frontmatter.version)) errors.push(`invalid semver: '${frontmatter.version}'`);
  if (!frontmatter['allowed-tools']) errors.push(`missing 'allowed-tools'`);

  if (frontmatter['allowed-tools']) {
    const tools = frontmatter['allowed-tools'].split(',').map(s => s.trim());
    for (const rawTool of tools) {
      const tool = normalizeToolName(rawTool);
      if (!ALLOWED_TOOL_NAMES.includes(tool as typeof ALLOWED_TOOL_NAMES[number])) {
        errors.push(`unknown tool: '${rawTool}' (normalized: '${tool}')`);
      }
    }
  }

  return errors;
}

export function loadSkill(slug: string, skillsDir: string): Skill | null {
  const skillDir = join(skillsDir, slug);
  const skillMd = join(skillDir, 'SKILL.md');

  if (!existsSync(skillMd)) return null;

  const content = readFileSync(skillMd, 'utf-8');
  const frontmatter = parseFrontmatter(content);
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

  const scriptsDir = join(skillDir, 'scripts');
  const referencesDir = join(skillDir, 'references');
  const assetsDir = join(skillDir, 'assets');
  const templatesDir = join(skillDir, 'templates');

  const listDirFiles = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    try {
      return readdirSync(dir).filter((f: string) => statSync(join(dir, f)).isFile()).map((f: string) => join(dir, f));
    } catch {
      return [];
    }
  };

  return {
    slug,
    frontmatter,
    body,
    directory: skillDir,
    hasScripts: existsSync(scriptsDir),
    hasReferences: existsSync(referencesDir),
    hasAssets: existsSync(assetsDir),
    hasTemplates: existsSync(templatesDir),
    scriptPaths: listDirFiles(scriptsDir),
    referencePaths: listDirFiles(referencesDir),
  };
}

export function listSkills(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter((name: string) => {
    const fullPath = join(skillsDir, name);
    return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'SKILL.md'));
  });
}

export function loadAllSkills(skillsDir: string): Skill[] {
  const slugs = listSkills(skillsDir);
  const skills: Skill[] = [];
  const errors: { slug: string; error: string }[] = [];

  for (const slug of slugs) {
    try {
      const skill = loadSkill(slug, skillsDir);
      if (skill) {
        const validationErrors = validateSkill(skill.frontmatter, slug);
        if (validationErrors.length > 0) {
          errors.push({ slug, error: validationErrors.join(', ') });
        }
        skills.push(skill);
      }
    } catch (e) {
      errors.push({ slug, error: (e as Error).message });
    }
  }

  if (errors.length > 0) {
    console.warn(`Loaded ${skills.length} skills, ${errors.length} had validation warnings (use 'workbuddy validate' for details)`);
  }

  return skills;
}

export function searchSkills(skills: Skill[], query: string): Skill[] {
  const q = query.toLowerCase();
  return skills.filter(skill => {
    const { slug, frontmatter } = skill;
    return (
      slug.toLowerCase().includes(q) ||
      (frontmatter.name && frontmatter.name.toLowerCase().includes(q)) ||
      (frontmatter.description && frontmatter.description.toLowerCase().includes(q)) ||
      (frontmatter.description_zh && frontmatter.description_zh.includes(query)) ||
      (frontmatter.metadata?.tags && frontmatter.metadata.tags.some(t => t.toLowerCase().includes(q))) ||
      (frontmatter.metadata?.category && frontmatter.metadata.category.toLowerCase().includes(q))
    );
  });
}

export function getSkillBySlug(skills: Skill[], slug: string): Skill | undefined {
  return skills.find(s => s.slug === slug);
}
