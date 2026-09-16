# Glengarry Community Liaison Group

A public document library and an invitation-only member workspace, built for Firebase project **`glengarry-clg-site`**.

Live website: **https://glengarry-clg.net** ([Firebase Hosting address](https://glengarry-clg-site.web.app)). Deployment and live workflow verification completed on 15 September 2026. Verification covered sign-in, invitation-only access, private uploads, new versions, publication, downloads, withdrawal, direct-data access denial and membership revocation. The temporary verification account and documents were removed afterwards.

The project has been provisioned with a London (`europe-west2`) Firestore database and a private `glengarry-clg-site.firebasestorage.app` bucket. Email/password authentication and email enumeration protection are enabled; public account sign-up is disabled. The website's Firebase web configuration is in the ignored `.env.local`.

## Features

- Public group description and membership page.
- Public library with document descriptions, publication dates and downloads.
- Firebase email/password sign-in for pre-invited members, with password reset.
- Document uploads (PDF, Word, Excel, PowerPoint, text and CSV; up to 25 MB).
- Immutable versions with notes, upload dates and uploader names visible to members.
- Explicit publishing and withdrawal from the public library.
- A new revision stays private while the previously published version remains available.
- Responsive layouts, keyboard-accessible dialogs, upload progress and error states.

## Architecture

| Component                                              | Service                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| React + TypeScript frontend                            | Firebase Hosting                                                  |
| Member sign-in                                         | Firebase Authentication                                           |
| Document metadata, version records and invited members | Cloud Firestore                                                   |
| Original document files                                | Google Cloud Storage, through the default Firebase Storage bucket |
| Authorized uploads, downloads and publication          | A second-generation Firebase HTTPS function in `europe-west2`     |

The browser calls `/api` through a Hosting rewrite. The API validates Firebase ID tokens and reads `members/{uid}.active` on **every** member request. Firestore and Storage client rules deny all direct access; the function accesses them through its service account. Do not make the bucket public or grant anonymous IAM access.

The project's organisation policy blocks `allUsers` IAM grants. The function deployment hook therefore configures `invokerIamDisabled=true` on the single Cloud Run `api` service, following [Google's public-service guidance for domain-restricted projects](https://docs.cloud.google.com/run/docs/authenticating/public). This lets requests reach Express, where public and member access are enforced. The function declares `invoker: "private"` to prevent Firebase CLI from attempting an `allUsers` grant; this does not describe the final HTTP accessibility after the hook runs. The hook uses the signed-in Firebase CLI administrator and is restricted to this project and service.

Public responses contain only the selected published version and public metadata. They never include storage paths, member names or version notes. Downloads are streamed with `Content-Disposition: attachment` and `Cache-Control: private, no-store`. Permanent Firebase Storage download tokens and public signed URLs are not generated. Withdrawing a publication prevents subsequent public requests; copies already downloaded cannot be recalled.

Uploads use unique storage paths and Firestore transactions to allocate version numbers. Concurrent uploads retain separate versions. Publishing checks the version that the member reviewed and rejects stale publication attempts. A failed metadata write triggers cleanup of its uploaded object.

## Local preview

Use Node.js 22 (`nvm use` if you have nvm).

```sh
npm ci
npm --prefix functions ci
npm run dev
```

Open `http://127.0.0.1:5173`. If no Firebase configuration is supplied, the **development server only** shows labelled sample documents and an “Explore member workspace” button. Preview uploads stay in memory and reset on reload. Sample PDFs identify themselves as examples. Demo data and demo sign-in are excluded from production builds.

## Firebase setup and deployment

1. Sign in and fetch the web app configuration:

   ```sh
   npx firebase login
   npm run configure:firebase
   ```

   The configuration script reuses an existing web app, or registers “Glengarry CLG website” if none exists. If there are multiple web apps, use `npm run configure:firebase -- --app APP_ID`. It writes public web configuration to the ignored `.env.local`. It does not handle service-account keys.

2. In the [Firebase Console](https://console.firebase.google.com/project/glengarry-clg-site/overview):
   - Enable **Authentication → Email/Password**. Leave unused sign-in providers disabled.
   - Add `glengarry-clg-site.web.app` and any custom website domain to Authentication’s authorised domains.
   - Enable email enumeration protection in Authentication settings.
   - Disable end-user sign-up in Authentication's user actions so that only administrators can create invited accounts.
   - Create the default **Cloud Firestore** database in production mode. Choose the intended location before creating it; `europe-west2` keeps the database near the London function.
   - Create the default **Storage** bucket in production mode. Keep it private. The function uses the default bucket supplied by Firebase automatically.
   - Enable the **Blaze** billing plan if needed for Cloud Functions and Storage. Billing setup is an account-owner action.

3. Replace the draft copy and add the approved public membership details in `src/content.ts`. Membership shown on the website is separate from private login accounts. No member names or official meeting records have been invented.

4. Check and deploy:

   ```sh
   npm test
   npm run build:all
   npx firebase deploy --project glengarry-clg-site
   ```

   Predeploy checks reject missing Firebase configuration, a mismatched project, emulator settings and a separate API origin. Hosting builds the production frontend and functions compile automatically. The deployed address will be `https://glengarry-clg-site.web.app`.

   The function's runtime service account, `83801734868-compute@developer.gserviceaccount.com`, has the following permissions:

   | Role                        | Scope                                           | Purpose                                     |
   | --------------------------- | ----------------------------------------------- | ------------------------------------------- |
   | `roles/datastore.user`      | Project `glengarry-clg-site`                    | Read and update member and document records |
   | `roles/firebaseauth.viewer` | Project `glengarry-clg-site`                    | Check account status and revoked sessions   |
   | `roles/storage.objectUser`  | Bucket `glengarry-clg-site.firebasestorage.app` | Store and retrieve document versions        |

   Google Cloud Build uses the same default service account. Its build permissions are `roles/storage.objectViewer` on the generated `gcf-v2-sources-83801734868-europe-west2` source bucket, `roles/artifactregistry.writer` on the `gcf-artifacts` repository in `europe-west2`, and project-level `roles/logging.logWriter`. Generated deployment images have a seven-day cleanup policy.

   Keep infrastructure administration restricted to the project administrators.

5. Prepare the first member invitation using the command below. Verify real sign-in, a private upload, publication, anonymous download and withdrawal on the deployed site.

### Invite members

Invitations are an administrator operation, not a public registration form. Add `--firebase-login` to reuse the Firebase CLI account you signed in with. The administrator needs Firebase Authentication admin and Firestore write access. Without this flag, the scripts use **Application Default Credentials** (for example, `gcloud auth application-default login`). Never put an admin credential in a `VITE_` variable or commit a key file.

```sh
npm --prefix functions run invite -- \
  --project glengarry-clg-site \
  --email member@example.com \
  --name "Member Name" \
  --firebase-login
```

The script creates the account, authorises its UID and prints a password-setup link. **Send that link privately to the member yourself.** The script does not send email. For a new invitation to a pre-existing unauthorised account, it first replaces the old password and revokes old sessions so that a pre-registration cannot acquire access. Active members can be reissued a setup link without changing their current password.

For a custom domain, append `--site-url https://your-domain.example` and add the domain to Firebase Authentication's authorised domains.

To revoke access immediately:

```sh
npm --prefix functions run revoke -- \
  --project glengarry-clg-site \
  --email member@example.com \
  --firebase-login
```

Revocation disables membership and the Authentication account and revokes its sessions. Documents remain intact. An authenticated account without an active member record cannot access member data or upload files. The deployed project additionally disables public account sign-up.

## Tests and emulators

`npm test` runs policy tests for public/private metadata isolation, filename and content validation, size limits and metadata validation.

Install Java 21 or newer for the Firebase emulators, then run:

```sh
npm run test:integration
```

This uses the disposable **`demo-glengarry-clg`** project. The test refuses to run without local emulator endpoints. It covers unauthenticated and uninvited requests, actual Storage uploads/downloads, deny-all client rules, absence of download tokens, publication, private revisions, stale-publish protection, concurrent version creation, history, withdrawal and immediate revocation.

To run the app against emulators interactively, use the following `.env.local` and run `npm run emulators` in one terminal and `npm run dev` in another:

```dotenv
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-glengarry-clg.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-glengarry-clg
VITE_FIREBASE_APP_ID=demo-app-id
VITE_USE_EMULATORS=true
```

Create a disposable email/password user in the Emulator UI (`http://127.0.0.1:4000`) and a Firestore `members/{uid}` document containing `name`, `email`, and `active: true`. Use the Vite address for interactive testing; its `/api` proxy forwards to the function emulator. Production Hosting security headers intentionally do not permit local emulator connections.

## Public source and private data

This repository publishes the website's source code, access rules and deployment configuration under the [MIT License](LICENSE). Group documents, member records and account credentials are held in Firebase and Google Cloud, separately from the source repository.

- Firebase project IDs, bucket names, service-account email addresses and web configuration identify resources; they do not grant administrator or member access. Firebase web API keys are designed to be visible in browser applications. See [Firebase's guidance](https://firebase.google.com/support/guides/security-checklist#api-keys-not-secret).
- Keep local configuration in `.env.local`; `.env.example` contains only empty values and safe defaults. Every `VITE_` value is included in the browser build, so never use this prefix for private credentials.
- Keep private operational files and invitation-link exports under `private/`. The ignore rules also cover common credential filenames, environment files, logs, Firebase exports and local tool state. Do not put real invitations, passwords, member exports or private documents in source files, public issues or screenshots.
- Ignore rules prevent new files from being added normally; they do not remove files already committed, and `git add --force` overrides them. Review the staged diff before each push. Git commit author names and email addresses are public metadata.
- A fork must use its own Firebase project and credentials. Update `.firebaserc` and the project restriction in `scripts/configure-api-access.mjs` before deploying a fork; the checked-in defaults describe the Glengarry deployment.

## Operational notes

- Configure an appropriate retention/backup policy for Firestore and the Storage bucket before relying on the library as the group's sole archive.
- The application preserves original versions and intentionally has no destructive delete control.
- File types are checked by extension and header where applicable; antivirus scanning is not included.
- The library retrieves all metadata in one request, suitable for a small liaison group. Introduce pagination if the collection grows substantially.
- Functions are limited to five instances with four concurrent requests per instance to bound resource usage; uploads use a buffered request and a 25 MB application limit.
- Runtime dependencies and deployment tooling are installed separately in the root and `functions` directories; keep both lockfiles updated.

Reference documentation: [Firebase Hosting and Functions](https://firebase.google.com/docs/hosting/functions), [Firebase Authentication](https://firebase.google.com/docs/auth/web/password-auth), [Admin email action links](https://firebase.google.com/docs/auth/admin/email-action-links), [Local Emulator Suite](https://firebase.google.com/docs/emulator-suite).
