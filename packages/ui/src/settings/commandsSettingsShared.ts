import {
  WCODE_AGENT_PROVIDER,
  WCODE_COMMAND_AGENT_SOURCES,
  type WCodeProvider,
  type CommandAgentSource,
} from "@wcode/shared";

export const COMMAND_AGENT_SOURCES = [
  ...WCODE_COMMAND_AGENT_SOURCES,
] as const satisfies readonly CommandAgentSource[];

export const COMMAND_AGENT_SOURCE_META: Record<
  CommandAgentSource,
  {
    labelId: string;
    provider: WCodeProvider;
    pathHint: string;
  }
> = {
  wcodeAgent: {
    labelId: "settings.commands.source.wcodeAgent",
    pathHint: "~/.wcode/commands",
    provider: WCODE_AGENT_PROVIDER,
  },
};
