
import {
    S3Client,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type NotPromise<T> = T extends Promise<infer ReturnType> ? never : T

export function withTiming<T>(lable: string, callable: () => NotPromise<T>): T {
    console.log(`starting: ${lable}`);
    performance.mark(`start: ${lable}`);
    const result = callable();
    performance.mark(`stop: ${lable}`);
    console.log(performance.measure(`measure: ${lable}`, `start: ${lable}`, `stop: ${lable}`));
    return result;
}

export async function withTimingAsync<T>(lable: string, callable: () => Promise<T>): Promise<T> {
    console.log(`starting: ${lable}`);
    performance.mark(`start: ${lable}`);
    const result = await callable();
    performance.mark(`stop: ${lable}`);
    console.log(performance.measure(`measure: ${lable}`, `start: ${lable}`, `stop: ${lable}`));
    return result;
}

const S3 = new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
});

export async function getImageSrcForKeyOfUserUploadedAttachment(key: string): Promise<string> {
    return await getSignedUrl(S3, new GetObjectCommand({Bucket: 'recipes-app-images', Key: key}), { expiresIn: 3600 })
}
