import { loadEnv } from "vite";
import { readFileSync } from "node:fs";
const env = loadEnv("production", process.cwd(), "VITE_");
const project = JSON.parse(readFileSync(".firebaserc", "utf8")).projects
  .default;
for (const name of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID"]) {
  if (!env[`VITE_FIREBASE_${name}`])
    throw new Error(
      `VITE_FIREBASE_${name} is missing. Run npm run configure:firebase after signing in to Firebase.`,
    );
}
if (env.VITE_FIREBASE_PROJECT_ID !== project)
  throw new Error(
    "The Firebase web configuration and .firebaserc point to different projects.",
  );
if (env.VITE_USE_EMULATORS === "true")
  throw new Error("Disable emulators before deploying to Firebase Hosting.");
if (env.VITE_API_BASE_URL)
  throw new Error(
    "Remove VITE_API_BASE_URL to use the same-origin Firebase Hosting API rewrite.",
  );
console.log(`Deployment configuration verified for ${project}.`);
