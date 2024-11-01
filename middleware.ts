// import { auth } from "@/auth"
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    console.log(`Starting handling of request ${request.url}`);

    const response = NextResponse.next();

    console.log(`Ending handling of request ${request.url} with ${response.status}`)

    return response;
}

export const config = {}
