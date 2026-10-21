import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const sourceDir = resolve("dist/src");

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(file);
    } else if (entry.isFile() && file.endsWith(".js")) {
      rewrite(file);
    }
  }
}

function rewrite(file) {
  const original = readFileSync(file, "utf8");
  const updated = original.replace(/\brequire\((['"])@\/([^'"]+)\1\)/g, (match, quote, modulePath) => {
    const target = resolve(sourceDir, modulePath);
    if (!target.startsWith(sourceDir + sep) ||
        (!existsSync(target + ".js") && !existsSync(join(target, "index.js")))) {
      throw new Error(`Alias sem destino compilado em ${file}: @/${modulePath}`);
    }
    const path = relative(dirname(file), target).split(sep).join("/");
    return `require(${quote}${path.startsWith(".") ? path : `./${path}`}${quote})`;
  });
  if (updated !== original) writeFileSync(file, updated);
}

visit(sourceDir);
