# Turning on sign-in, saving and the feed

Kamira's sign-in, account saving and Explore feed are built and on the site, but switched off. They turn on once Kamira knows which Supabase project to use. Setup takes about 20 minutes and costs nothing.

You'll do three things:

1. Make a free Supabase project (where accounts, stories and public pages live)
2. Make a Google sign-in key (so "Sign in with Google" works)
3. Give Kamira the project's link and public key

## 1. Make the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up. Signing up with GitHub or Google is fine.
2. Click **New project**.
   - Name: `kamira`
   - Database password: click **Generate**, then save it in your password manager. You won't need it day to day.
   - Region: **East US**
   - Plan: **Free**
3. Wait a minute or two while it sets up.
4. In the left bar, open **SQL Editor**, then **New query**.
5. Open `kamira/cloud/setup.sql` from the repo, copy all of it, paste it in, and click **Run**. You should see "Success. No rows returned."

That file sets up the tables, the privacy rules, and the two picture folders. It also makes `erika.mi.cary@gmail.com` the admin, which lets you see and restore hidden pages. If you'll sign in with a different Google account, change that email near the top of the file before running it.

## 2. Make the Google sign-in key

**In Supabase,** open **Authentication**, then **Sign In / Providers** (it may just say **Providers**), then **Google**. Copy the **Callback URL** shown there. It looks like `https://abcdefgh.supabase.co/auth/v1/callback`. Keep this tab open.

**In Google Cloud,** go to [console.cloud.google.com](https://console.cloud.google.com):

1. At the top, open the project picker and click **New project**. Name it `Kamira`, then click **Create** and switch to it.
2. Search the top bar for **Google Auth Platform** and open it. Click **Get started**.
   - App name: `Kamira`
   - User support email: your email
   - Audience: **External**
   - Contact email: your email
   - Agree, then click **Create**.
3. Open **Branding** in the left bar:
   - App home page: `https://erikacary.com/kamira/`
   - Privacy policy: `https://erikacary.com/kamira/privacy.html`
   - Authorized domains: add `erikacary.com`, and also the Supabase domain from the callback link (like `abcdefgh.supabase.co`)
   - Save.
4. Open **Audience** and click **Publish app**. Without this, only test users you list by hand could sign in. Kamira only asks for name and email, so Google doesn't need to review it.
5. Open **Clients**, then **Create client**:
   - Application type: **Web application**
   - Name: `Kamira web`
   - Authorized JavaScript origins: `https://erikacary.com`
   - Authorized redirect URIs: paste the Supabase **Callback URL** from above
   - Click **Create**, then copy the **Client ID** and **Client secret**.

**Back in Supabase,** on the Google provider page:

1. Turn on **Enable Sign in with Google**.
2. Paste the Client ID and Client secret, then click **Save**.
3. Open **Authentication**, then **URL Configuration**:
   - Site URL: `https://erikacary.com/kamira/`
   - Redirect URLs: add `https://erikacary.com/kamira/`
   - Save.

## 3. Give Kamira the link and key

In Supabase, open **Project Settings**, then **API** (or **API Keys** and **Data API**). Copy two things:

- **Project URL**, like `https://abcdefgh.supabase.co`
- The **public** key. It's labeled **anon public** or **publishable**. Don't use the **service_role** or **secret** key.

Both are safe to share: the privacy rules from step 1 do the protecting. Send them to Claude, or paste them into the top of `kamira/cloud/cloud.js`:

```js
const KAMIRA_CLOUD = { url:'https://abcdefgh.supabase.co', key:'your-public-key' };
```

After that change is pushed, "Sign in with Google" shows up on the profile, "Explore" shows up in the header, and Share gets a "Show in the Kamira feed" switch.

## Good to know

- **The free project naps.** If nobody visits for a week, Supabase pauses it. Sign-in and the feed stop working until you open the project in Supabase and click **Restore**. Stories saved in people's browsers are never affected. Supabase's $25/month plan never pauses.
- **Hidden pages.** When 2 people report a page, it hides itself. Sign in with your admin email, open **Explore**, and use the **Hidden** tab to restore or delete it.
- **Deleting someone's account.** If someone emails to delete their account (the privacy page says they can), open **Authentication**, then **Users**, find their email, and delete them. Their saved stories, cutouts and public pages are removed with them. Their picture files stay behind, so also open **Storage** and delete the folder named with their user id (shown on their Users row) in both `private` and `public`.
- **Pictures people upload** for public pages go in the `public` folder under **Storage**. Everything else stays in `private`.
