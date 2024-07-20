"use client";

import { ChangeEvent, useState } from "react";
import { MarkdownPreview } from "./markdown";

export function MarkdownEditorWithPreview(params: { content_markdown?: string, placeholder?: string }) {
    const [contentMarkdown, setContentMarkdown] = useState<string>(params.content_markdown || '');

    function handleFieldChange(event: ChangeEvent<HTMLTextAreaElement>) {
        setContentMarkdown(event.target.value);
    }

    return (
        <div className="flex flex-row">
            <label className="p-2" htmlFor="content_markdown">Content</label>
            <textarea className="border bg-slate-200 p-2" rows={10} cols={30} id="content_markdown" name="content_markdown" defaultValue={params.content_markdown} placeholder={params.placeholder} onChange={handleFieldChange} />
            <MarkdownPreview content_markdown={contentMarkdown} />
        </div>
    );
}
