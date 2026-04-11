import type { SupabaseClient, User } from "@supabase/supabase-js";

export type ChiChiCapabilityPermission = "admin" | "portal_or_admin";

export type ChiChiCapabilityKind = "read" | "write" | "workflow";

export type ChiChiCapabilityContext<TIntent extends { action: string } = { action: string }> = {
  req: Request;
  admin: SupabaseClient;
  user: User;
  canWriteCore: boolean;
  lastUserMessage: string;
  recentUserMessages: string[];
  buyer?: unknown;
  puppy?: unknown;
  summary?: unknown;
  intent: TIntent;
};

export type ChiChiCapabilityResult = {
  text: string;
  proposal?: {
    title?: string;
    matched?: string[];
    missing?: string[];
    steps?: string[];
    nextAction?: string;
  };
};

export type ChiChiCapabilityDefinition<TIntent extends { action: string } = { action: string }> = {
  action: string;
  label: string;
  description: string;
  kind: ChiChiCapabilityKind;
  permission: ChiChiCapabilityPermission;
  getMissingFields?: (intent: TIntent) => string[];
  execute: (
    context: ChiChiCapabilityContext<TIntent>,
    intent: TIntent
  ) => Promise<string | ChiChiCapabilityResult>;
};

export function isCapabilityAllowed(
  capability: Pick<ChiChiCapabilityDefinition, "permission">,
  canWriteCore: boolean
) {
  return canWriteCore || capability.permission === "portal_or_admin";
}

export function buildCapabilityProposalText(params: {
  capabilityLabel: string;
  missing?: string[];
  matched?: string[];
  steps?: string[];
  nextAction?: string;
}) {
  const missing = (params.missing || []).filter(Boolean);
  const matched = (params.matched || []).filter(Boolean);
  const steps = (params.steps || []).filter(Boolean);
  const lines: string[] = [];

  lines.push(`I think you want me to ${params.capabilityLabel.toLowerCase()}.`);

  if (matched.length) {
    lines.push("");
    lines.push("What I matched:");
    lines.push(...matched.map((item) => `- ${item}`));
  }

  if (missing.length) {
    lines.push("");
    lines.push("What I still need before I mutate anything:");
    lines.push(...missing.map((item) => `- ${item}`));
  }

  if (steps.length) {
    lines.push("");
    lines.push("Planned workflow:");
    lines.push(...steps.map((item, index) => `${index + 1}. ${item}`));
  }

  if (params.nextAction) {
    lines.push("");
    lines.push(params.nextAction);
  }

  return lines.join("\n");
}

export async function executeRegisteredCapability<TIntent extends { action: string }>(
  registry: Record<string, ChiChiCapabilityDefinition<TIntent>>,
  context: ChiChiCapabilityContext<TIntent>,
  intent: TIntent
) {
  const capability = registry[intent.action];
  if (!capability) return null;

  const result = await capability.execute(context, intent);
  if (typeof result === "string") {
    return {
      capability,
      result: { text: result } satisfies ChiChiCapabilityResult,
    };
  }

  return {
    capability,
    result,
  };
}
