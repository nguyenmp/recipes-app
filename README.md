This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First install dependencies

```bash
npm install -g pnpm
pnpm i # pnpm specifically supports our patching system (pnpm patch)
```

Then set up local env file for PostgreSQL and Cloudflare R2 (AWS S3 compatible blob storage).

```bash
# Install the vercel CLI
pnpm i -g vercel

# Link to the project (needs auth and permissions)
vercel link

# Download the environment variables necessary
vercel env pull .env.local
```

Then, run the development server:

```bash
pnpm dev
```

Visit [http://localhost:3000/admin](http://localhost:3000/admin) and hit "Reset Database" to seed the database with placeholder data.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Running Tests

I'm just following the guide at https://nextjs.org/docs/app/building-your-application/testing

We use playwright for end-to-end tests.

```
pnpm run dev
pnpm exec playwright test [--ui]
```

It's very noticable that tests can get weird sometimes so clean installing helps a lot:

```
rm -r .next/cache node_modules
pnpm install
pnpm dev
```

You can also run tests against production by changing `playwright.config.ts` to say:
```diff
-    baseURL: 'http://localhost:3000',
+    baseURL: 'https://recipes-app-lyart.vercel.app/',
```

## Updating Dependencies

Try updating all dependencies first:

```bash
# This ignores package range restrictions and installs latest of everything
pnpm update --latest
```

You'll likely encounter some errors like eslint being mismatched.  As of right now, eslint is released to 9.8.0 but nextjs only supports 8.x.  Fix any errors like that manually and rerun with:

```bash
# This respects package range restrictions
pnpm update
```

Make sure to restart the development server, things get weird when you update dependencies while the server is running
```bash
rm -r .next/cache && pnpm dev
```

## Importing data and updating placeholder-data.ts

See `scripts/process.py`.

## Resetting production database

We can't hit the reset button on production easily because we have 6 seconds per request (based on lambdas).

I want to self-host but I can't seem to get onnxruntime-node to work on docker.

So temporary workaround is to run local development reset against production database:

```
vercel env pull --environment=production .env.local
pnpm build && pnpm start
http://localhost:3000/admin
Hit reset
vercel env pull .env.local
```