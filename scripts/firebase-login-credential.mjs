import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Administrator tooling only. Never import this module into the website or API.
// Reuse Firebase CLI's credential handling without writing or printing tokens.
const require = createRequire(new URL("../package.json", import.meta.url));
export async function firebaseLoginCredential(project) {
  const {
    getProjectDefaultAccount,
    setActiveAccount,
  } = require("firebase-tools/lib/auth");
  const { requireAuth } = require("firebase-tools/lib/requireAuth");
  const { getAccessToken } = require("firebase-tools/lib/apiv2");
  const options = { project, nonInteractive: true };
  const account = getProjectDefaultAccount(
    fileURLToPath(new URL("../", import.meta.url)),
  );
  if (!account)
    throw new Error("Run npx firebase login before using --firebase-login.");
  setActiveAccount(options, account);
  await requireAuth(options);
  return {
    async getAccessToken() {
      return { access_token: await getAccessToken(), expires_in: 300 };
    },
  };
}
