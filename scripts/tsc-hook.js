import { exec } from "node:child_process";

const argsStr = process.env.TOOL_ARGS || "{}";
let isTsFile = false;

try {
  const args = JSON.parse(argsStr);
  const path = args.path || args.file || "";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) {
    isTsFile = true;
  }
} catch (e) {
  // Parsing failed, ignore
}

if (!isTsFile) {
  process.exit(0); // Not a ts file, do nothing
}

// Run tsc --noEmit
exec("npx tsc --noEmit", (err, stdout, stderr) => {
  if (err) {
    console.log("TypeScript Compiler Error(s) detected:");
    console.log(stdout.trim() || stderr.trim());
    process.exit(0); // Don't block the agent, just report
  } else {
    console.log("TypeScript Compiler: All checks passed (OK)");
    process.exit(0);
  }
});
