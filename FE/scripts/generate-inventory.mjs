import fs from "node:fs";
import path from "node:path";
const feRoot = process.cwd();
const repoRoot = path.resolve(feRoot, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(feRoot, "package.json"), "utf8"));
const docsDir = path.join(repoRoot, "docs");
fs.mkdirSync(docsDir, { recursive: true });
let packages = "# Installed packages\n\nResolved versions from the current installation; pnpm-lock.yaml is authoritative.\n\n";
for (const section of ["dependencies", "devDependencies"]) {
 packages += `## ${section}\n\n| Package | Version |\n| --- | --- |\n`;
 for (const name of Object.keys(manifest[section]).sort()) {
  const installed = JSON.parse(fs.readFileSync(path.join(feRoot, "node_modules", name, "package.json"), "utf8"));
  packages += `| ${name} | ${installed.version} |\n`;
 }
 packages += "\n";
}
packages += "shadcn/ui is generated source under src/components/ui, not a runtime package. Its CLI was used via pnpm dlx. Prettier was used via pnpm dlx for formatting.\n";
fs.writeFileSync(path.join(docsDir, "packages.md"), packages);
const treePath = path.join(docsDir, "folder-tree.txt");
fs.writeFileSync(treePath, "");
const excluded = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report"]);
function tree(directory, prefix = "") {
 const entries = fs.readdirSync(directory, {withFileTypes: true}).filter(item => !excluded.has(item.name) && !item.name.endsWith(".tsbuildinfo") && (!item.name.startsWith(".env") || item.name === ".env.example")).sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
 return entries.flatMap((item, index) => {
  const last = index === entries.length - 1;
  return [prefix + (last ? "└── " : "├── ") + item.name, ...(item.isDirectory() ? tree(path.join(directory, item.name), prefix + (last ? "    " : "│   ")) : [])];
 });
}
const output = [path.basename(repoRoot) + "/", ...tree(repoRoot)].join("\n") + "\n";
fs.writeFileSync(treePath, output);
process.stdout.write(output);
