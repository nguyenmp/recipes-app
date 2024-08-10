"use client";

import showdown from "showdown";

import { ChangeEvent, useState } from "react";
import { MarkdownPreview } from "./markdown";


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

export function Links(params: {content_markdown: string}) {
    const html_string = new showdown.Converter({ simplifiedAutoLink: true }).makeHtml(params.content_markdown || '');
    const document = getHtmlAsDocument(html_string);
    const links = document.querySelectorAll('a');

    return (
        <div>
            <p>Links:</p>
            <ul>
                {Array.from(links).map((element, index) => {
                    return <li key={index}>{element.href ?? element.attributes.href}</li>
                })}
            </ul>
        </div>
    )
}

export function MarkdownEditorWithPreview(params: { content_markdown?: string, placeholder?: string }) {
    const [contentMarkdown, setContentMarkdown] = useState<string>(params.content_markdown || '');

    function handleFieldChange(event: ChangeEvent<HTMLTextAreaElement>) {
        setContentMarkdown(event.target.value);
    }

    return (
        <div className="flex flex-row">
            <label className="p-2" htmlFor="content_markdown">Content</label>
            <textarea className="border bg-slate-200 p-2" id="content_markdown" name="content_markdown" defaultValue={params.content_markdown} placeholder={params.placeholder} onChange={handleFieldChange} />
            <div className="flex flex-col">
                <p>Markdown Preview:</p>
                <noscript>
                    {/* Basically this button refreshes the page with new query
                    params from the form, forcing server side rendering when
                    client side is not available */}
                    <input type="submit" value="Reload markdown preview" formMethod="get" formAction=''/>
                    <p>Automatic preview requires JavaScript to be enabled.</p>
                </noscript>
                <MarkdownPreview content_markdown={contentMarkdown} />
                <Links content_markdown={contentMarkdown}/>
            </div>
        </div>
    );
}
