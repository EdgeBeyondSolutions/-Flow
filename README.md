# Flow — personal GTD manager

A productivity app built around *Getting Things Done* (David Allen): Inbox, Next
actions (list + board by context), Projects, Waiting for, Someday/Maybe, Calendar,
and a guided weekly review. No build step — plain HTML/CSS/JS — ready for GitHub
Pages. Data syncs to the cloud via Firebase so you can access it from any device.

## 1. Create your Firebase project (free, ~5 min)

You'll need to do this part yourself (creating accounts isn't something I can do
on your behalf):

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and
   sign in with your Google account.
2. **Create a project** → give it a name (e.g. "flow-gtd") → you can turn off
   Google Analytics, you don't need it.
3. In the side menu go to **Build → Authentication** → **Sign-in method** tab →
   enable **Email/Password**.
4. Go to **Build → Firestore Database** → **Create database** → pick the region
   closest to you → start in **production mode**.
5. Once it's created, go to the **Rules** tab and replace the contents with this
   (only you, authenticated, can read/write your own data):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   Publish the changes.

6. Go to **Project settings** (gear icon) → scroll down to **Your apps** → click
   the `</>` (Web) icon → give the app a name → **Register app**.
7. Copy the `firebaseConfig` object it shows you and paste it into
   [`js/firebase-config.js`](js/firebase-config.js), replacing the placeholder
   values.

## 2. Test it locally

ES modules need to be served over HTTP (not `file://`). From this folder:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Create your account from the login screen ("First
time here? Create an account") with your email and a password.

## 3. Publish on GitHub Pages

```bash
git init
git add .
git commit -m "Flow: personal GTD app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gtd-flow.git
git push -u origin main
```

Then in GitHub: **Settings → Pages → Source → Deploy from a branch → main /
(root)**. Within a couple minutes your app will be live at
`https://YOUR_USERNAME.github.io/gtd-flow/`.

> `js/firebase-config.js` contains public Firebase client keys (not secrets —
> they're protected by the Firestore security rules from step 1.5), so it's safe
> to commit to a public repo.

## How the GTD flow works

- **Capture** ("Capture" button or the `C` key) — get anything on your mind into
  the Inbox without overthinking it.
- **Clarify** — open each Inbox item and decide: is it actionable? Turn it into a
  Next action, a Project, Waiting for, or Someday/Maybe.
- **Organize** — assign a context (@Home, @Computer, etc.), a project, and a due
  date if it applies.
- **Reflect** — use the Weekly review every week to keep the system trustworthy.
- **Engage** — the board view in Next actions, grouped by context.

## Keyboard shortcuts

- `C` — quick capture
- `/` — search
- `Esc` — close any panel/modal
