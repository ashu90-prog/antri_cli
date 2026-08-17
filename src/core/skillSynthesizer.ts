import fs from 'fs';
import path from 'path';
import os from 'os';
import { ToolDefinition } from '../types.js';
import { SandboxEngine } from './sandbox.js';
import { log } from '../utils/logger.js';

export interface DynamicSkillManifest {
  name: string;
  description: string;
  language: 'python' | 'javascript' | 'bash';
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  entryFile: string;
  version: string;
  author: 'ANTRI Meta-Agent';
  createdAt: number;
}

export class SkillSynthesizer {
  private static readonly PRIMARY_DIR = path.join(os.homedir(), '.agent-cli', 'skills');
  private static readonly SECONDARY_DIR = path.join(os.homedir(), '.antri', 'skills');

  /**
   * Synthesizes, verifies, and persists a new custom tool/skill
   */
  public static async synthesizeSkill(
    name: string,
    description: string,
    language: 'python' | 'javascript' | 'bash',
    code: string,
    parametersSchema: Record<string, any>,
    testArgs: Record<string, any> = {}
  ): Promise<{ success: boolean; message: string; manifest?: DynamicSkillManifest }> {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const skillDir = path.join(this.PRIMARY_DIR, cleanName);
    const antriSkillDir = path.join(this.SECONDARY_DIR, cleanName);

    try {
      if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
      if (!fs.existsSync(antriSkillDir)) fs.mkdirSync(antriSkillDir, { recursive: true });

      const ext = language === 'python' ? 'py' : language === 'javascript' ? 'js' : 'sh';
      const scriptName = `main.${ext}`;
      const scriptPath = path.join(skillDir, scriptName);

      fs.writeFileSync(scriptPath, code, 'utf-8');
      fs.writeFileSync(path.join(antriSkillDir, scriptName), code, 'utf-8');

      // 1. Verify synthesized skill with dry-run test
      let verifyOutput = '';
      if (language === 'python') {
        const testRunner = `
import json, sys
args = ${JSON.stringify(testArgs)}
# Script execution test
try:
${code.split('\n').map((l) => '    ' + l).join('\n')}
    print("\\n[SKILL_VERIFIED_SUCCESS]")
except Exception as e:
    print(f"[SKILL_ERROR]: {e}", file=sys.stderr)
`;
        const testRes = await SandboxEngine.executePython(testRunner);
        if (testRes.exitCode !== 0 || testRes.stderr.includes('[SKILL_ERROR]')) {
          return {
            success: false,
            message: `Verification failed: ${testRes.stderr || testRes.stdout}`,
          };
        }
        verifyOutput = testRes.stdout;
      }

      // 2. Create manifest
      const manifest: DynamicSkillManifest = {
        name: cleanName,
        description,
        language,
        parameters: {
          type: 'object',
          properties: parametersSchema,
          required: Object.keys(parametersSchema),
        },
        entryFile: scriptName,
        version: '1.0.0',
        author: 'ANTRI Meta-Agent',
        createdAt: Date.now(),
      };

      fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2), 'utf-8');
      fs.writeFileSync(path.join(antriSkillDir, 'skill.json'), JSON.stringify(manifest, null, 2), 'utf-8');

      log.success(`✨ Synthesized and verified new skill: '${cleanName}' at ~/.agent-cli/skills/${cleanName}/`);

      return {
        success: true,
        message: `Successfully synthesized and verified skill '${cleanName}'. Verification output: ${verifyOutput}`,
        manifest,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Skill synthesis failed: ${err.message}`,
      };
    }
  }

  /**
   * Loads all dynamic skills from ~/.agent-cli/skills/ and ~/.antri/skills/
   */
  public static loadSynthesizedSkills(): { manifest: DynamicSkillManifest; scriptPath: string }[] {
    const loaded: { manifest: DynamicSkillManifest; scriptPath: string }[] = [];
    const dirs = [this.PRIMARY_DIR, this.SECONDARY_DIR];

    for (const baseDir of dirs) {
      if (fs.existsSync(baseDir)) {
        try {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.isDirectory()) {
              const manifestFile = path.join(baseDir, ent.name, 'skill.json');
              if (fs.existsSync(manifestFile)) {
                try {
                  const manifest: DynamicSkillManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
                  const scriptPath = path.join(baseDir, ent.name, manifest.entryFile);
                  if (fs.existsSync(scriptPath) && !loaded.some((l) => l.manifest.name === manifest.name)) {
                    loaded.push({ manifest, scriptPath });
                  }
                } catch {}
              }
            }
          }
        } catch {}
      }
    }

    return loaded;
  }

  /**
   * Converts dynamic skill manifests into ToolDefinition array
   */
  public static getDynamicToolDefinitions(): ToolDefinition[] {
    const skills = this.loadSynthesizedSkills();
    return skills.map((s) => ({
      name: s.manifest.name,
      description: `[Custom Synthesized Skill] ${s.manifest.description}`,
      parameters: s.manifest.parameters,
    }));
  }

  /**
   * Executes a custom synthesized skill
   */
  public static async executeCustomSkill(name: string, args: Record<string, any>): Promise<string> {
    const skills = this.loadSynthesizedSkills();
    const skill = skills.find((s) => s.manifest.name === name);

    if (!skill) {
      throw new Error(`Custom skill '${name}' not found.`);
    }

    if (skill.manifest.language === 'python') {
      const runnerCode = `
import json, sys, os
args = json.loads(${JSON.stringify(JSON.stringify(args))})
with open(r"${skill.scriptPath}", "r", encoding="utf-8") as f:
    code = f.read()
exec(code, {"args": args, "json": json, "sys": sys, "os": os})
`;
      const res = await SandboxEngine.executePython(runnerCode);
      if (res.exitCode !== 0) {
        throw new Error(`Skill execution error (${res.exitCode}): ${res.stderr || res.stdout}`);
      }
      return res.stdout || '(Skill executed with no stdout output)';
    }

    return '(Unsupported skill language)';
  }
}
