import { resolve } from "node:path";
import { createConfigWithPluginMigrations, resolvePath } from "@wcode/adapters/config";
import { createNodeSkillAdapter } from "@wcode/adapters/skills";
import type { Logger, SkillContent, SkillDiagnostic, SkillLoadOutcome } from "@wcode/contracts";
import { resolveBundledSkillRoots } from "./app/bundled-skills.js";
import { getCliStorageRoot } from "./app/paths.js";
import { filterVisualizeSkillRoots } from "./app/visualize-skill-gate.js";
import { resolveWCodePlugins, type ResolveWCodePluginsOptions } from "./plugins.js";
import { collectDisabledPaths } from "./skill-command-overrides.js";

export interface ListWCodeSkillsOptions {
  workspaceIdentity?: string;
  remoteSessionId?: string;
  pluginPreparation?: ResolveWCodePluginsOptions["pluginPreparation"];
  pluginDiscovery?: ResolveWCodePluginsOptions["pluginDiscovery"];
  env?: NodeJS.ProcessEnv;
  /** 协议宿主草稿目录使用；CLI 命令缺省关闭。 */
  includeVisualize?: boolean;
  logger?: Logger;
  projectConfigPath?: string;
  skipUserConfig?: boolean;
  userConfigPath?: string;
  workingDirectory?: string;
}

export interface InspectWCodeSkillOptions extends ListWCodeSkillsOptions {
  name: string;
}

export interface WCodeSkillInspection {
  diagnostics: SkillDiagnostic[];
  skill: SkillContent;
}

export async function listWCodeSkills(
  options: ListWCodeSkillsOptions = {},
): Promise<SkillLoadOutcome> {
  const discovery = await createSkillDiscovery(options);
  if (!discovery.enabled) {
    return {
      diagnostics: [],
      skills: [],
      totalDiscovered: 0,
    };
  }

  return await discovery.skillPort.discoverSkills({
    workingDirectory: discovery.workingDirectory,
  });
}

export async function inspectWCodeSkill(
  options: InspectWCodeSkillOptions,
): Promise<WCodeSkillInspection> {
  const discovery = await createSkillDiscovery(options);
  if (!discovery.enabled) {
    throw new Error("Skills are disabled.");
  }

  const outcome = await discovery.skillPort.discoverSkills({
    workingDirectory: discovery.workingDirectory,
  });
  if (
    !outcome.skills.some(
      (skill) => skill.name === options.name || skill.qualifiedName === options.name,
    )
  ) {
    throw new Error(`Skill not found: ${options.name}`);
  }

  const skill = await discovery.skillPort.loadSkill({
    name: options.name,
    workingDirectory: discovery.workingDirectory,
  });

  return {
    diagnostics: outcome.diagnostics,
    skill,
  };
}

async function createSkillDiscovery(options: ListWCodeSkillsOptions): Promise<
  | {
      enabled: false;
      workingDirectory: string;
    }
  | {
      enabled: true;
      skillPort: ReturnType<typeof createNodeSkillAdapter>;
      workingDirectory: string;
    }
> {
  const workingDirectory = resolve(options.workingDirectory ?? process.cwd());
  const configResult = await createConfigWithPluginMigrations({
    env: options.env,
    projectConfigPath: options.projectConfigPath,
    workingDirectory,
    skipUserConfig: options.skipUserConfig,
    userConfigPath: options.userConfigPath,
  });

  if (!configResult.config.features.skill || !configResult.config.skills.enabled) {
    return {
      enabled: false,
      workingDirectory,
    };
  }
  const pluginOutcome = await resolveWCodePlugins({
    pluginPreparation: options.pluginPreparation,
    pluginDiscovery: options.pluginDiscovery,
    workspaceIdentity: options.workspaceIdentity,
    remoteSessionId: options.remoteSessionId,
    configResult,
    env: options.env,
    logger: options.logger,
    projectConfigPath: options.projectConfigPath,
    skipUserConfig: options.skipUserConfig,
    userConfigPath: options.userConfigPath,
    workingDirectory,
  });

  // 内置技能包与插件技能根并列注入：`wcode skills list`、引用目录与 runtime 看到同一份发现结果。
  const bundledSkillRoots = resolveBundledSkillRoots({
    cliStorageRoot: getCliStorageRoot(resolvePath(configResult.config.storage.dir)),
    logger: options.logger,
  });

  return {
    enabled: true,
    skillPort: createNodeSkillAdapter({
      extraRoots: configResult.config.skills.roots,
      extraResolvedRoots: [
        ...filterVisualizeSkillRoots(pluginOutcome.skillRoots, options.includeVisualize),
        ...bundledSkillRoots,
      ],
      disabledPaths: collectDisabledPaths(configResult.config.skillOverrides),
    }),
    workingDirectory,
  };
}
