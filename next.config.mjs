/**
 * Specifically fix the build process to support transformers.js (for ML/NLP)
 *
 * Module parse failed: Unexpected character (1:0) #440 - https://github.com/xenova/transformers.js/issues/440
 *
 * TypeError: Cannot read properties of undefined (reading 'create') #741 - https://github.com/xenova/transformers.js/issues/741
 */

/** @type {import('next').NextConfig} */
const nextConfig = {

    // Override the default webpack configuration
    serverExternalPackages: [
        "sharp",
        "onnxruntime-node",
    ],

    // Override the default webpack configuration
    webpack: (config) => {
        // See https://webpack.js.org/configuration/resolve/#resolvealias
        config.resolve.alias = {
            ...config.resolve.alias,
            "sharp": false,
            "onnxruntime-node": false,
        }
        return config;
    },
};

export default nextConfig;
