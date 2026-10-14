// Lint for the single-file pages: every inline <script> must parse, pages declare lang/title/viewport,
// the publishable Supabase key is the only key in the page, and the service worker parses.
import fs from "node:fs";
import vm from "node:vm";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const problems = [];
for (const page of ["index.html", "request.html", "privacy.html", "terms.html"]) {
  const html = read(page);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/ld\+json|importmap)")[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach((code, i) => {
    try { new vm.Script(code, { filename: `${page}#script${i + 1}` }); }
    catch (e) { problems.push(`${page}: script ${i + 1} does not parse: ${e.message}`); }
  });
  for (const [name, re] of Object.entries({ "html lang": /<html[^>]*\slang="/, "title": /<title>[^<]+<\/title>/, "viewport meta": /<meta name="viewport"/ }))
    if (!re.test(html)) problems.push(`${page}: missing ${name}`);
  // only the publishable (browser-safe) key may appear; a service-role key or JWT secret must never ship
  if (/service_role|sb_secret_|SUPABASE_SERVICE/i.test(html)) problems.push(`${page}: contains a server-side Supabase key`);
}
try { new vm.Script(read("sw.js"), { filename: "sw.js" }); } catch (e) { problems.push(`sw.js does not parse: ${e.message}`); }
try { JSON.parse(read("manifest.json")); } catch (e) { problems.push(`manifest.json is not valid JSON: ${e.message}`); }
if (problems.length) { problems.forEach(p => console.error("LINT:", p)); process.exit(1); }
console.log("lint ok (index, request, privacy, terms, sw.js, manifest.json)");
