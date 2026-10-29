/**
 * Tests for the production deployment gate (scripts/deploy-gate.mjs). Run with
 * `node --test scripts/deploy-gate.test.mjs`; CI runs them in the security job.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { environmentProblems, workflowProblems } from './deploy-gate.mjs';

const protectedEnvironment = {
  name: 'production',
  can_admins_bypass: false,
  protection_rules: [
    { type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { login: 'owner' } }] },
  ],
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
};
const onlyMain = [{ name: 'main', type: 'branch' }];

test('a production environment with reviewers, no bypass and main only passes', () => {
  assert.deepEqual(environmentProblems(protectedEnvironment, onlyMain), []);
});

test('a missing production environment fails: a deploy would create it unprotected', () => {
  assert.match(environmentProblems(null, [])[0], /does not exist/);
});

test('an environment without required reviewers fails', () => {
  const env = {
    ...protectedEnvironment,
    protection_rules: [{ type: 'wait_timer', wait_timer: 5 }],
  };
  assert.match(environmentProblems(env, onlyMain).join(), /no required reviewers/);
});

test('an admin bypass fails, and so does an unknown bypass setting', () => {
  for (const can_admins_bypass of [true, undefined]) {
    const env = { ...protectedEnvironment, can_admins_bypass };
    assert.match(environmentProblems(env, onlyMain).join(), /bypass/);
  }
});

test('deployment branches must be restricted to main', () => {
  const open = { ...protectedEnvironment, deployment_branch_policy: null };
  assert.match(environmentProblems(open, []).join(), /Any branch/);
  assert.match(
    environmentProblems(protectedEnvironment, [
      ...onlyMain,
      { name: 'release/*', type: 'branch' },
    ]).join(),
    /exactly the branch `main`/,
  );
  assert.match(
    environmentProblems(protectedEnvironment, [{ name: 'main', type: 'tag' }]).join(),
    /exactly/,
  );
  assert.match(environmentProblems(protectedEnvironment, []).join(), /none/);
  const protectedBranches = {
    ...protectedEnvironment,
    deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
  };
  assert.deepEqual(environmentProblems(protectedBranches, []), []);
});

test("this repository's workflows hold the gate", () => {
  const dir = '.github/workflows';
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    assert.deepEqual(
      workflowProblems(file, parse(readFileSync(`${dir}/${file}`, 'utf8'))),
      [],
      file,
    );
  }
});

/** A minimal gated workflow, to mutate. */
const gated = () => ({
  on: { push: { branches: ['main'] }, workflow_dispatch: null },
  jobs: {
    'production-gate': {
      steps: [
        {
          run: 'node scripts/deploy-gate.mjs verify-environment "$TARGET"',
          env: { TARGET: 'production' },
        },
      ],
    },
    build: { needs: 'production-gate', steps: [] },
    deploy: {
      needs: ['build'],
      environment: 'production',
      steps: [{ run: 'deploy', env: { TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}' } }],
    },
  },
});

test('the minimal gated workflow passes, through a transitive need', () => {
  assert.deepEqual(workflowProblems('w.yml', gated()), []);
});

test('a job with an environment that does not need the gate fails', () => {
  const w = gated();
  w.jobs.build.needs = [];
  assert.match(workflowProblems('w.yml', w).join(), /does not need `production-gate`/);
});

test('a workflow with an environment but no gate job fails', () => {
  const w = gated();
  delete w.jobs['production-gate'];
  w.jobs.build.needs = [];
  assert.match(workflowProblems('w.yml', w).join(), /no `production-gate` job/);
});

test('a gate that checks a different target than the job deploys to fails', () => {
  const w = gated();
  w.jobs['production-gate'].steps[0].env.TARGET = 'staging';
  assert.match(workflowProblems('w.yml', w).join(), /gate checks `staging`/);
});

test('an environment given as an object is gated like a string', () => {
  const w = gated();
  w.jobs.deploy.environment = { name: 'production', url: 'https://example.test' };
  w.jobs.build.needs = [];
  assert.match(workflowProblems('w.yml', w).join(), /does not need/);
});

test('a condition that runs a deploy after the gate failed fails', () => {
  for (const condition of ['always()', '${{ !cancelled() }}', 'failure() || true']) {
    const w = gated();
    w.jobs.build.if = condition;
    assert.match(workflowProblems('w.yml', w).join(), /after the gate failed/, condition);
  }
});

test('a conditional, soft-failing or environment-holding gate fails', () => {
  const conditional = gated();
  conditional.jobs['production-gate'].if = "github.ref == 'refs/heads/x'";
  assert.match(workflowProblems('w.yml', conditional).join(), /unconditionally/);
  const soft = gated();
  soft.jobs['production-gate']['continue-on-error'] = true;
  assert.match(workflowProblems('w.yml', soft).join(), /continue on error/);
  const holding = gated();
  holding.jobs['production-gate'].environment = 'production';
  assert.match(workflowProblems('w.yml', holding).join(), /must not hold an environment/);
  const empty = gated();
  empty.jobs['production-gate'].steps = [{ run: 'echo ok' }];
  assert.match(workflowProblems('w.yml', empty).join(), /does not run/);
});

test('a deploy on pushes to any branch but main fails', () => {
  for (const push of [
    {},
    { branches: ['main', 'release'] },
    { branches: ['main'], tags: ['v*'] },
  ]) {
    const w = gated();
    w.on.push = push;
    assert.match(workflowProblems('w.yml', w).join(), /pushes to `main` only/);
  }
});

test('a deploy credential read outside an environment fails', () => {
  const w = gated();
  w.jobs.build.steps = [{ run: 'x', env: { T: '${{ secrets.CLOUDFLARE_API_TOKEN }}' } }];
  assert.match(workflowProblems('w.yml', w).join(), /reads CLOUDFLARE_API_TOKEN without/);
  const ci = {
    on: { pull_request: null },
    jobs: { t: { steps: [{ env: { A: '${{ secrets.GITHUB_TOKEN }}' } }] } },
  };
  assert.deepEqual(workflowProblems('ci.yml', ci), []);
});

test('privileged triggers and secrets: inherit fail', () => {
  assert.match(
    workflowProblems('w.yml', { on: { pull_request_target: null }, jobs: {} }).join(),
    /pull_request_target/,
  );
  assert.match(workflowProblems('w.yml', { on: 'workflow_run', jobs: {} }).join(), /workflow_run/);
  const inherit = {
    on: { push: { branches: ['main'] } },
    jobs: { call: { uses: './x.yml', secrets: 'inherit' } },
  };
  assert.match(workflowProblems('w.yml', inherit).join(), /secrets: inherit/);
});
