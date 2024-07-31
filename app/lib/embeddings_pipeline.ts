/**
 * Stolen straight out of the docs: https://huggingface.co/docs/transformers.js/tutorials/next#step-2-install-and-configure-transformersjs
 * 
 * This singleton allow us to avoid creating this pipeline instance every request, which ends up taking about 2 seconds on production...
 */

import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers";

// Use the Singleton pattern to enable lazy construction of the pipeline.
// NOTE: We wrap the class in a function to prevent code duplication (see below).
export default class PipelineSingletonClass {
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance: Promise<FeatureExtractionPipeline> | null = null;

    static async getInstance(progress_callback = undefined) {
        if (this.instance === null) {
            this.instance = pipeline('embeddings', this.model, { progress_callback });
        }
        return this.instance;
    }
}