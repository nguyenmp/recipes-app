https://poloclub.github.io/wizmap seems cool.

I have to run their code though to generate the raw data to upload:
https://github.com/poloclub/wizmap/blob/main/example/imdb.ipynb

Basically:
1. Dump embeddings to CSV
2. Load it in python
3. UMAP instead of PCA + t-SNE for dimensionality reduction
4. Export data list and grid dict
5. Import into demo web-app
