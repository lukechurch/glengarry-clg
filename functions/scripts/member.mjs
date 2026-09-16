import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseLoginCredential } from "../../scripts/firebase-login-credential.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
    "site-url": { type: "string" },
    "firebase-login": { type: "boolean", default: false },
  },
});
const action = positionals[0];
if (
  !["invite", "revoke"].includes(action) ||
  !values.project ||
  !values.email ||
  (action === "invite" && !values.name)
) {
  console.error(
    "Usage: node scripts/member.mjs invite|revoke --project PROJECT --email EMAIL [--name NAME] [--site-url https://PROJECT.web.app] [--firebase-login]",
  );
  process.exit(1);
}
const email = values.email.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error("Enter a valid email address.");
const site = new URL(values["site-url"] ?? `https://${values.project}.web.app`);
if (site.protocol !== "https:")
  throw new Error("The website URL must use HTTPS.");
const credential = values["firebase-login"]
  ? await firebaseLoginCredential(values.project)
  : undefined;
initializeApp({
  projectId: values.project,
  ...(credential ? { credential } : {}),
});
const auth = getAuth();
// Admin's Firestore wrapper requires ADC or a certificate. CLI login uses REST.
const db = credential ? null : getFirestore();
async function membership(uid, data) {
  if (db) {
    const reference = db.doc(`members/${uid}`);
    if (data) {
      await reference.set(data, { merge: true });
      return;
    }
    return (await reference.get()).data();
  }
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${values.project}/databases/(default)/documents/members/${encodeURIComponent(uid)}`,
  );
  if (data)
    for (const field of Object.keys(data))
      url.searchParams.append("updateMask.fieldPaths", field);
  const response = await fetch(url, {
    method: data ? "PATCH" : "GET",
    headers: {
      Authorization: `Bearer ${(await credential.getAccessToken()).access_token}`,
      "Content-Type": "application/json",
    },
    ...(data
      ? {
          body: JSON.stringify({
            fields: Object.fromEntries(
              Object.entries(data).map(([key, value]) => [
                key,
                typeof value === "boolean"
                  ? { booleanValue: value }
                  : { stringValue: value },
              ]),
            ),
          }),
        }
      : {}),
  });
  if (response.status === 404 && !data) return undefined;
  if (!response.ok)
    throw new Error(
      `Member record request failed (${response.status}): ${(await response.json()).error?.message ?? "Unknown error"}`,
    );
  const record = await response.json();
  return { active: record.fields?.active?.booleanValue === true };
}

if (action === "revoke") {
  const user = await auth.getUserByEmail(email);
  // Membership is checked on every API request, so this takes effect immediately.
  await membership(user.uid, {
    active: false,
    revokedAt: new Date().toISOString(),
  });
  await auth.revokeRefreshTokens(user.uid);
  await auth.updateUser(user.uid, { disabled: true });
  console.log(
    `Access revoked for ${email}. Stored documents and version history are preserved.`,
  );
} else {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({
      email,
      displayName: values.name.trim(),
      password: randomBytes(48).toString("base64url"),
    });
  }
  const existingMembership = await membership(user.uid);
  if (!existingMembership || existingMembership.active !== true) {
    // Reset any pre-existing password before granting access. An uninvited account
    // must not acquire membership using a password set before this invitation.
    await auth.updateUser(user.uid, {
      password: randomBytes(48).toString("base64url"),
      disabled: false,
      displayName: values.name.trim(),
    });
    await auth.revokeRefreshTokens(user.uid);
  }
  const link = await auth.generatePasswordResetLink(email, {
    url: `${site.origin}/sign-in`,
  });
  await membership(user.uid, {
    name: values.name.trim(),
    email,
    active: true,
    invitedAt: new Date().toISOString(),
  });
  console.log(
    `Invitation prepared for ${values.name.trim()} (${email}).\nShare this password setup link privately with the member:\n\n${link}\n\nThe script does not send email. The link grants account access; do not commit or publish it.`,
  );
}
