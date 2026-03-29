/**
 * Direct tool tests — no LLM needed.
 * Run: npx tsx src/test/tools.test.ts
 */
import { ToolRegistry } from "../tools/registry.js";

const c = { reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", dim: "\x1b[2m", cyan: "\x1b[36m" };

let passed = 0;
let failed = 0;
const registry = new ToolRegistry();

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ${c.green}✓${c.reset} ${msg}`);
    passed++;
  } else {
    console.log(`  ${c.red}✗${c.reset} ${msg}`);
    failed++;
  }
}

// ─── read_file ─────────────────────────────────────────
async function testReadFile() {
  console.log(`\n${c.bold}read_file${c.reset}`);

  // Full file
  const r1 = await registry.execute("read_file", { path: "src/tools/types.ts" });
  assert(!r1.isError, "reads file without error");
  assert(r1.content.includes("ToolDefinition"), "contains ToolDefinition interface");
  assert(r1.content.includes("line"), "has line numbers");

  // Range
  const r2 = await registry.execute("read_file", { path: "src/tools/types.ts", start_line: 1, end_line: 5 });
  assert(!r2.isError, "reads line range");
  assert(r2.content.includes("lines 1-5"), "shows line range header");

  // Non-existent file
  const r3 = await registry.execute("read_file", { path: "nonexistent.ts" });
  assert(r3.isError === true, "returns error for missing file");
}

// ─── list_files ────────────────────────────────────────
async function testListFiles() {
  console.log(`\n${c.bold}list_files${c.reset}`);

  const r1 = await registry.execute("list_files", { pattern: "src/**/*.ts" });
  assert(!r1.isError, "lists .ts files");
  assert(r1.content.includes("Found"), "has count header");
  assert(r1.content.includes("loop.ts"), "finds loop.ts");

  // No matches
  const r2 = await registry.execute("list_files", { pattern: "src/**/*.xyz" });
  assert(!r2.isError, "no error on empty results");
  assert(r2.content.includes("No files found"), "reports no matches");

  // Specific pattern
  const r3 = await registry.execute("list_files", { pattern: "package.json" });
  assert(r3.content.includes("package.json"), "finds package.json");
}

// ─── grep ──────────────────────────────────────────────
async function testGrep() {
  console.log(`\n${c.bold}grep${c.reset}`);

  const r1 = await registry.execute("grep", { pattern: "ToolDefinition", path: "src" });
  assert(!r1.isError, "grep without error");
  assert(r1.content.includes("types.ts") || r1.content.includes("registry.ts"), "finds matches");

  // With glob filter
  const r2 = await registry.execute("grep", { pattern: "export", path: "src", glob: "*.ts", max_results: 5 });
  assert(!r2.isError, "grep with glob filter");

  // No matches
  const r3 = await registry.execute("grep", { pattern: "xyznonexistent12345", path: "src" });
  assert(!r3.isError, "no error on no matches");
  assert(r3.content.includes("No matches"), "reports no matches");

  // Case insensitive
  const r4 = await registry.execute("grep", { pattern: "TOOLDEFINITION", path: "src", case_insensitive: true });
  assert(r4.content.includes("types.ts"), "case insensitive search works");
}

// ─── write_file + edit_file ────────────────────────────
async function testWriteAndEdit() {
  console.log(`\n${c.bold}write_file + edit_file${c.reset}`);

  // Write
  const r1 = await registry.execute("write_file", { path: "test-temp.txt", content: "Hello World\nLine 2\nLine 3" });
  assert(!r1.isError, "writes file");
  assert(r1.content.includes("1 lines") || r1.content.includes("3 lines"), "reports line count");

  // Read back
  const r2 = await registry.execute("read_file", { path: "test-temp.txt" });
  assert(r2.content.includes("Hello World"), "file content correct");

  // Edit (exact match)
  const r3 = await registry.execute("edit_file", { path: "test-temp.txt", old_text: "Hello World", new_text: "Goodbye World" });
  assert(!r3.isError, "edits file with exact match");
  assert(r3.content.includes("Successfully"), "reports success");

  // Verify edit
  const r4 = await registry.execute("read_file", { path: "test-temp.txt" });
  assert(r4.content.includes("Goodbye World"), "edit applied correctly");
  assert(!r4.content.includes("Hello World"), "old text removed");

  // Edit with no match
  const r5 = await registry.execute("edit_file", { path: "test-temp.txt", old_text: "notfound", new_text: "something" });
  assert(r5.isError === true, "returns error for no match");

  // Cleanup
  const { unlink } = await import("node:fs/promises");
  await unlink("test-temp.txt");
}

// ─── run_command ───────────────────────────────────────
async function testRunCommand() {
  console.log(`\n${c.bold}run_command${c.reset}`);

  const r1 = await registry.execute("run_command", { command: "echo hello world" });
  assert(!r1.isError, "runs simple command");
  assert(r1.content.includes("hello world"), "captures stdout");

  // Dangerous command blocked
  const r2 = await registry.execute("run_command", { command: "rm -rf /tmp/test" });
  assert(r2.isError === true, "blocks dangerous rm -rf");
  assert(r2.content.includes("DANGEROUS") || r2.content.includes("BLOCKED") || r2.content.includes("blocked"), "mentions danger");

  const r3 = await registry.execute("run_command", { command: "sudo apt-get install" });
  assert(r3.isError === true, "blocks sudo");

  // Failing command
  const r4 = await registry.execute("run_command", { command: "exit 1" });
  assert(r4.isError === true, "reports failure");
}

// ─── git_command ───────────────────────────────────────
async function testGitCommand() {
  console.log(`\n${c.bold}git_command${c.reset}`);

  const r1 = await registry.execute("git_command", { command: "status" });
  assert(!r1.isError, "git status works");

  const r2 = await registry.execute("git_command", { command: "log --oneline -3" });
  assert(!r2.isError, "git log works");

  // Dangerous git blocked
  const r3 = await registry.execute("git_command", { command: "push --force origin main" });
  assert(r3.isError === true, "blocks force push");

  const r4 = await registry.execute("git_command", { command: "reset --hard HEAD~1" });
  assert(r4.isError === true, "blocks hard reset");
}

// ─── get_project_info ──────────────────────────────────
async function testGetProjectInfo() {
  console.log(`\n${c.bold}get_project_info${c.reset}`);

  const r1 = await registry.execute("get_project_info", {});
  assert(!r1.isError, "gets project info");
  assert(r1.content.includes("jim"), "finds project name");
  assert(r1.content.includes("Scripts"), "lists scripts");
}

// ─── todo_write ────────────────────────────────────────
async function testTodoWrite() {
  console.log(`\n${c.bold}todo_write${c.reset}`);

  // Create
  const r1 = await registry.execute("todo_write", {
    action: "create",
    items: JSON.stringify([
      { content: "Task 1", status: "pending", priority: "high" },
      { content: "Task 2", status: "in_progress", priority: "medium" },
    ]),
  });
  assert(!r1.isError, "creates todo list");
  assert(r1.content.includes("Task 1"), "contains task 1");
  assert(r1.content.includes("Progress"), "shows progress");

  // Update
  const r2 = await registry.execute("todo_write", { action: "update", index: 0, status: "completed" });
  assert(!r2.isError, "updates todo item");
  assert(r2.content.includes("✓"), "shows completion icon");

  // List
  const r3 = await registry.execute("todo_write", { action: "list" });
  assert(!r3.isError, "lists todos");
  assert(r3.content.includes("Task 2"), "still has task 2");

  // Clear
  const r4 = await registry.execute("todo_write", { action: "clear" });
  assert(!r4.isError, "clears todo list");
}

// ─── web_fetch ─────────────────────────────────────────
async function testWebFetch() {
  console.log(`\n${c.bold}web_fetch${c.reset}`);

  // HTTPS URL
  const r1 = await registry.execute("web_fetch", { url: "https://httpbin.org/get", max_chars: 500 });
  assert(!r1.isError, "fetches HTTPS URL");
  assert(r1.content.includes("httpbin"), "contains expected content");

  // Blocked protocol
  const r2 = await registry.execute("web_fetch", { url: "file:///etc/passwd" });
  assert(r2.isError === true, "blocks file:// protocol");

  // 404 URL
  const r3 = await registry.execute("web_fetch", { url: "https://httpbin.org/status/404" });
  assert(r3.isError === true, "handles 404");
}

// ─── web_search (Brave) ────────────────────────────────
async function testWebSearch() {
  console.log(`\n${c.bold}web_search (Brave)${c.reset}`);

  if (!process.env.BRAVE_SEARCH_API_KEY) {
    console.log(`  ${c.yellow}⊘${c.reset} skipped (no BRAVE_SEARCH_API_KEY)`);
    return;
  }

  const r1 = await registry.execute("web_search", { query: "TypeScript programming language", max_results: 3 });
  assert(!r1.isError, "searches without error");
  assert(r1.content.includes("Search results"), "has results header");
  assert(r1.content.includes("http"), "contains URLs");
}

// ─── spawn_agent (definition only) ─────────────────────
async function testSpawnAgent() {
  console.log(`\n${c.bold}spawn_agent${c.reset}`);

  assert(registry.has("spawn_agent"), "tool registered");
  assert(registry.getDefinitions().some((d) => d.function.name === "spawn_agent"), "in definitions");

  const def = registry.getDefinitions().find((d) => d.function.name === "spawn_agent")!;
  assert(def.function.parameters.required.includes("type"), "requires type param");
  assert(def.function.parameters.required.includes("prompt"), "requires prompt param");
}

// ─── Run all ───────────────────────────────────────────
async function main() {
  console.log(`${c.bold}${c.cyan}══════════════════════════════════════════`);
  console.log(`  Jim Agent — Tool Test Suite`);
  console.log(`══════════════════════════════════════════${c.reset}`);

  await testReadFile();
  await testListFiles();
  await testGrep();
  await testWriteAndEdit();
  await testRunCommand();
  await testGitCommand();
  await testGetProjectInfo();
  await testTodoWrite();
  await testWebFetch();
  await testWebSearch();
  await testSpawnAgent();

  console.log(`\n${c.bold}══════════════════════════════════════════`);
  console.log(`  Results: ${c.green}${passed} passed${c.reset}${c.bold}, ${c.red}${failed} failed${c.reset}${c.bold} (${passed + failed} total)`);
  console.log(`${c.bold}══════════════════════════════════════════${c.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
