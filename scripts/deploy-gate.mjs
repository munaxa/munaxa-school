#!/usr/bin/env node
/**
 * The production deployment gate. Two commands:
 *
 *   node scripts/deploy-gate.mjs verify-environment <target>
 *     Run by the `production-gate` job of every deploying workflow, before any job that holds an
 *     environment. For `production` it reads the environment's protection rules from the GitHub
 *     API and fails — so nothing downstream runs — unless a human approval is genuinely required:
 *     the environment exists, has required reviewers, admins cannot bypass them, and only `main`
 *     may deploy. Every other target passes. It fails closed: an unreadable API is a failure.
 *     A job that names an environment which does not exist creates it, unprotected, on the spot;
 *     this check is what stops that from becoming a silent production deploy.
 *
 *   node scripts/deploy-gate.mjs report-environment production
 *     Run in CI on every pull request: the same reading of the environment, reported as a warning
 *     rather than a failure (a pull request deploys nothing), so the state of the gate is visible
 *     before a merge. An unreadable API still fails, since the gate itself would then fail.
 *
 *   node scripts/deploy-gate.mjs lint [workflowDir]
 *     Run in CI. Statically checks the workflows so a new job cannot route around the gate: every
 *     job with an environment needs the gate (directly or through another job), with the same
 *     target, and no `always()`-style condition that would run it after the gate failed; deploy
 *     credentials are only read by jobs that hold an environment; and no workflow uses the
 *     privileged `pull_request_target` / `workflow_run` triggers or `secrets: inherit`.
 *
 * See docs/ops/deployment-gates.md for the GitHub settings this gate expects.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GATE_JOB = 'production-gate';
const PROTECTED_TARGET = 'production';
const DEPLOY_BRANCH = 'main';
/** Secrets every job may read: the run's own token and the read-only package token. */
const UNSCOPED_SECRETS = new Set(['GITHUB_TOKEN', 'PLATFORM_PACKAGES_TOKEN']);
const FORBIDDEN_TRIGGERS = ['pull_request_target', 'workflow_run'];

/* ----------------------------------------------------------------------------------------------
 * verify-environment
 * -------------------------------------------------------------------------------------------- */

/**
 * Pure: the problems with an environment as the API returned it, or [] when it requires a human
 * approval that cannot be skipped. `environment` is `null` when it does not exist (404).
 */
export function environmentProblems(environment, branchPolicies) {
  if (!environment) {
    return [
      `The "${PROTECTED_TARGET}" environment does not exist. A deploy job would create it ` +
        'without any protection rule.',
    ];
  }
  const problems = [];
  const reviewers = (environment.protection_rules ?? [])
    .filter((rule) => rule.type === 'required_reviewers')
    .flatMap((rule) => rule.reviewers ?? []);
  if (reviewers.length === 0) {
    problems.push('It has no required reviewers, so a deployment would start without approval.');
  }
  if (environment.can_admins_bypass !== false) {
    problems.push(
      'Administrators may bypass its protection rules ("Allow administrators to bypass ' +
        'configured protection rules" must be off).',
    );
  }
  const policy = environment.deployment_branch_policy;
  if (!policy) {
    problems.push('Any branch may deploy to it: restrict deployment branches to `main`.');
  } else if (policy.custom_branch_policies) {
    const names = (branchPolicies ?? []).map((p) => `${p.type ?? 'branch'}:${p.name}`);
    const onlyMain = names.length > 0 && names.every((n) => n === `branch:${DEPLOY_BRANCH}`);
    if (!onlyMain) {
      problems.push(
        `Its deployment branch rules are [${names.join(', ') || 'none'}]; they must name ` +
          `exactly the branch \`${DEPLOY_BRANCH}\`.`,
      );
    }
  } else if (!policy.protected_branches) {
    problems.push('Its deployment branch policy allows every branch.');
  }
  return problems;
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GET ${url} answered ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function verifyEnvironment(target, { advisory = false } = {}) {
  if (!target) throw new Error('verify-environment needs a target environment name.');
  if (target !== PROTECTED_TARGET) {
    console.log(`Target "${target}" is not ${PROTECTED_TARGET}: no approval gate required.`);
    return 0;
  }
  const ref = process.env.GITHUB_REF;
  if (!advisory && ref !== `refs/heads/${DEPLOY_BRANCH}`) {
    console.log(
      `::error::Production deploys run only from ${DEPLOY_BRANCH}; this run is on ${ref}.`,
    );
    return 1;
  }
  const repository = process.env.GITHUB_REPOSITORY;
  const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const token = process.env.GITHUB_TOKEN;
  const base = `${api}/repos/${repository}/environments/${PROTECTED_TARGET}`;
  const environment = await getJson(base, token);
  const branchPolicies = environment?.deployment_branch_policy?.custom_branch_policies
    ? ((await getJson(`${base}/deployment-branch-policies`, token))?.branch_policies ?? [])
    : [];
  const problems = environmentProblems(environment, branchPolicies);
  if (problems.length > 0) {
    const level = advisory ? 'warning' : 'error';
    for (const problem of problems) console.log(`::${level} title=Production gate::${problem}`);
    console.log(
      `::${level} title=Production gate::` +
        (advisory ? 'Production deploys will fail at the gate until ' : 'Nothing was deployed. ') +
        `Configure Settings → Environments → ${PROTECTED_TARGET} as described in ` +
        'docs/ops/deployment-gates.md' +
        (advisory ? '.' : ', then re-run.'),
    );
    return advisory ? 0 : 1;
  }
  const names = environment.protection_rules
    .filter((rule) => rule.type === 'required_reviewers')
    .flatMap((rule) => rule.reviewers)
    .map((r) => r.reviewer?.login ?? r.reviewer?.slug ?? r.type);
  console.log(
    `The ${PROTECTED_TARGET} environment requires approval by ${names.join(', ')}; ` +
      'the deploy job will wait for it.',
  );
  return 0;
}

/* ----------------------------------------------------------------------------------------------
 * lint
 * -------------------------------------------------------------------------------------------- */

const environmentName = (job) =>
  typeof job.environment === 'string' ? job.environment : job.environment?.name;
const needsOf = (job) => (job.needs == null ? [] : [job.needs].flat());
const normalise = (expression) => String(expression).replace(/\s+/g, '');

/** Every job `id` depends on, directly or not. */
function ancestors(jobs, id, seen = new Set()) {
  for (const parent of needsOf(jobs[id] ?? {})) {
    if (!seen.has(parent)) {
      seen.add(parent);
      ancestors(jobs, parent, seen);
    }
  }
  return seen;
}

/** The target the gate job checks: the argument after `verify-environment` in one of its steps. */
function gateTarget(job) {
  for (const step of job.steps ?? []) {
    const run = String(step.run ?? '');
    const match = run.match(/deploy-gate\.mjs\s+verify-environment\s+"?([^"\n]+?)"?\s*$/m);
    if (match) {
      const value = match[1].trim();
      const fromEnv = value.match(/^\$\{?([A-Z_]+)\}?$/);
      return fromEnv ? (step.env?.[fromEnv[1]] ?? job.env?.[fromEnv[1]]) : value;
    }
  }
  return undefined;
}

/** Pure: the problems in one parsed workflow. */
export function workflowProblems(file, workflow) {
  const problems = [];
  const add = (message) => problems.push(`${file}: ${message}`);
  const on = workflow.on ?? workflow[true] ?? {};
  const triggers = typeof on === 'string' ? [on] : Array.isArray(on) ? on : Object.keys(on);
  for (const trigger of FORBIDDEN_TRIGGERS) {
    if (triggers.includes(trigger)) add(`uses the privileged \`${trigger}\` trigger.`);
  }
  const jobs = workflow.jobs ?? {};
  const gated = Object.entries(jobs).filter(([, job]) => environmentName(job) != null);

  if (gated.length > 0) {
    const push = typeof on === 'object' && !Array.isArray(on) ? on.push : undefined;
    if (triggers.includes('push')) {
      const branches = push?.branches ?? [];
      if (push?.tags || branches.length !== 1 || branches[0] !== DEPLOY_BRANCH) {
        add(`deploys on push, so it must run on pushes to \`${DEPLOY_BRANCH}\` only.`);
      }
    }
    const gate = jobs[GATE_JOB];
    if (!gate) add(`has jobs with an environment but no \`${GATE_JOB}\` job.`);
    else {
      if (environmentName(gate) != null)
        add(`the \`${GATE_JOB}\` job must not hold an environment.`);
      if (gate.if != null) add(`the \`${GATE_JOB}\` job must run unconditionally.`);
      if (gate['continue-on-error']) add(`the \`${GATE_JOB}\` job must not continue on error.`);
    }
    const target = gate ? gateTarget(gate) : undefined;
    if (gate && target === undefined) {
      add(`the \`${GATE_JOB}\` job does not run \`deploy-gate.mjs verify-environment\`.`);
    }
    for (const [id, job] of gated) {
      if (!ancestors(jobs, id).has(GATE_JOB)) {
        add(`job \`${id}\` holds an environment but does not need \`${GATE_JOB}\`.`);
      }
      if (target !== undefined && normalise(target) !== normalise(environmentName(job))) {
        add(
          `job \`${id}\` deploys to \`${environmentName(job)}\` but the gate checks \`${target}\`.`,
        );
      }
      const chain = [id, ...ancestors(jobs, id)].filter((j) => j !== GATE_JOB);
      for (const link of chain) {
        if (/\b(always|failure|cancelled)\s*\(/.test(String(jobs[link]?.if ?? ''))) {
          add(`job \`${link}\` has an \`if:\` that could run it after the gate failed.`);
        }
      }
    }
  }

  for (const [id, job] of Object.entries(jobs)) {
    if (job.secrets === 'inherit') add(`job \`${id}\` passes \`secrets: inherit\`.`);
    const used = [...JSON.stringify(job).matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    const scoped = [...new Set(used)].filter((name) => !UNSCOPED_SECRETS.has(name));
    if (scoped.length > 0 && environmentName(job) == null) {
      add(`job \`${id}\` reads ${scoped.join(', ')} without holding an environment.`);
    }
  }
  return problems;
}

async function lint(directory = '.github/workflows') {
  const { parse } = await import('yaml');
  const files = readdirSync(directory).filter((f) => /\.ya?ml$/.test(f));
  const problems = files.flatMap((file) =>
    workflowProblems(file, parse(readFileSync(join(directory, file), 'utf8'))),
  );
  for (const problem of problems) console.log(`::error title=Deploy gate lint::${problem}`);
  if (problems.length === 0) console.log(`Deploy gates hold in ${files.length} workflow(s).`);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, argument] = process.argv.slice(2);
  const run =
    command === 'verify-environment'
      ? verifyEnvironment(argument)
      : command === 'report-environment'
        ? verifyEnvironment(argument, { advisory: true })
        : command === 'lint'
          ? lint(argument)
          : Promise.reject(
              new Error(
                'usage: deploy-gate.mjs verify-environment|report-environment <target> | lint',
              ),
            );
  run.then(
    (code) => process.exit(code),
    (error) => {
      console.log(`::error title=Deploy gate::${error.message}`);
      process.exit(1);
    },
  );
}
