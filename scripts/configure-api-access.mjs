import { setTimeout } from "node:timers/promises";
import { firebaseLoginCredential } from "./firebase-login-credential.mjs";

// This API serves public documents and enforces Firebase member authentication
// inside Express. Cloud Run's IAM check expects Google IAM identities instead.
// Google recommends this public-service setting for domain-restricted projects:
// https://docs.cloud.google.com/run/docs/authenticating/public
const project = "glengarry-clg-site";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== project) {
  throw new Error(`This deployment hook is restricted to ${project}.`);
}
const service = `projects/${project}/locations/europe-west2/services/api`;
const origin = "https://run.googleapis.com/v2";
const credential = await firebaseLoginCredential(project);
async function request(path, method = "GET", body) {
  const response = await fetch(`${origin}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${(await credential.getAccessToken()).access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(
      `API access configuration failed (${response.status}): ${await response.text()}`,
    );
  }
  return response.json();
}
const current = await request(service);
if (current.invokerIamDisabled !== true) {
  let operation = await request(
    `${service}?updateMask=invokerIamDisabled,template.revision`,
    "PATCH",
    {
      name: service,
      etag: current.etag,
      invokerIamDisabled: true,
      // Firebase pins a revision name. Let Cloud Run generate a new name when
      // applying service settings, preserving the rest of the existing template.
      template: { revision: "" },
    },
  );
  for (let attempt = 0; !operation.done && attempt < 60; attempt++) {
    await setTimeout(3000);
    operation = await request(operation.name);
  }
  if (!operation.done || operation.error) {
    throw new Error(
      `API access update did not complete: ${JSON.stringify(operation.error ?? { name: operation.name })}`,
    );
  }
}
const verified = await request(service);
if (verified.invokerIamDisabled !== true) {
  throw new Error("The public API entry point is not configured.");
}
console.log(
  "Public API entry point configured; member requests require Firebase authentication and active membership.",
);
