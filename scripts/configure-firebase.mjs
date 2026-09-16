import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { values } = parseArgs({ options: { app: { type: "string" } } });
const project = JSON.parse(
  readFileSync(new URL("../.firebaserc", import.meta.url), "utf8"),
).projects.default;
const cli = fileURLToPath(
  new URL(
    "../node_modules/firebase-tools/lib/bin/firebase.js",
    import.meta.url,
  ),
);
function firebase(...args) {
  const output = execFileSync(
    process.execPath,
    [cli, ...args, "--project", project, "--json", "--non-interactive"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const result = JSON.parse(output);
  if (result.status !== "success")
    throw new Error(result.error ?? "Firebase configuration failed.");
  return result.result;
}
const apps = firebase("apps:list", "WEB");
let app = values.app
  ? apps.find((app) => app.appId === values.app)
  : apps.length === 1
    ? apps[0]
    : apps.find((app) => app.displayName === "Glengarry CLG website");
if (!app && apps.length > 0)
  throw new Error("Select the web app with --app APP_ID.");
if (!app) app = firebase("apps:create", "WEB", "Glengarry CLG website");
const config = firebase("apps:sdkconfig", "WEB", app.appId).sdkConfig;
const filename = new URL("../.env.local", import.meta.url);
const existing = existsSync(filename)
  ? readFileSync(filename, "utf8")
      .split("\n")
      .filter((line) => !/^VITE_FIREBASE_|^VITE_USE_EMULATORS=/.test(line))
      .join("\n")
      .trim()
  : "";
writeFileSync(
  filename,
  `${existing ? `${existing}\n` : ""}VITE_FIREBASE_API_KEY=${config.apiKey}\nVITE_FIREBASE_AUTH_DOMAIN=${config.authDomain}\nVITE_FIREBASE_PROJECT_ID=${config.projectId}\nVITE_FIREBASE_APP_ID=${config.appId}\nVITE_USE_EMULATORS=false\n`,
);
console.log(
  `Configured ${project}. Public Firebase web configuration was saved to .env.local.`,
);
