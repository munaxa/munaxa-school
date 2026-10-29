/**
 * Tests for the production deployment gate (scripts/deploy-gate.mjs). Run with
 * `node --test scripts/deploy-gate.test.mjs`; CI runs them in the security job.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { databaseProblems, environmentProblems, workflowProblems } from './deploy-gate.mjs';

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

const staging = {
  target: 'staging',
  url: 'postgresql://owner:secret@db.staging.example:5432/app',
  declaredEnvironment: 'staging',
  declaredHost: 'db.staging.example',
};

test('a database the environment declares, by name and host, may be changed', () => {
  assert.deepEqual(databaseProblems(staging), []);
  assert.deepEqual(databaseProblems({ ...staging, declaredHost: 'DB.Staging.Example' }), []);
});

test('no database configured is not this check to refuse', () => {
  assert.deepEqual(databaseProblems({ ...staging, url: '' }), []);
});

test('an undeclared database is refused', () => {
  const problems = databaseProblems({ ...staging, declaredEnvironment: '', declaredHost: '' });
  assert.equal(problems.length, 2);
  assert.match(problems.join(), /DATABASE_ENVIRONMENT/);
  assert.match(problems.join(), /DATABASE_HOST/);
});

test("a staging secret that points at another host — production's — is refused", () => {
  const problems = databaseProblems({ ...staging, url: 'postgresql://o:s@db.prod.example/app' });
  assert.match(problems.join(), /points at db\.prod\.example/);
});

test('a declaration for another environment is refused (a repository-level variable leaking)', () => {
  assert.match(
    databaseProblems({ ...staging, target: 'production' }).join(),
    /declared for "staging", but this job targets "production"/,
  );
});

test('the refusal never contains the URL or its password', () => {
  const problems = databaseProblems({
    ...staging,
    url: 'postgresql://o:hunter2@db.prod.example/a',
  });
  assert.doesNotMatch(problems.join(), /hunter2|postgresql:/);
  assert.deepEqual(databaseProblems({ ...staging, url: 'not a url' }), [
    'The database URL is not a URL.',
  ]);
});

/** A job that migrates, to mutate. */
const migrating = () => ({
  on: { workflow_dispatch: null },
  jobs: {
    'production-gate': {
      steps: [
        { run: 'node scripts/deploy-gate.mjs verify-environment "$T"', env: { T: 'staging' } },
      ],
    },
    migrate: {
      needs: 'production-gate',
      environment: 'staging',
      env: { DIRECT_DATABASE_URL: '${{ secrets.DIRECT_DATABASE_URL }}' },
      steps: [
        { uses: 'actions/checkout@v6' },
        { run: 'node scripts/deploy-gate.mjs verify-database "$T"', env: { T: 'staging' } },
        { run: 'pnpm prisma:deploy' },
      ],
    },
  },
});

test('a migrating job that checks its database first passes', () => {
  assert.deepEqual(workflowProblems('w.yml', migrating()), []);
});

test('a migrating job without the database check fails', () => {
  const w = migrating();
  w.jobs.migrate.steps.splice(1, 1);
  assert.match(workflowProblems('w.yml', w).join(), /never runs `verify-database`/);
});

test('a database step before the check fails', () => {
  const w = migrating();
  w.jobs.migrate.steps.splice(1, 0, { run: 'psql "$DIRECT_DATABASE_URL" -c "select 1"' });
  assert.match(workflowProblems('w.yml', w).join(), /before `verify-database`/);
});

test('a check for another environment, or a conditional one, fails', () => {
  const other = migrating();
  other.jobs.migrate.steps[1].env.T = 'production';
  assert.match(workflowProblems('w.yml', other).join(), /checks the database for `production`/);
  const conditional = migrating();
  conditional.jobs.migrate.steps[1].if = 'false';
  assert.match(workflowProblems('w.yml', conditional).join(), /unconditionally/);
});

test('installing private packages with GITHUB_TOKEN alone fails; the package token passes', () => {
  const job = (env) => ({
    on: { pull_request: null },
    jobs: { build: { steps: [{ run: 'pnpm install', env }] } },
  });
  assert.match(
    workflowProblems('w.yml', job({ NODE_AUTH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' })).join(),
    /GITHUB_TOKEN alone/,
  );
  assert.deepEqual(
    workflowProblems(
      'w.yml',
      job({ NODE_AUTH_TOKEN: '${{ secrets.PLATFORM_PACKAGES_TOKEN || secrets.GITHUB_TOKEN }}' }),
    ),
    [],
  );
  const image = {
    on: { pull_request: null },
    jobs: {
      img: {
        steps: [
          {
            uses: 'docker/build-push-action@v6',
            with: { secrets: 'github_token=${{ secrets.GITHUB_TOKEN }}' },
          },
        ],
      },
    },
  };
  assert.match(workflowProblems('w.yml', image).join(), /GITHUB_TOKEN alone/);
});
