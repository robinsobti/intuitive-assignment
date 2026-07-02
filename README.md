# Infra Change Reviewer

Local platform-engineering tool for reviewing Terraform plan JSON and producing risk findings.

## Workspace

- `apps/web`: Next.js App Router UI
- `apps/api`: Fastify API
- `packages/shared`: shared TypeScript code

## Development

```sh
pnpm install
pnpm dev
```

## Samples

- `samples/risky-plan.json`: compact Terraform plan JSON that produces destructive, public exposure, wildcard IAM, and missing-tag findings.
- `samples/invalid-plan.json`: invalid plan shape for failure-path testing.
