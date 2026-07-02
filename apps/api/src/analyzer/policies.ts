import type {
  Finding as SharedFinding,
  PolicyResult as SharedPolicyResult,
  Recommendation,
  Severity
} from "@infra-review/shared";
import type {
  NormalizedResourceAction,
  NormalizedResourceChange,
  TerraformChangeSummary
} from "./terraformPlan.js";

type PolicyCheck = {
  checkId: string;
  name: string;
  run: (summary: TerraformChangeSummary) => PolicyFinding[];
};

export type PolicyFinding = SharedFinding & {
  checkId: string;
  resourceType: string;
  action: NormalizedResourceAction;
  explanation: string;
  remediation: string;
  evidence?: Record<string, unknown>;
};

export type PolicyResult = SharedPolicyResult & {
  checkId: string;
  findings: PolicyFinding[];
};

const severityRank: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const policyChecks: PolicyCheck[] = [
  {
    checkId: "destructive-change",
    name: "Destructive resource changes",
    run: checkDestructiveChanges
  },
  {
    checkId: "production-destructive-change",
    name: "Production destructive resource changes",
    run: checkProductionDestructiveChanges
  },
  {
    checkId: "public-admin-ingress",
    name: "Public administrative ingress",
    run: checkPublicAdminIngress
  },
  {
    checkId: "public-s3-access",
    name: "Public S3 access",
    run: checkPublicS3Access
  },
  {
    checkId: "wildcard-iam-policy",
    name: "Wildcard IAM policies",
    run: checkWildcardIamPolicy
  },
  {
    checkId: "required-tags",
    name: "Required resource tags",
    run: checkRequiredTags
  }
];

export function runPolicyChecks(summary: TerraformChangeSummary) {
  return policyChecks.map((check) => buildPolicyResult(check, summary));
}

export function collectPolicyFindings(policyResults: PolicyResult[]) {
  return policyResults
    .flatMap((result) => result.findings)
    .sort(compareFindingsBySeverity);
}

export function maxSeverity(findings: PolicyFinding[]): Severity {
  return findings.reduce<Severity>(
    (currentSeverity, finding) =>
      severityRank[finding.severity] > severityRank[currentSeverity]
        ? finding.severity
        : currentSeverity,
    "LOW"
  );
}

function buildPolicyResult(
  check: PolicyCheck,
  summary: TerraformChangeSummary
): PolicyResult {
  const findings = check.run(summary).sort(compareFindingsBySeverity);
  const severity = maxSeverity(findings);
  const recommendation = recommendationForFindings(findings);

  return {
    checkId: check.checkId,
    policyId: check.checkId,
    name: check.name,
    passed: findings.length === 0,
    severity,
    recommendation,
    findingIds: findings.map((finding) => finding.id),
    message:
      findings.length === 0
        ? "No findings."
        : `${findings.length} finding${findings.length === 1 ? "" : "s"}.`,
    findings
  };
}

function checkDestructiveChanges(summary: TerraformChangeSummary) {
  return summary.changes
    .filter(isDestructive)
    .map((change) =>
      createFinding({
        checkId: "destructive-change",
        severity: "HIGH",
        title: "Resource will be destroyed or replaced",
        change,
        explanation: `${change.address} has a planned ${change.action} action.`,
        remediation:
          "Confirm the deletion or replacement is intentional and that recovery, backup, or rollback plans are in place.",
        evidence: {
          action: change.action,
          terraformActions: change.actions
        }
      })
    );
}

function checkProductionDestructiveChanges(summary: TerraformChangeSummary) {
  return summary.changes
    .filter((change) => isDestructive(change) && isProductionTagged(change))
    .map((change) =>
      createFinding({
        checkId: "production-destructive-change",
        severity: "CRITICAL",
        title: "Production resource will be destroyed or replaced",
        change,
        explanation: `${change.address} is tagged as production and has a planned ${change.action} action.`,
        remediation:
          "Require explicit production approval and validate backup, restore, and maintenance-window plans before applying.",
        evidence: {
          action: change.action,
          environment: change.tags.environment,
          terraformActions: change.actions,
          tags: change.tags.all
        }
      })
    );
}

function checkPublicAdminIngress(summary: TerraformChangeSummary) {
  const findings: PolicyFinding[] = [];

  for (const change of summary.changes) {
    if (change.type !== "aws_security_group") {
      continue;
    }

    for (const ingress of getIngressRules(change)) {
      const publicSources = getPublicSources(ingress);

      if (publicSources.length === 0) {
        continue;
      }

      const adminExposure = getAdminExposure(ingress);

      if (adminExposure.length === 0) {
        continue;
      }

      findings.push(
        createFinding({
          checkId: "public-admin-ingress",
          severity: "CRITICAL",
          title: "Security group exposes administrative access publicly",
          change,
          explanation: `${change.address} allows public ingress to administrative access (${adminExposure.join(", ")}).`,
          remediation:
            "Restrict administrative ingress to trusted CIDR ranges, VPN, bastion hosts, or managed access services.",
          evidence: {
            publicSources,
            adminExposure,
            ingress
          }
        })
      );
    }
  }

  return findings;
}

function checkPublicS3Access(summary: TerraformChangeSummary) {
  const findings: PolicyFinding[] = [];

  for (const change of summary.changes) {
    const resource = preferredResourceState(change);

    if (change.type === "aws_s3_bucket_acl") {
      const acl = isRecord(resource) ? resource.acl : undefined;

      if (acl === "public-read" || acl === "public-read-write") {
        findings.push(
          createFinding({
            checkId: "public-s3-access",
            severity: "HIGH",
            title: "S3 bucket ACL grants public access",
            change,
            explanation: `${change.address} uses the ${acl} ACL.`,
            remediation:
              "Use private bucket ACLs and grant access through least-privilege IAM or bucket policies.",
            evidence: { acl }
          })
        );
      }
    }

    if (change.type === "aws_s3_bucket_public_access_block") {
      const disabledFlags = getDisabledPublicAccessBlockFlags(resource);

      if (disabledFlags.length > 0) {
        findings.push(
          createFinding({
            checkId: "public-s3-access",
            severity: "HIGH",
            title: "S3 public access block is disabled",
            change,
            explanation: `${change.address} disables ${disabledFlags.join(", ")}.`,
            remediation:
              "Set all S3 public access block flags to true unless a documented exception is approved.",
            evidence: { disabledFlags }
          })
        );
      }
    }

    if (change.type === "aws_s3_bucket_policy") {
      const policy = getPolicyDocument(resource);

      if (policy !== undefined && policyHasPublicPrincipal(policy)) {
        findings.push(
          createFinding({
            checkId: "public-s3-access",
            severity: "HIGH",
            title: "S3 bucket policy allows public principal",
            change,
            explanation: `${change.address} contains a Principal "*" statement.`,
            remediation:
              "Restrict bucket policy principals to specific AWS accounts, roles, or services and add conditions where appropriate.",
            evidence: { principal: "*" }
          })
        );
      }
    }
  }

  return findings;
}

function checkWildcardIamPolicy(summary: TerraformChangeSummary) {
  const findings: PolicyFinding[] = [];

  for (const change of summary.changes) {
    if (!isIamPolicyResource(change.type)) {
      continue;
    }

    const policy = getPolicyDocument(preferredResourceState(change));

    if (policy === undefined) {
      continue;
    }

    const wildcardEvidence = getWildcardIamEvidence(policy);

    if (
      wildcardEvidence.wildcardActions.length === 0 &&
      wildcardEvidence.wildcardResources.length === 0
    ) {
      continue;
    }

    findings.push(
      createFinding({
        checkId: "wildcard-iam-policy",
        severity: "HIGH",
        title: "IAM policy contains wildcard permissions",
        change,
        explanation: `${change.address} uses wildcard IAM actions or resources.`,
        remediation:
          "Replace wildcard IAM permissions with the minimum required actions and resource ARNs.",
        evidence: wildcardEvidence
      })
    );
  }

  return findings;
}

function checkRequiredTags(summary: TerraformChangeSummary) {
  return summary.changes
    .filter((change) => change.action !== "delete" && change.action !== "no-op")
    .map((change) => ({
      change,
      missingTags: getMissingRequiredTags(change)
    }))
    .filter(({ missingTags }) => missingTags.length > 0)
    .map(({ change, missingTags }) =>
      createFinding({
        checkId: "required-tags",
        severity: "MEDIUM",
        title: "Resource is missing required tags",
        change,
        explanation: `${change.address} is missing required tags: ${missingTags.join(", ")}.`,
        remediation:
          "Add owner, service, and environment tags before applying the change.",
        evidence: {
          missingTags,
          tags: change.tags.all
        }
      })
    );
}

function createFinding({
  checkId,
  severity,
  title,
  change,
  explanation,
  remediation,
  evidence
}: {
  checkId: string;
  severity: Severity;
  title: string;
  change: NormalizedResourceChange;
  explanation: string;
  remediation: string;
  evidence?: Record<string, unknown>;
}): PolicyFinding {
  const metadata = {
    checkId,
    resourceType: change.type,
    action: change.action,
    explanation,
    remediation,
    evidence
  };

  return {
    id: `${checkId}:${slug(change.address)}:${slug(title)}`,
    policyId: checkId,
    checkId,
    severity,
    title,
    description: explanation,
    recommendation: severity === "CRITICAL" ? "BLOCK" : "REVIEW",
    resourceAddress: change.address,
    resourceType: change.type,
    action: change.action,
    explanation,
    remediation,
    evidence,
    metadata
  };
}

function compareFindingsBySeverity(left: PolicyFinding, right: PolicyFinding) {
  const severityDifference =
    severityRank[right.severity] - severityRank[left.severity];

  if (severityDifference !== 0) {
    return severityDifference;
  }

  return left.id.localeCompare(right.id);
}

function recommendationForFindings(findings: PolicyFinding[]): Recommendation {
  if (findings.some((finding) => finding.severity === "CRITICAL")) {
    return "BLOCK";
  }

  return findings.length > 0 ? "REVIEW" : "APPROVE";
}

function isDestructive(change: NormalizedResourceChange) {
  return change.action === "delete" || change.action === "replace";
}

function isProductionTagged(change: NormalizedResourceChange) {
  return (
    change.tags.environment === "prod" ||
    change.tags.environment === "production"
  );
}

function getMissingRequiredTags(change: NormalizedResourceChange) {
  return [
    change.tags.owner === undefined ? "owner" : undefined,
    change.tags.service === undefined ? "service" : undefined,
    change.tags.environment === undefined ? "environment" : undefined
  ].filter((tag): tag is string => tag !== undefined);
}

function getIngressRules(change: NormalizedResourceChange) {
  const resource = preferredResourceState(change);

  if (!isRecord(resource) || !Array.isArray(resource.ingress)) {
    return [];
  }

  return resource.ingress.filter(isRecord);
}

function getPublicSources(ingress: Record<string, unknown>) {
  return [
    ...getStringArray(ingress.cidr_blocks).filter((cidr) => cidr === "0.0.0.0/0"),
    ...getStringArray(ingress.ipv6_cidr_blocks).filter((cidr) => cidr === "::/0")
  ];
}

function getAdminExposure(ingress: Record<string, unknown>) {
  const protocol = getString(ingress.protocol).toLowerCase();

  if (protocol === "-1" || protocol === "all") {
    return ["all protocols"];
  }

  const fromPort = getNumber(ingress.from_port);
  const toPort = getNumber(ingress.to_port);

  return [22, 3389]
    .filter((port) => portIsInRange(port, fromPort, toPort))
    .map((port) => String(port));
}

function portIsInRange(
  port: number,
  fromPort: number | undefined,
  toPort: number | undefined
) {
  if (fromPort === undefined || toPort === undefined) {
    return false;
  }

  return fromPort <= port && port <= toPort;
}

function getDisabledPublicAccessBlockFlags(resource: unknown) {
  if (!isRecord(resource)) {
    return [];
  }

  return [
    "block_public_acls",
    "block_public_policy",
    "ignore_public_acls",
    "restrict_public_buckets"
  ].filter((flag) => resource[flag] === false);
}

function getPolicyDocument(resource: unknown) {
  if (!isRecord(resource) || resource.policy === undefined) {
    return undefined;
  }

  if (typeof resource.policy === "string") {
    try {
      const parsedPolicy = JSON.parse(resource.policy);
      return isRecord(parsedPolicy) ? parsedPolicy : undefined;
    } catch {
      return undefined;
    }
  }

  return isRecord(resource.policy) ? resource.policy : undefined;
}

function policyHasPublicPrincipal(policy: Record<string, unknown>) {
  return getPolicyStatements(policy).some((statement) =>
    valueIncludesWildcard(statement.Principal)
  );
}

function getWildcardIamEvidence(policy: Record<string, unknown>) {
  const wildcardActions = new Set<string>();
  const wildcardResources = new Set<string>();

  for (const statement of getPolicyStatements(policy)) {
    for (const action of getValueStrings(statement.Action)) {
      if (action.includes("*")) {
        wildcardActions.add(action);
      }
    }

    for (const resource of getValueStrings(statement.Resource)) {
      if (resource.includes("*")) {
        wildcardResources.add(resource);
      }
    }
  }

  return {
    wildcardActions: [...wildcardActions].sort(),
    wildcardResources: [...wildcardResources].sort()
  };
}

function getPolicyStatements(policy: Record<string, unknown>) {
  if (Array.isArray(policy.Statement)) {
    return policy.Statement.filter(isRecord);
  }

  return isRecord(policy.Statement) ? [policy.Statement] : [];
}

function valueIncludesWildcard(value: unknown): boolean {
  if (value === "*") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(valueIncludesWildcard);
  }

  if (isRecord(value)) {
    return Object.values(value).some(valueIncludesWildcard);
  }

  return false;
}

function getValueStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function isIamPolicyResource(resourceType: string) {
  return (
    resourceType === "aws_iam_policy" ||
    resourceType === "aws_iam_role_policy" ||
    resourceType === "aws_iam_user_policy" ||
    resourceType === "aws_iam_group_policy"
  );
}

function preferredResourceState(change: NormalizedResourceChange) {
  return change.after ?? change.before;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
