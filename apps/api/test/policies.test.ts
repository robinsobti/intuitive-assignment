import { describe, expect, it } from "vitest";
import {
  collectPolicyFindings,
  runPolicyChecks
} from "../src/analyzer/policies.js";
import {
  parsePlanInput,
  summarizeResourceChanges
} from "../src/analyzer/terraformPlan.js";

describe("platform policy checks", () => {
  it("returns findings for representative risky Terraform plans", () => {
    const summary = summarizeResourceChanges(parsePlanInput(riskyPlan));
    const policyResults = runPolicyChecks(summary);
    const findings = collectPolicyFindings(policyResults);

    expect(findings.length).toBeGreaterThanOrEqual(4);
    expect(new Set(policyResults.map((result) => result.checkId))).toEqual(
      new Set([
        "destructive-change",
        "production-destructive-change",
        "public-admin-ingress",
        "public-s3-access",
        "wildcard-iam-policy",
        "required-tags"
      ])
    );
    expect(
      findings.map((finding) => ({
        checkId: finding.checkId,
        severity: finding.severity,
        resourceAddress: finding.resourceAddress,
        resourceType: finding.resourceType,
        action: finding.action,
        title: finding.title,
        explanation: finding.explanation,
        remediation: finding.remediation,
        evidence: finding.evidence
      }))
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "production-destructive-change",
          severity: "CRITICAL",
          resourceAddress: "aws_instance.prod",
          action: "delete"
        }),
        expect.objectContaining({
          checkId: "destructive-change",
          severity: "HIGH",
          resourceAddress: "aws_instance.prod",
          action: "delete"
        }),
        expect.objectContaining({
          checkId: "public-admin-ingress",
          resourceAddress: "aws_security_group.admin"
        }),
        expect.objectContaining({
          checkId: "public-s3-access",
          resourceAddress: "aws_s3_bucket_acl.public"
        }),
        expect.objectContaining({
          checkId: "public-s3-access",
          resourceAddress: "aws_s3_bucket_public_access_block.weak"
        }),
        expect.objectContaining({
          checkId: "public-s3-access",
          resourceAddress: "aws_s3_bucket_policy.public"
        }),
        expect.objectContaining({
          checkId: "wildcard-iam-policy",
          resourceAddress: "aws_iam_policy.wildcard"
        }),
        expect.objectContaining({
          checkId: "required-tags",
          resourceAddress: "aws_instance.untagged"
        })
      ])
    );
    expect(findings.map((finding) => finding.severity).slice(0, 2)).toEqual([
      "CRITICAL",
      "CRITICAL"
    ]);
  });

  it("skips unknown structures safely", () => {
    const summary = summarizeResourceChanges(
      parsePlanInput({
        resource_changes: [
          resourceChange("aws_security_group.empty", "aws_security_group", [
            "create"
          ]),
          {
            address: "aws_s3_bucket_policy.invalid",
            type: "aws_s3_bucket_policy",
            name: "invalid",
            change: {
              actions: ["create"],
              after: {
                policy: "{not json"
              }
            }
          }
        ]
      })
    );

    expect(() => runPolicyChecks(summary)).not.toThrow();
  });
});

const riskyPlan = {
  resource_changes: [
    resourceChange("aws_instance.prod", "aws_instance", ["delete"], {
      before: taggedResource({
        owner: "platform",
        service: "payments",
        environment: "prod"
      })
    }),
    resourceChange("aws_security_group.admin", "aws_security_group", ["create"], {
      after: taggedResource(
        {
          owner: "security",
          service: "network",
          environment: "prod"
        },
        {
          ingress: [
            {
              protocol: "tcp",
              from_port: 22,
              to_port: 22,
              cidr_blocks: ["0.0.0.0/0"]
            },
            {
              protocol: "-1",
              from_port: 0,
              to_port: 0,
              ipv6_cidr_blocks: ["::/0"]
            }
          ]
        }
      )
    }),
    resourceChange("aws_s3_bucket_acl.public", "aws_s3_bucket_acl", ["create"], {
      after: {
        acl: "public-read",
        tags: {
          owner: "platform",
          service: "assets",
          environment: "dev"
        }
      }
    }),
    resourceChange(
      "aws_s3_bucket_public_access_block.weak",
      "aws_s3_bucket_public_access_block",
      ["update"],
      {
        after: {
          block_public_acls: false,
          block_public_policy: true,
          ignore_public_acls: false,
          restrict_public_buckets: true,
          tags: {
            owner: "platform",
            service: "assets",
            environment: "dev"
          }
        }
      }
    ),
    resourceChange(
      "aws_s3_bucket_policy.public",
      "aws_s3_bucket_policy",
      ["create"],
      {
        after: {
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: "*",
                Action: "s3:GetObject",
                Resource: "arn:aws:s3:::public/*"
              }
            ]
          }),
          tags: {
            owner: "platform",
            service: "assets",
            environment: "dev"
          }
        }
      }
    ),
    resourceChange("aws_iam_policy.wildcard", "aws_iam_policy", ["create"], {
      after: {
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["iam:*"],
              Resource: "*"
            }
          ]
        }),
        tags: {
          owner: "security",
          service: "iam",
          environment: "dev"
        }
      }
    }),
    resourceChange("aws_instance.untagged", "aws_instance", ["create"], {
      after: {}
    })
  ]
};

function resourceChange(
  address: string,
  type: string,
  actions: string[],
  change: {
    before?: unknown;
    after?: unknown;
  } = {}
) {
  return {
    address,
    type,
    name: address.split(".").at(-1) ?? "resource",
    provider_name: "registry.terraform.io/hashicorp/aws",
    change: {
      actions,
      before: change.before ?? null,
      after: change.after ?? null
    }
  };
}

function taggedResource(
  tags: Record<string, string>,
  extra: Record<string, unknown> = {}
) {
  return {
    ...extra,
    tags
  };
}
