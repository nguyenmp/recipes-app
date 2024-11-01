import 'server-only'

import PostgresAdapter from "@auth/pg-adapter"
import NextAuth from "next-auth"
import { connectionPoolForAuth } from "./app/lib/sql"
import Nodemailer from "next-auth/providers/nodemailer"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(connectionPoolForAuth),
  providers: [
    Nodemailer({
      server: {
        pool: true,
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
})
