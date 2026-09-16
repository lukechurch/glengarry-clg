import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { app } from "./app.js";

initializeApp();
export const api = onRequest(
  {
    region: "europe-west2",
    // The deploy hook configures Cloud Run public access without an allUsers
    // IAM grant (blocked by domain-restricted sharing). Express gates members.
    invoker: "private",
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 5,
    concurrency: 4,
  },
  app,
);
