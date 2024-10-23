import showdown from "showdown";
import https from 'https'

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

function getHtmlAsDocument(html: string): Document {
    if (typeof process !== 'undefined' && process?.release?.name === 'node') {
        const HTMLParser = require('node-html-parser');
        const root = HTMLParser.parse(html);
        return root;
    } else {
        const parser = new DOMParser();
        return parser.parseFromString(html, 'text/html');
    }
}

export function getLinksFromMarkdown(content_markdown: string): HTMLAnchorElement[] {
    const html_string = new showdown.Converter({ simplifiedAutoLink: true }).makeHtml(content_markdown);
    const document = getHtmlAsDocument(html_string);
    const links = document.querySelectorAll('a');
    return Array.from(links);
}

export async function post(url: string, data: Object, headers: { [key: string]: string }): Promise<string> {
    const dataString = JSON.stringify(data)

    const options: https.RequestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': dataString.length,
            ...headers,
        },
        timeout: 60000, // in ms
    }

    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {

            const body: Uint8Array[] = []
            res.on('data', (chunk) => body.push(chunk))
            res.on('end', () => {
                const resString = Buffer.concat(body).toString()
                console.log(`Request result: ${resString}`);
                if (res.statusCode == undefined || res.statusCode < 200 || res.statusCode > 299) {
                    return reject(new Error(`HTTP status code ${res.statusCode} from ${url} with ${dataString}`))
                }

                resolve(resString)
            })
        })

        req.on('error', (err) => {
            reject(err)
        })

        req.on('timeout', () => {
            req.destroy()
            reject(new Error('Request time out'))
        })

        req.write(dataString)
        req.end()
    })
}

export function getUrlFromHTMLAnchorElement(link: HTMLAnchorElement): string {
        // Normally, we'd use link.getAttribute('href') or link.href the
        // former accientally breaks if the url contains &region cause it
        // converts &reg to the registered trademark unicode character
        // Just strip off the beginning 'href="' and trailing '"'
        const attributes : string = (link as any).rawAttrs;
        return attributes.slice(6, attributes.length - 1);
}