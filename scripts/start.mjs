import { access, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import http from "node:http";
import path from "node:path";
import { exec, spawn } from "node:child_process";
import readline from "node:readline";

const root = process.cwd();
const availabilityPath = path.join(root, "public", "data", "availability.json");
let isScraping = false;

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runScraper() {
  if (isScraping) {
    console.log("⚠️ Scraper is already running. Please wait.");
    return Promise.resolve();
  }
  isScraping = true;
  console.log("\n🔄 Fetching latest tennis court availability data...");
  console.log("   This fetches slots from e-kanagawa and Yokohama systems and may take 1-2 minutes.");

  return new Promise((resolve) => {
    const child = spawn("node", [path.join(root, "scripts", "check-slots.mjs")], {
      stdio: "inherit",
      cwd: root
    });

    child.on("close", (code) => {
      isScraping = false;
      if (code === 0) {
        console.log("✅ Availability data successfully updated!\n");
      } else {
        console.error(`❌ Scraper exited with code ${code}. Check logs above for details.\n`);
      }
      resolve();
    });
  });
}

function openBrowser(url) {
  let command;
  if (process.platform === "darwin") {
    command = `open "${url}"`;
  } else if (process.platform === "win32") {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  exec(command, () => {
    // Fail silently if browser couldn't open
  });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function startServer(port = 4173) {
  const publicDir = path.join(root, "public");

  const server = http.createServer(async (req, res) => {
    try {
      const safeUrl = req.url.split("?")[0];
      let filePath = path.join(publicDir, safeUrl);

      // Security check: ensure path is within publicDir
      if (!filePath.startsWith(publicDir)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }

      let stats;
      try {
        stats = await stat(filePath);
      } catch {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      if (stats.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        try {
          stats = await stat(filePath);
        } catch {
          res.statusCode = 404;
          res.end("Not Found");
          return;
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      // Set headers for development (prevent caching of fresh scraper JSON data)
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      });

      createReadStream(filePath).pipe(res);
    } catch (err) {
      res.statusCode = 500;
      res.end(`Server Error: ${err.message}`);
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("Server error:", err);
    }
  });

  server.listen(port, () => {
    const localUrl = `http://localhost:${port}`;
    console.log(`🚀 Local server is running at: \x1b[36m${localUrl}\x1b[0m`);
    console.log("   ------------------------------------------------------------");
    console.log("   Press \x1b[35mr\x1b[0m to refresh availability data manually.");
    console.log("   Press \x1b[31mCtrl+C\x1b[0m to stop the server.");
    console.log("   ------------------------------------------------------------\n");
    
    openBrowser(localUrl);
  });
}

function setupInteractiveInput() {
  if (!process.stdin.isTTY) return;

  readline.emitKeypressEvents(process.stdin);
  try {
    process.stdin.setRawMode(true);
  } catch {
    // Raw mode might not be supported in some environments
    return;
  }

  process.stdin.on("keypress", async (str, key) => {
    if (key.ctrl && key.name === "c") {
      process.exit();
    } else if (key.name === "r") {
      await runScraper();
    }
  });
}

async function main() {
  console.log("==========================================================");
  console.log("🎾  Tennis Reservation Watcher - Local Launcher  🎾");
  console.log("==========================================================");

  const dataExists = await fileExists(availabilityPath);
  if (!dataExists) {
    console.log("No availability data found in public/data/availability.json.");
    console.log("Running scraper first to fetch initial tennis slots...");
    await runScraper();
  } else {
    console.log("Found existing availability data.");
    console.log("Running scraper in background to get the freshest data...");
    runScraper(); // Run in parallel in background
  }

  // Start the server
  startServer(4173);

  // Setup periodic updates (hourly)
  setInterval(runScraper, 60 * 60 * 1000);

  // Setup interactive CLI keypress listener
  setupInteractiveInput();
}

main().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});
