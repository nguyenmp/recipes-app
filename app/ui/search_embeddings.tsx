"use client";

import { ChangeEvent, useState } from "react";
import { pipeline } from '@xenova/transformers';
import { EmbeddingMatch, getRelatedWords } from "../lib/data";
import { getRelatedWordsFromEmbedding } from "../lib/actions";


export function SearchEmbeddings() {
    const [embedding, setEmbedding] = useState<number[] | null>(null);
    const [query, setQuery] = useState<string>('');
    const [relatedWords, setRelatedWords] = useState<EmbeddingMatch[]>([]);

    async function handleOnChange(event: ChangeEvent<HTMLInputElement>) {
        const classifier = await pipeline('embeddings');
        console.log(event.target.value);
        setQuery(event.target.value);

        const output = await classifier(event.target.value, {pooling: 'mean', normalize: true});
        const embeddingResult = output.tolist()[0];
        setEmbedding(embeddingResult);

        // Note: Don't use embedding here, it hasn't propogated to this component yet,
        // use the local variable or else you'll always be one step behind
        if (embeddingResult == null) return;
        const related_words = await getRelatedWordsFromEmbedding(embeddingResult);
        setRelatedWords(related_words);
    }

    return <div>
        <input type="text" placeholder="Search embeddings" onChange={handleOnChange} defaultValue={query}/>
        {query}
        <p>{JSON.stringify(embedding)}</p>
        <div>
            <table className="w-full">
                <caption>Embedding Matches</caption>
                <thead>
                    <tr>
                        <th scope="col">Word</th>
                        <th scope="col">Distance</th>
                    </tr>
                </thead>
                <tbody>
                    {
                        relatedWords.map(
                            (relatedWord) => {
                                return (<tr key={relatedWord.word}>
                                    <th scope="row">{relatedWord.word}</th>
                                    <td>{relatedWord.distance}</td>
                                </tr>);
                            }
                        )
                    }
                </tbody>
            </table>
        </div>
    </div>;
}