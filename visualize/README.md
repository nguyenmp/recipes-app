https://poloclub.github.io/wizmap seems cool.

I have to run their code though to generate the raw data to upload:
https://github.com/poloclub/wizmap/blob/main/example/imdb.ipynb

Basically:
1. Dump embeddings to JSON (via DBeaver)
2. Load it in python
3. UMAP instead of PCA + t-SNE for dimensionality reduction
4. Export data list and grid dict
5. Import into demo web-app

Only mod I needed:
```
python3 -m pip install --upgrade wizmap umap-learn matplotlib pandas

import json
file_handle = open('recipes_202411190923.json', 'rt')
data = json.load(file_handle)
recipe_names = list(map(lambda recipe: recipe['name'], data['recipes']))
recipe_embeddings = list(map(lambda recipe: json.loads(recipe['embedding']), data['recipes']))
```