import type { NextApiRequest, NextApiResponse } from 'next'
 import { getSignedUrlToUploadAttachmentFromClient as getSignedUrl } from "../lib/s3";
import {v4 as uuidv4} from 'uuid'
import { z } from 'zod'
import { NextRequest } from 'next/server';

export type ResponseData = {
  url: string,
  key: string,
}

const schema = z.object({
  file_name: z.string(),
})

export async function POST(
  req: NextRequest
) {
  const body = schema.parse(await req.json());
  const key = `${uuidv4()}_${body.file_name}`;
  const url =  await getSignedUrl(key);
  const response : ResponseData = { url, key };
  return Response.json(response)
}