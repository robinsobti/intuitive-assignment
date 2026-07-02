export type TerraformPlanErrorCode =
  | "INVALID_JSON"
  | "INVALID_TERRAFORM_PLAN";

export class TerraformPlanError extends Error {
  constructor(
    readonly code: TerraformPlanErrorCode,
    message: string
  ) {
    super(message);
    this.name = "TerraformPlanError";
  }
}

export type TerraformPlan = {
  formatVersion?: string;
  terraformVersion?: string;
  resourceChanges: TerraformPlanResourceChange[];
};

export type TerraformPlanResourceChange = {
  address: string;
  type: string;
  name: string;
  providerName?: string;
  change: {
    actions: string[];
    before?: unknown;
    after?: unknown;
  };
};

export type NormalizedResourceAction =
  | "create"
  | "update"
  | "delete"
  | "replace"
  | "no-op"
  | "unknown";

export type NormalizedTags = {
  all: Record<string, string>;
  owner?: string;
  service?: string;
  environment?: string;
};

export type NormalizedResourceChange = {
  address: string;
  type: string;
  name: string;
  providerName?: string;
  action: NormalizedResourceAction;
  actions: string[];
  before?: unknown;
  after?: unknown;
  tags: NormalizedTags;
};

export type TerraformChangeSummary = {
  total: number;
  create: number;
  update: number;
  delete: number;
  replace: number;
  noOp: number;
  unknown: number;
  byType: Record<string, number>;
  changes: NormalizedResourceChange[];
};

export function parsePlanInput(input: unknown): TerraformPlan {
  const parsedInput = parseJsonInput(input);

  if (!isRecord(parsedInput) || !Array.isArray(parsedInput.resource_changes)) {
    throw new TerraformPlanError(
      "INVALID_TERRAFORM_PLAN",
      "Terraform plan must include resource_changes as an array."
    );
  }

  return {
    formatVersion: getOptionalString(parsedInput.format_version),
    terraformVersion: getOptionalString(parsedInput.terraform_version),
    resourceChanges: parsedInput.resource_changes.map(normalizePlanChange)
  };
}

export function summarizeResourceChanges(
  plan: TerraformPlan
): TerraformChangeSummary {
  const summary: TerraformChangeSummary = {
    total: plan.resourceChanges.length,
    create: 0,
    update: 0,
    delete: 0,
    replace: 0,
    noOp: 0,
    unknown: 0,
    byType: {},
    changes: []
  };

  for (const change of plan.resourceChanges) {
    const normalizedChange = normalizeResourceChange(change);
    summary.changes.push(normalizedChange);
    summary.byType[normalizedChange.type] =
      (summary.byType[normalizedChange.type] ?? 0) + 1;

    switch (normalizedChange.action) {
      case "create":
        summary.create += 1;
        break;
      case "update":
        summary.update += 1;
        break;
      case "delete":
        summary.delete += 1;
        break;
      case "replace":
        summary.replace += 1;
        break;
      case "no-op":
        summary.noOp += 1;
        break;
      case "unknown":
        summary.unknown += 1;
        break;
    }
  }

  return summary;
}

export function normalizeActions(actions: string[]): NormalizedResourceAction {
  if (actions.length === 1) {
    switch (actions[0]) {
      case "create":
        return "create";
      case "update":
        return "update";
      case "delete":
        return "delete";
      case "no-op":
        return "no-op";
    }
  }

  if (
    actions.length === 2 &&
    actions.includes("delete") &&
    actions.includes("create")
  ) {
    return "replace";
  }

  return "unknown";
}

function parseJsonInput(input: unknown) {
  if (typeof input !== "string") {
    return input;
  }

  try {
    return JSON.parse(input);
  } catch {
    throw new TerraformPlanError(
      "INVALID_JSON",
      "Terraform plan input was not valid JSON."
    );
  }
}

function normalizePlanChange(input: unknown): TerraformPlanResourceChange {
  const rawChange = isRecord(input) ? input : {};
  const rawChangeBody = isRecord(rawChange.change) ? rawChange.change : {};

  return {
    address: getRequiredString(rawChange.address),
    type: getRequiredString(rawChange.type),
    name: getRequiredString(rawChange.name),
    providerName: getOptionalString(rawChange.provider_name),
    change: {
      actions: getStringArray(rawChangeBody.actions),
      before: rawChangeBody.before,
      after: rawChangeBody.after
    }
  };
}

function normalizeResourceChange(
  change: TerraformPlanResourceChange
): NormalizedResourceChange {
  return {
    address: change.address,
    type: change.type,
    name: change.name,
    providerName: change.providerName,
    action: normalizeActions(change.change.actions),
    actions: change.change.actions,
    before: change.change.before,
    after: change.change.after,
    tags: extractTags(change.change.before, change.change.after)
  };
}

function extractTags(before: unknown, after: unknown): NormalizedTags {
  const all = {
    ...extractTagsFromValue(before, "tags_all"),
    ...extractTagsFromValue(before, "tags"),
    ...extractTagsFromValue(after, "tags_all"),
    ...extractTagsFromValue(after, "tags")
  };

  return {
    all,
    owner: normalizeTagValue(findTagValue(all, ["owner"])),
    service: normalizeTagValue(findTagValue(all, ["service"])),
    environment: normalizeTagValue(findTagValue(all, ["environment", "env"]))
  };
}

function extractTagsFromValue(value: unknown, key: "tags" | "tags_all") {
  if (!isRecord(value) || !isRecord(value[key])) {
    return {};
  }

  const tags: Record<string, string> = {};

  for (const [tagKey, tagValue] of Object.entries(value[key])) {
    if (
      typeof tagValue === "string" ||
      typeof tagValue === "number" ||
      typeof tagValue === "boolean"
    ) {
      tags[tagKey] = String(tagValue);
    }
  }

  return tags;
}

function findTagValue(tags: Record<string, string>, keys: string[]) {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  const entries = Object.entries(tags).reverse();

  for (const [key, value] of entries) {
    if (normalizedKeys.has(key.toLowerCase())) {
      return value;
    }
  }

  return undefined;
}

function normalizeTagValue(value: string | undefined) {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue === "" ? undefined : normalizedValue;
}

function getRequiredString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
