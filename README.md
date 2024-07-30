This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First install dependencies

```bash
npm install -g pnpm
pnpm i # pnpm specifically supports our patching system (pnpm patch)
```

Then set up local env file.  Copy from https://vercel.com/mark-nguyens-projects/recipes-app/stores/postgres/store_Wiaioan0XOOZgW5I/guides and paste into `.env.local`.  This allows you to connect to the development server.

Then, run the development server:

```bash
pnpm dev
```

Visit [http://localhost:3000/admin](http://localhost:3000/admin) and hit "Reset Database" to seed the database with placeholder data.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
