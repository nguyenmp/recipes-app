import 'server-only'

import PostgresAdapter from "@auth/pg-adapter"
import NextAuth from "next-auth"
import { connectionPoolForAuth } from "./app/lib/sql"
import Nodemailer from "next-auth/providers/nodemailer"
import { redirect } from 'next/navigation'

export enum Role {
  admin,
  read_only_guest,
};

const ACCOUNTS: {[key: string]: Role} = {
  'm.recipes.admin@href.cat': Role.admin,
  'm.recipes.guest@href.cat': Role.read_only_guest,
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(connectionPoolForAuth),
  callbacks: {
    signIn({user}) {
      return user.email != null && user.email != undefined && (user.email in ACCOUNTS);
    },
    session({session, user}) {
      if (user.email in ACCOUNTS) {
        session.user.role = ACCOUNTS[user.email];
      } else {
        throw new Error('Unauthorized account creation?');
      }

      return session;
    }
  },
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

export async function has_read_permissions(): Promise<boolean> {
  const session = await auth();
  return session?.user.role === Role.admin || session?.user.role === Role.read_only_guest;
}

export async function error_on_read_permissions() {
  if (!await has_read_permissions()) return redirect('/404');
}

export async function has_write_permissions(): Promise<boolean> {
  const session = await auth();
  return session?.user.role === Role.admin;
}