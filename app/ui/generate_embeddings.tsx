"use client";

/**
 * Hack alert!
 *
 * Note, this file is all client because we can only load transformers.js
 * client side for some reason.  This file allows us to generate all the
 * embeddings for the words in our DB.
 *
 * Ideally, this work would be done server-side.  No big deal for now though...
 */

import { pipeline, env, TextClassificationOutput } from '@xenova/transformers';
import { ChangeEvent, useState } from 'react';
import { getWordsNeedingEmbeddings, putWordEmbeddings } from '../lib/actions';
import { StoredWordEmbedding } from '../lib/data';


export function GenerateEmbeddings() {
    const [value, setValue] = useState<string>('');
    const [embeddings, setEmbeddings] = useState<StoredWordEmbedding[]>([]);

    async function generateNewEmbeddings(wordsAndEmbeddings: StoredWordEmbedding[]) {
        console.log('Creating pipeline');
        let classifier = await pipeline('embeddings');
        const wordStructWithoutEmbeddings = wordsAndEmbeddings.filter((item) => item.embedding === null);
        if (wordStructWithoutEmbeddings.length === 0) {
            console.log('No word that need embeddings generated found')
            return;
        }

        console.log('Generating embeddings');
        const output = await classifier(wordStructWithoutEmbeddings.map((item) => item.word), {pooling: 'mean', normalize: true});
        wordStructWithoutEmbeddings.forEach((wordStruct, index) => {
            wordStruct.embedding = output.tolist()[index];
        });

        console.log("output generated")
        // console.log(output)
        setEmbeddings([...wordsAndEmbeddings]);

        console.log('Saving...')
        await putWordEmbeddings(wordsAndEmbeddings);
        console.log('saved');

        await handleOnClick()
    }

    async function handleOnClick() {
        console.log('Fetching words');
        const wordsAndEmbeddings = await getWordsNeedingEmbeddings();
        setEmbeddings(wordsAndEmbeddings);
        await generateNewEmbeddings(wordsAndEmbeddings)
    }

    async function handleOnChange(event: ChangeEvent<HTMLInputElement>) {
        setValue(event.target.value);
    }

    return (
        <div>
            <button onClick={handleOnClick}>Load Words and Embeddings</button>
            <div>
                <table>
                    <caption>Words that need embeddings generated, open console for logs</caption>
                    <thead>
                        <tr>
                            <th scope="col">Word</th>
                            <th scope="col">Embedding</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            embeddings.map(
                                (embedding) => {
                                    // console.log(embedding.embedding);
                                    return (<tr key={embedding.word}>
                                        <th scope="row">{embedding.word}</th>
                                        <td>{embedding.embedding ? '[' + embedding.embedding.join(', ').substring(0, 100) + '...' + ']' : ''}</td>
                                    </tr>);
                                }
                            )
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
}
