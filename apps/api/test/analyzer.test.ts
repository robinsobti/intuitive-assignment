import { describe, expect, it } from "vitest";
import {
  TerraformPlanError,
  parsePlanInput,
  summarizeResourceChanges
} from "../src/analyzer/terraformPlan.js";

const basePlan = {
  format_version: "1.2",
  terraform_version: "1.8.0",
  resource_changes: [
    resourceChange("aws_instance.create", "aws_instance", "create", [
      "create"
    ]),
    resourceChange("aws_s3_bucket.update", "aws_s3_bucket", "update", [
      "update"
    ]),
    resourceChange("aws_iam_role.delete", "aws_iam_role", "delete", [
      "delete"
    ]),
    resourceChange("aws_db_instance.replace", "aws_db_instance", "replace", [
      "delete",
      "create"
    ]),
    resourceChange("aws_vpc.noop", "aws_vpc", "noop", ["no-op"])
  ]
};

describe("Terraform plan analyzer", () => {
  it("parses object and JSON string plan inputs", () => {
    expect(parsePlanInput(basePlan)).toEqual({
      formatVersion: "1.2",
      terraformVersion: "1.8.0",
      resourceChanges: expect.any(Array)
    });
    expect(parsePlanInput(JSON.stringify(basePlan)).resourceChanges).toHaveLength(
      5
    );
  });

  it("summarizes create, update, delete, replace, and no-op actions", () => {
    const summary = summarizeResourceChanges(parsePlanInput(basePlan));

    expect(summary).toMatchObject({
      total: 5,
      create: 1,
      update: 1,
      delete: 1,
      replace: 1,
      noOp: 1,
      unknown: 0,
      byType: {
        aws_instance: 1,
        aws_s3_bucket: 1,
        aws_iam_role: 1,
        aws_db_instance: 1,
        aws_vpc: 1
      }
    });
    expect(summary.changes.map((change) => change.action)).toEqual([
      "create",
      "update",
      "delete",
      "replace",
      "no-op"
    ]);
  });

  it("normalizes replace action regardless of create/delete order", () => {
    const summary = summarizeResourceChanges(
      parsePlanInput({
        resource_changes: [
          resourceChange("aws_instance.first", "aws_instance", "first", [
            "delete",
            "create"
          ]),
          resourceChange("aws_instance.second", "aws_instance", "second", [
            "create",
            "delete"
          ])
        ]
      })
    );

    expect(summary.replace).toBe(2);
    expect(summary.changes.map((change) => change.action)).toEqual([
      "replace",
      "replace"
    ]);
  });

  it("normalizes unsupported action sequences to unknown", () => {
    const summary = summarizeResourceChanges(
      parsePlanInput({
        resource_changes: [
          resourceChange("aws_instance.unknown", "aws_instance", "unknown", [
            "read"
          ])
        ]
      })
    );

    expect(summary.unknown).toBe(1);
    expect(summary.changes[0]?.action).toBe("unknown");
  });

  it("extracts and normalizes owner, service, and environment tags", () => {
    const summary = summarizeResourceChanges(
      parsePlanInput({
        resource_changes: [
          resourceChange(
            "aws_instance.tagged",
            "aws_instance",
            "tagged",
            ["update"],
            {
              before: {
                tags_all: {
                  Owner: " Platform ",
                  Service: "Payments",
                  Environment: "Prod"
                }
              },
              after: {
                tags: {
                  owner: "Security",
                  env: "Staging"
                }
              }
            }
          )
        ]
      })
    );

    expect(summary.changes[0]?.tags).toEqual({
      all: {
        Owner: " Platform ",
        Service: "Payments",
        Environment: "Prod",
        owner: "Security",
        env: "Staging"
      },
      owner: "security",
      service: "payments",
      environment: "staging"
    });
  });

  it("throws INVALID_JSON for malformed JSON strings", () => {
    expectPlanError(() => parsePlanInput("{not json"), "INVALID_JSON");
  });

  it("throws INVALID_TERRAFORM_PLAN when resource_changes is missing", () => {
    expectPlanError(
      () => parsePlanInput({ format_version: "1.2" }),
      "INVALID_TERRAFORM_PLAN"
    );
  });

  it("throws INVALID_TERRAFORM_PLAN when resource_changes is not an array", () => {
    expectPlanError(
      () => parsePlanInput({ resource_changes: {} }),
      "INVALID_TERRAFORM_PLAN"
    );
  });
});

function expectPlanError(
  run: () => unknown,
  code: TerraformPlanError["code"]
) {
  expect.assertions(2);

  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(TerraformPlanError);
    expect((error as TerraformPlanError).code).toBe(code);
    return;
  }

  throw new Error("Expected TerraformPlanError to be thrown.");
}

function resourceChange(
  address: string,
  type: string,
  name: string,
  actions: string[],
  change: {
    before?: unknown;
    after?: unknown;
  } = {}
) {
  return {
    address,
    type,
    name,
    provider_name: `registry.terraform.io/hashicorp/${type.split("_")[1]}`,
    change: {
      actions,
      before: change.before ?? null,
      after: change.after ?? null
    }
  };
}
