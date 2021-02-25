# big-geojson-featurecollection-reader
_node.js program to read features from a featurecollection from a big geojson file_

_has no dependencies_

## Wokflow

1. Read json file into an array of buffer chunks.
(Can't read whole file into one buffer, because it is limited to 2GB on 64bit machines.)
2. Searches in big buffer for object/array start and ends `('{', '}', '[', ']')` and feature locations (`'Feature"'`).
3. Uses the gathered indices to find start and end indices of features in big buffer.
4. With all the start and end indices of features, parses them sequentially.
5. If the byte count of a feature exceeds a certain threshold, the coordinates array of that feature is  parsed separately, iteratively.

## Usage

* See [index.js](./index.js) and [test.js](./test.js) for usage.

* I was able to read the features of [this](https://mega.nz/file/GlQgAJIC#r1J-Sm8wnHOiTx43E-Q-8AOA7c2PCBBqFz054GnuPsQ) really big FeatureCollection (6,2 GB).

  I set `--max-old-space-size=32768` (and it took about 10 minutes to process the whole file).

* For testing you can also use [this](https://mega.nz/file/SlIACDYa#GUqHplWkxVlWN8UVBcY_wbBx464cLWyfuX9GQpTuqyU) FeatureCollection (2 GB).

  I set `--max-old-space-size=16384` (and it took about 2 minutes to process the whole file on my computer).