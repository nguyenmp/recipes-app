"use client";

import { ShallowAttachment } from "../lib/definitions";

export type MaterializedAttachment = ShallowAttachment & {
    img_src: string;
}

export function AttachmentsEditor(params: { attachments?: MaterializedAttachment[] }) {

    return (
        <div className="max-w-screen overflow-y-auto">
            <div className="flex flex-row">
                {params.attachments?.map((attachment) => {
                    return <a key={attachment.name} className='flex-shrink-0' href={attachment.img_src}><img className='h-96 max-h-[50vh] w-auto' src={attachment.img_src} alt={attachment.name} /></a>
                })}
            </div>
        </div>
    );
}
