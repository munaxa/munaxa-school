// Cloudflare Workers Builds runs the projects' deploy command (`npx wrangler versions
// upload`) from the repository ROOT (the project "Root directory" is `/`), but each app's
// `wrangler.jsonc` and its OpenNext build output live in the app's own folder. With no
// config at the root, wrangler fails with "Missing entry-point to Worker script or to
// assets directory".
//
// This script — run at the end of each app's `cf:build`, so `cwd` is the app folder —
// writes a repository-root `wrangler.jsonc` that is the app's own config with the `main` and
// `assets.directory` paths rewritten to include the app's path relative to that root (e.g.
// `school/munaxademo/.open-next/worker.js`). The root deploy then resolves the worker + assets
// correctly. Each Cloudflare project builds in its own isolated container, so the emitted root
// config never collides between apps.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const appDir = process.cwd();

/** The repository root is the directory that owns the pnpm workspace. */
function findWorkspaceRoot(from) {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`cf-emit-root-wrangler: no pnpm-workspace.yaml found above ${from}`);
    }
    dir = parent;
  }
}

const rootDir = findWorkspaceRoot(appDir);
// POSIX separators: the value is written into a JSON config consumed by wrangler.
const appPath = relative(rootDir, appDir).split(sep).join('/');

const src = readFileSync(join(appDir, 'wrangler.jsonc'), 'utf8');

const rewritten = src
  .replace(/("main":\s*")\.open-next\/worker\.js"/, `$1${appPath}/.open-next/worker.js"`)
  .replace(/("directory":\s*")\.open-next\/assets"/, `$1${appPath}/.open-next/assets"`);

if (rewritten === src) {
  throw new Error(
    `cf-emit-root-wrangler: expected main/assets paths not found in ${appPath}/wrangler.jsonc`,
  );
}

writeFileSync(join(rootDir, 'wrangler.jsonc'), rewritten);
// eslint-disable-next-line no-console
console.log(`cf-emit-root-wrangler: wrote root wrangler.jsonc for ${appPath}`);
