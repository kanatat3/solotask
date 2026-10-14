// Build = copy the site files (and nothing else: no tests, no node_modules) into dist/, which Netlify publishes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = path.join(root, "dist");
const SITE = /^(index\.html|request\.html|privacy\.html|terms\.html|sw\.js|manifest\.json|_headers|.+\.(png|svg|ico))$/i;
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
const files = fs.readdirSync(root).filter(f => SITE.test(f) && fs.statSync(path.join(root, f)).isFile());
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(dist, f));
// version.json: which commit / Node built the live site (Netlify sets COMMIT_REF) — check with curl <site>/version.json
fs.writeFileSync(path.join(dist, "version.json"), JSON.stringify({ commit: process.env.COMMIT_REF || "local", node: process.version, builtAt: new Date().toISOString() }) + "\n");
for (const must of ["index.html", "request.html", "sw.js", "manifest.json"]) if (!files.includes(must)) { console.error("BUILD: missing " + must); process.exit(1); }
console.log(`build ok: ${files.length} files -> dist/`);
