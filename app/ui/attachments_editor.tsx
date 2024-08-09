"use client";

import { ChangeEvent, useState } from "react";
import { ShallowAttachment } from "../lib/definitions";
import { ResponseData } from "../api/route";
import { AttachmentsViewer } from "./recipe";

export type MaterializedAttachment = ShallowAttachment & {
    img_src: string;
}

export type SelectedFile = File & Partial<ResponseData>;

export function AttachmentsEditor(params: { attachments?: MaterializedAttachment[] }) {
    const [selectedFile, setSelectedFile] = useState<SelectedFile>();
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'preparing' | 'uploading' | 'finished' | 'error'>('idle')
    const [displayText, setDisplayText] = useState<string>('');

    async function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const files = event.target.files;
        if (!files) {
            setUploadStatus('idle');
            return;
        }

        const selectedFile : SelectedFile = files[0];
        setSelectedFile(selectedFile);
        setDisplayText(`Uploading ${selectedFile.name}`)
        setUploadStatus('preparing')
        const storageInformation: ResponseData = await (await fetch('/api', {method: 'POST', body: JSON.stringify({file_name: selectedFile.name})})).json();
        setDisplayText(`PUTing to ${storageInformation.key} via ${storageInformation.url}`)
        setUploadStatus('uploading')
        selectedFile.key = storageInformation.key;
        selectedFile.url = storageInformation.url;
        setSelectedFile(selectedFile);
        const blob = new Blob([selectedFile]);
        const response = await fetch(storageInformation.url, {method: 'PUT', body: blob})
        setUploadStatus('finished');
        setDisplayText(`Response for ${selectedFile.name}: ${response.status}`);
    }

    return (
        <div>
            <AttachmentsViewer attachments={params.attachments}/>
            {/* Input field wihtout name won't be submitted, this is okay, we submit the key instead of the file since we upload directly to S3 on client side */}
            <input type="file" id="new_attachment" multiple={true} onChange={handleChange} />
            <p>{uploadStatus} - {displayText}</p>
            {selectedFile && <img className='w-96 max-h-[50vh] h-auto' src={URL.createObjectURL(selectedFile)} alt={selectedFile.name} /> }
            {selectedFile && uploadStatus === 'finished'  && <input type="text" name="new_attachment" value={selectedFile.key} hidden /> }
        </div>
    );
}
