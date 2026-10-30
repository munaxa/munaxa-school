#!/usr/bin/env node
/**
 * The deployment gate. Nothing in this repository publishes an image, migrates a database or
 * deploys on a merge: every workflow that can is started by hand, and every job with a side effect
 * holds a GitHub environment that requires a reviewer's approval. Commands:
 *
 *   node scripts/deploy-gate.mjs verify-dispatch <target>
 *     Run first by the `production-gate` job of a workflow whose target is chosen at dispatch. It
 *     fails unless the run was started by hand (`workflow_dispatch`) and the `confirm` input
 *     repeats the chosen target, so the target is always typed, never a preselected default.
 *
 *   node scripts/deploy-gate.mjs verify-environment <target>
 *     Run by the `production-gate` job of every deploying workflow, before any job that holds an
 *     environment. It reads the target environment's protection rules from the GitHub API and
 *     fails — so nothing downstream runs — unless a human approval is genuinely required: the
 *     environment exists, has required reviewers, admins cannot bypass them, and only the one ref
 *     the target deploys from may use it (`main`, or `image/*` tags for `image-release`). Every
 *     target is held to this, staging included; a target not listed in TARGETS is refused. It
 *     fails closed: an unreadable API is a failure. A job that names an environment which does
 *     not exist creates it, unprotected, on the spot; this check is what stops that from becoming
 *     a silent deploy.
 *
 *   node scripts/deploy-gate.mjs report-environment <target>
 *     Run in CI on every pull request: the same reading of the environment, reported as a warning
 *     rather than a failure (a pull request deploys nothing), so the state of the gate is visible
 *     before a merge. An unreadable API still fails, since the gate itself would then fail.
 *
 *   node scripts/deploy-gate.mjs verify-database <target>
 *     Run as the first step of every job that migrates or seeds a database. The database URL is a
 *     secret, so nothing in a workflow can see which database it names; a staging secret that is
 *     really production's would be migrated on every merge. So the environment must say, in two
 *     plain variables, which database it is for: `DATABASE_ENVIRONMENT` (the environment's own
 *     name) and `DATABASE_HOST` (the host the URL must point at). Missing, or not matching the URL,
 *     and the job stops before it connects. The URL itself is never printed.
 *
 *   node scripts/deploy-gate.mjs lint [workflowDir]
 *     Run in CI. Statically checks the workflows so a new job cannot route around the gate: a
 *     workflow with an environment runs only on `workflow_dispatch`; every job with an
 *     environment runs only on a dispatch, needs the gate (directly or through another job), with
 *     the same target, and no `always()`-style condition that would run it after the gate failed;
 *     a target chosen at dispatch is confirmed by `verify-dispatch`; a job that can publish
 *     (`packages: write`, `id-token: write`, a pushing image build, a Worker deploy) holds an
 *     environment; deploy credentials are only read by jobs that hold an environment; no Worker
 *     deploy names another repository's Worker; and no workflow uses the privileged
 *     `pull_request_target` / `workflow_run` triggers or `secrets: inherit`. It also checks every
 *     wrangler config in the repository for those Worker names.
 *
 * See docs/ops/deployment-gates.md for the GitHub settings this gate expects.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GATE_JOB = 'production-gate';
/**
 * Every environment a workflow here may use, the ref a run must be on to use it, and the single
 * deployment rule the environment must hold (GitHub's `<type>:<name>`).
 */
export const TARGETS = {
  production: { ref: (ref) => ref === 'refs/heads/main', refName: 'main', rule: 'branch:main' },
  staging: { ref: (ref) => ref === 'refs/heads/main', refName: 'main', rule: 'branch:main' },
  'image-release': {
    ref: (ref) => /^refs\/tags\/image\/[0-9a-f]{40}$/.test(ref ?? ''),
    refName: 'an image/<sha> tag',
    rule: 'tag:image/*',
  },
};
/**
 * Workers that other repositories deploy: munaxa.com from munaxa/munaxa, and an unrelated
 * product. Two repositories deploying to one Worker overwrite each other.
 */
export const FOREIGN_WORKERS = ['munaxa', 'canteenhub-prod'];
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
export function environmentProblems(environment, branchPolicies, target = 'production') {
  const spec = TARGETS[target];
  if (!spec) return [`"${target}" is not a deployment target this repository knows.`];
  if (!environment) {
    return [
      `The "${target}" environment does not exist. A deploy job would create it ` +
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
  const [ruleType, ruleName] = spec.rule.split(':');
  const wanted = `the ${ruleType} \`${ruleName}\``;
  if (!policy) {
    problems.push(`Any branch may deploy to it: restrict deployments to ${wanted}.`);
  } else if (policy.custom_branch_policies) {
    const names = (branchPolicies ?? []).map((p) => `${p.type ?? 'branch'}:${p.name}`);
    const onlyRule = names.length > 0 && names.every((n) => n === spec.rule);
    if (!onlyRule) {
      problems.push(
        `Its deployment branch rules are [${names.join(', ') || 'none'}]; they must name ` +
          `exactly ${wanted}.`,
      );
    }
  } else if (!policy.protected_branches || ruleType !== 'branch') {
    problems.push(`Its deployment branch policy allows more than ${wanted}.`);
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
  const spec = TARGETS[target];
  if (!spec) {
    console.log(`::error::"${target}" is not a deployment target this repository knows.`);
    return 1;
  }
  const ref = process.env.GITHUB_REF;
  if (!advisory && !spec.ref(ref)) {
    console.log(`::error::${target} runs only from ${spec.refName}; this run is on ${ref}.`);
    return 1;
  }
  const repository = process.env.GITHUB_REPOSITORY;
  const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const token = process.env.GITHUB_TOKEN;
  const base = `${api}/repos/${repository}/environments/${encodeURIComponent(target)}`;
  const environment = await getJson(base, token);
  const branchPolicies = environment?.deployment_branch_policy?.custom_branch_policies
    ? ((await getJson(`${base}/deployment-branch-policies`, token))?.branch_policies ?? [])
    : [];
  const problems = environmentProblems(environment, branchPolicies, target);
  if (problems.length > 0) {
    const level = advisory ? 'warning' : 'error';
    for (const problem of problems) console.log(`::${level} title=Gate · ${target}::${problem}`);
    console.log(
      `::${level} title=Gate · ${target}::` +
        (advisory
          ? `Runs targeting ${target} will fail at the gate until Settings → Environments → `
          : 'Nothing was published, migrated or deployed. Configure Settings → Environments → ') +
        `${target} as described in docs/ops/deployment-gates.md` +
        (advisory ? ' is configured.' : ', then re-run.'),
    );
    return advisory ? 0 : 1;
  }
  const names = environment.protection_rules
    .filter((rule) => rule.type === 'required_reviewers')
    .flatMap((rule) => rule.reviewers)
    .map((r) => r.reviewer?.login ?? r.reviewer?.slug ?? r.type);
  console.log(
    `The ${target} environment requires approval by ${names.join(', ')}; ` +
      'each job that holds it will wait for one.',
  );
  return 0;
}

/* ----------------------------------------------------------------------------------------------
 * verify-dispatch
 * -------------------------------------------------------------------------------------------- */

/**
 * Pure: the problems with letting a run that targets `target` go on, or [] when it was started by
 * hand and its `confirm` input repeats the target. A dispatch form preselects the first option of
 * a choice, so the choice alone does not show that anyone picked it.
 */
export function dispatchProblems({ event, target, confirm }) {
  const problems = [];
  if (event !== 'workflow_dispatch') {
    problems.push(`This workflow runs only when started by hand; this run came from "${event}".`);
  }
  if (!TARGETS[target]) {
    problems.push(`"${target}" is not a deployment target this repository knows.`);
  } else if ((confirm ?? '').trim() !== target) {
    problems.push(`Type the target environment, ${target}, into the "confirm" input.`);
  }
  return problems;
}

function verifyDispatch(target) {
  const problems = dispatchProblems({
    event: process.env.GITHUB_EVENT_NAME,
    target,
    confirm: process.env.CONFIRM,
  });
  for (const problem of problems) console.log(`::error title=Dispatch::${problem}`);
  if (problems.length > 0) {
    console.log('::error title=Dispatch::Nothing was published, migrated or deployed.');
    return Promise.resolve(1);
  }
  console.log(`Started by hand for ${target}, confirmed.`);
  return Promise.resolve(0);
}

/* ----------------------------------------------------------------------------------------------
 * verify-database
 * -------------------------------------------------------------------------------------------- */

/**
 * Pure: the problems with letting a job change the database `url` names, in environment `target`,
 * given what that environment declares. `[]` means it may proceed. An empty `url` is not a problem
 * here — the job's own steps decide whether "no database" means skip or fail.
 */
export function databaseProblems({ target, url, declaredEnvironment, declaredHost }) {
  if (!target) return ['No target environment was given.'];
  if (!url) return [];
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return ['The database URL is not a URL.'];
  }
  const problems = [];
  if (!declaredEnvironment) {
    problems.push(
      `The "${target}" environment does not declare DATABASE_ENVIRONMENT; set it to "${target}".`,
    );
  } else if (declaredEnvironment !== target) {
    problems.push(
      `The database is declared for "${declaredEnvironment}", but this job targets "${target}".`,
    );
  }
  if (!declaredHost) {
    problems.push(`The "${target}" environment does not declare DATABASE_HOST.`);
  } else if (declaredHost.toLowerCase() !== host) {
    problems.push(
      `The database URL points at ${host}, not at the declared DATABASE_HOST ${declaredHost}.`,
    );
  }
  return problems;
}

function verifyDatabase(target) {
  const problems = databaseProblems({
    target,
    url: process.env.DIRECT_DATABASE_URL ?? '',
    declaredEnvironment: process.env.DATABASE_ENVIRONMENT ?? '',
    declaredHost: process.env.DATABASE_HOST ?? '',
  });
  if (problems.length > 0) {
    for (const problem of problems) console.log(`::error title=Database target::${problem}`);
    console.log(
      `::error title=Database target::Nothing was changed. Set the variables on Settings → ` +
        `Environments → ${target} (docs/ops/deployment-gates.md), then re-run.`,
    );
    return Promise.resolve(1);
  }
  console.log(
    process.env.DIRECT_DATABASE_URL
      ? `The "${target}" database is ${process.env.DATABASE_HOST}, as the environment declares.`
      : `No database is configured for "${target}".`,
  );
  return Promise.resolve(0);
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

/** The target a gate command checks: the argument after `command` in one of the job's steps. */
function gateTarget(job, command = 'verify-environment') {
  for (const step of job.steps ?? []) {
    const run = String(step.run ?? '');
    const match = run.match(
      new RegExp(`deploy-gate\\.mjs\\s+${command}\\s+"?([^"\\n]+?)"?\\s*$`, 'm'),
    );
    if (match) {
      const value = match[1].trim();
      const fromEnv = value.match(/^\$\{?([A-Z_]+)\}?$/);
      return fromEnv ? (step.env?.[fromEnv[1]] ?? job.env?.[fromEnv[1]]) : value;
    }
  }
  return undefined;
}

/**
 * Can this job change something outside the run: push an image or package, take a cloud identity,
 * or deploy a Worker? Such a job must hold an environment, and so wait for an approval.
 */
export function publishes(job) {
  const permissions = job.permissions ?? {};
  if (permissions === 'write-all') return true;
  if (permissions.packages === 'write' || permissions['id-token'] === 'write') return true;
  return (job.steps ?? []).some((step) => {
    if (/docker\/build-push-action/.test(String(step.uses ?? ''))) {
      const push = step.with?.push;
      return push === true || String(push) === 'true' || /\$\{\{/.test(String(push ?? ''));
    }
    return /\bwrangler\s+(deploy|publish)\b|cf:deploy|docker\s+push\b/.test(String(step.run ?? ''));
  });
}

const dispatchOnly = (job) =>
  /github\.event_name\s*==\s*'workflow_dispatch'/.test(String(job.if ?? ''));

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

  for (const [id, job] of Object.entries(jobs)) {
    if (publishes(job) && environmentName(job) == null) {
      add(`job \`${id}\` can publish or deploy but holds no environment, so nobody approves it.`);
    }
  }

  if (gated.length > 0) {
    const others = triggers.filter((trigger) => trigger !== 'workflow_dispatch');
    if (others.length > 0 || !triggers.includes('workflow_dispatch')) {
      add(
        `has jobs with an environment, so it must run only on \`workflow_dispatch\`, ` +
          `not on ${others.join(', ') || 'nothing'}.`,
      );
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
    // A target taken from the dispatch form must be confirmed by whoever started the run.
    if (gate && target !== undefined && /inputs\./.test(String(target))) {
      const confirmed = gateTarget(gate, 'verify-dispatch');
      if (confirmed === undefined || normalise(confirmed) !== normalise(target)) {
        add(
          `the \`${GATE_JOB}\` job takes its target from an input but does not run ` +
            '`deploy-gate.mjs verify-dispatch` on that target.',
        );
      }
    }
    for (const [id, job] of gated) {
      if (!dispatchOnly(job)) {
        add(
          `job \`${id}\` holds an environment but has no \`if: github.event_name == 'workflow_dispatch'\`.`,
        );
      }
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
    if (!JSON.stringify(job).includes('secrets.DIRECT_DATABASE_URL')) continue;
    const steps = job.steps ?? [];
    const check = steps.findIndex((step) =>
      /deploy-gate\.mjs\s+verify-database/.test(String(step.run ?? '')),
    );
    const touches = steps.findIndex((step) =>
      /prisma|psql|db:seed|DATABASE_URL/.test(String(step.run ?? '')),
    );
    if (check < 0) {
      add(`job \`${id}\` reads DIRECT_DATABASE_URL but never runs \`verify-database\`.`);
    } else {
      if (touches >= 0 && touches < check) {
        add(`job \`${id}\` uses the database before \`verify-database\` checks it.`);
      }
      const value = String(steps[check].run).match(/verify-database\s+"?([^"\n]+?)"?\s*$/m)?.[1];
      const fromEnv = value?.match(/^\$\{?([A-Z_]+)\}?$/);
      const target = fromEnv ? (steps[check].env?.[fromEnv[1]] ?? job.env?.[fromEnv[1]]) : value;
      if (target === undefined || normalise(target) !== normalise(environmentName(job) ?? '')) {
        add(`job \`${id}\` checks the database for \`${target}\`, not its own environment.`);
      }
      if (steps[check]['continue-on-error'] || steps[check].if != null) {
        add(`job \`${id}\` must run \`verify-database\` unconditionally.`);
      }
    }
  }

  // The @munaxa/* packages are private: this repository's own GITHUB_TOKEN cannot read them, so an
  // install or image build that is given only that token fails the moment the cache misses.
  for (const [id, job] of Object.entries(jobs)) {
    const text = JSON.stringify(job);
    if (/(NODE_AUTH_TOKEN"?:"?|github_token=)\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/.test(text)) {
      add(
        `job \`${id}\` installs private packages with GITHUB_TOKEN alone; use ` +
          '`secrets.PLATFORM_PACKAGES_TOKEN || secrets.GITHUB_TOKEN`.',
      );
    }
  }

  const text = JSON.stringify(workflow);
  for (const worker of FOREIGN_WORKERS) {
    const named = [...text.matchAll(/"worker":"([^"]+)"/g)].some((m) => m[1] === worker);
    if (named || (worker !== 'munaxa' && text.includes(worker))) {
      add(`names the \`${worker}\` Worker, which another repository deploys.`);
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

/** Pure: the problems with one wrangler config, by the Worker name it deploys to. */
export function wranglerProblems(file, text) {
  const names = [
    ...text.matchAll(/^\s*"name"\s*:\s*"([^"]+)"/gm),
    ...text.matchAll(/^\s*name\s*=\s*"([^"]+)"/gm),
  ].map((m) => m[1]);
  return names
    .filter((name) => FOREIGN_WORKERS.includes(name))
    .map((name) => `${file}: deploys to the \`${name}\` Worker, which another repository deploys.`);
}

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'build']);

/** Every wrangler config under `root`, outside dependency and build output. */
export function wranglerConfigs(root = '.') {
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) found.push(...wranglerConfigs(path));
    } else if (/^wrangler\.(jsonc?|toml)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

async function lint(directory = '.github/workflows') {
  const { parse } = await import('yaml');
  const files = readdirSync(directory).filter((f) => /\.ya?ml$/.test(f));
  const configs = wranglerConfigs('.');
  const problems = [
    ...files.flatMap((file) =>
      workflowProblems(file, parse(readFileSync(join(directory, file), 'utf8'))),
    ),
    ...configs.flatMap((file) => wranglerProblems(file, readFileSync(file, 'utf8'))),
  ];
  for (const problem of problems) console.log(`::error title=Deploy gate lint::${problem}`);
  if (problems.length === 0) {
    console.log(
      `Deploy gates hold in ${files.length} workflow(s) and ${configs.length} wrangler config(s).`,
    );
  }
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, argument] = process.argv.slice(2);
  const run =
    command === 'verify-dispatch'
      ? verifyDispatch(argument)
      : command === 'verify-environment'
        ? verifyEnvironment(argument)
        : command === 'report-environment'
          ? verifyEnvironment(argument, { advisory: true })
          : command === 'verify-database'
            ? verifyDatabase(argument)
            : command === 'lint'
              ? lint(argument)
              : Promise.reject(
                  new Error(
                    'usage: deploy-gate.mjs verify-dispatch|verify-environment|report-environment|verify-database <target> | lint',
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
