import "dotenv/config";
import { browser_action_handler } from "../tools/browser.js";
import { browserService } from "../tools/browser_service.js";

async function test() {
  console.log("🚀 Starting Antigravity Browser Smoke Test...");

  try {
    // 1. Test Navigation
    console.log("\n--- Testing Navigation ---");
    const navResult = await browser_action_handler({
      action: "navigate",
      url: "https://www.google.com",
    });
    console.log("Result:", navResult.content);

    // 2. Test Extraction
    console.log("\n--- Testing Extraction (Accessibility Tree) ---");
    const page = await browserService.getPage();
    const extractResult = await browser_action_handler({
      action: "extract",
    });
    console.log("Result type:", typeof extractResult.content);
    console.log(
      "Content preview:",
      extractResult.content.slice(0, 500) + "...",
    );

    // 3. Test Screenshot
    console.log("\n--- Testing Screenshot ---");
    const screenshotResult = await browser_action_handler({
      action: "screenshot",
      file_path: "test-google.png",
    });
    console.log("Result:", screenshotResult.content);

    console.log("\n✅ Smoke Test Completed Successfully!");
  } catch (error) {
    console.error("\n❌ Smoke Test Failed:", error);
  } finally {
    await browserService.close();
    process.exit(0);
  }
}

test();
