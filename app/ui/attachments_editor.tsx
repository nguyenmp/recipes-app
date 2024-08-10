"use client";

import { ChangeEvent, useState } from "react";
import { ShallowAttachment, ShallowNote } from "../lib/definitions";
import { ResponseData } from "../api/route";
import { AttachmentsViewer } from "./recipe";
import assert from "assert";

export type MaterializedAttachment = ShallowAttachment & {
    img_src: string;
}

export type SelectedFile = File & Partial<ResponseData>;

type Status = 'idle' | 'preparing' | 'uploading' | 'finished' | 'error';

export function AttachmentsEditor(params: { note?: ShallowNote, attachments?: MaterializedAttachment[] }) {
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [uploadStatuses, setUploadStatuses] = useState<Status[]>([])

    async function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const files : FileList | null= event.target.files;

        // If no files were selected, there's nothing to do
        if (!files) return;

        // This is the number of files already selected previously, so all of our indexes into state are offset by this much
        const offset = selectedFiles.length;

        // Update state to include the new files we're going to upload
        const newUploadStatuses = uploadStatuses.concat(new Array(files.length).fill('idle'))
        const newSelectedFiles = Array.from(selectedFiles);
        for (let index = 0; index < files.length; index++) {
            const file = files.item(index);
            assert(file !== null, 'File in file list was null despite it being within length...?')
            newSelectedFiles.push(file);

            uploadFile(file, index + offset, newSelectedFiles, newUploadStatuses);
        }
        setSelectedFiles(newSelectedFiles);
        setUploadStatuses(newUploadStatuses);
    }

    async function uploadFile(file: File, state_index: number, selectedFiles: SelectedFile[], uploadStatuses: Status[]) {
        // Fetch key and pre-signed upload URL
        uploadStatuses[state_index] = 'preparing';
        setUploadStatuses(Array.from(uploadStatuses));
        const storageInformation: ResponseData = await (await fetch('/api', {method: 'POST', body: JSON.stringify({file_name: file.name})})).json();
        Object.assign(selectedFiles[state_index], storageInformation);
        setSelectedFiles(Array.from(selectedFiles));

        // Start uploading to S3
        uploadStatuses[state_index] = 'uploading';
        setUploadStatuses(Array.from(uploadStatuses));
        const blob = new Blob([file]);
        const response = await fetch(storageInformation.url, {method: 'PUT', body: blob});

        // TODO: Maybe handle errors?

        // Done!
        uploadStatuses[state_index] = 'finished';
        setUploadStatuses(Array.from(uploadStatuses));

    }

    // If any attachment is not finished uploading, then UI should disable the save button
    const disabled = uploadStatuses.filter((status) => status != 'finished').length > 0;

    return (
        <div>
            <AttachmentsViewer attachments={params.attachments}/>
            {/* Input field without name won't be submitted, this is okay, we submit the key instead of the file since we upload directly to S3 on client side */}
            <input type="file" id="new_attachment" multiple={true} onChange={handleChange} />

            <div className="flex flex-row overflow-y-auto">
                {selectedFiles.map((file: SelectedFile, index: number) => {
                    const status = uploadStatuses[index];
                    return (
                        <div key={index} className='flex-shrink-0'>
                            <img className='w-96 max-h-[50vh] h-auto' src={URL.createObjectURL(file)} alt={file.name} />
                            <p>{status}</p>
                            {status === 'finished' && <input type="text" name="new_attachment" defaultValue={file.key} hidden />}
                        </div>
                    );
                })}
            </div>
            <button className="m-auto p-4" type="submit" disabled={disabled} >{disabled ? "Waiting for upload before we" : "" } Save {!params.note ? "New " : ""} Note</button>
        </div>
    );
}
