# Search Engine IR

![C++](https://img.shields.io/badge/c++-%2300599C.svg?style=for-the-badge&logo=c%2B%2B&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![CMake](https://img.shields.io/badge/CMake-%23008FBA.svg?style=for-the-badge&logo=cmake&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)

A C++ search engine built from scratch using classical Information Retrieval techniques for fast document retrieval over a Simple English Wikipedia corpus.

## Overview

The system follows a two-stage indexing and query-processing pipeline:

```text
Simple English Wikipedia Corpus
              │
              ▼
     Tokenization & Normalization
              │
      ┌───────┴────────┐
      ▼                ▼
Inverted Index        Trie
      │                │
      │         Prefix Autocomplete
      ▼
   BM25 Ranking
      │
      ▼
  Search API  ◄──── LRU Cache
      │
      ▼
 React / Vite Frontend
```

The indexing phase tokenizes documents, builds posting lists, stores vocabulary terms in a Trie, and computes document statistics required for BM25 ranking.

At query time, the engine normalizes the query, checks the cache, retrieves candidate documents from the inverted index, applies Boolean filtering when requested, ranks results with BM25, and returns them through the REST API.

## Core Concepts

### Inverted Index

Instead of scanning every document for each query, the engine builds an inverted index that maps each term to the documents containing it.

```text
computer → [(doc12, 3), (doc41, 1), (doc87, 2)]
network  → [(doc12, 1), (doc33, 4)]
```

Each posting stores a document ID and the term frequency within that document. A hash-based index provides average O(1) lookup of a term's posting list.

This allows the engine to retrieve candidate documents without performing a full corpus scan for every query.

### BM25 Ranking

The engine ranks matching documents using the BM25 probabilistic ranking function. BM25 balances term frequency, inverse document frequency, and document length normalization.

For a query `q` and document `d`:

$$
Score(q,d) = \sum_{t \in q}
IDF(t)
\cdot
\frac{TF(t,d)(k_1+1)}
{TF(t,d)+k_1\left(1-b+b\frac{DL(d)}{AvgDL}\right)}
$$

where:

- **TF(t,d)** — frequency of term `t` in document `d`
- **IDF(t)** — inverse document frequency of term `t`
- **DL(d)** — length of document `d`
- **AvgDL** — average document length across the corpus
- **k₁** — controls term-frequency saturation
- **b** — controls document-length normalization

The implementation uses:

```text
k1 = 1.5
b  = 0.75
```

The BM25 IDF component is:

$$
IDF(t) =
\log\left(
1+\frac{N-DF(t)+0.5}{DF(t)+0.5}
\right)
$$

where `N` is the total number of documents and `DF(t)` is the number of documents containing term `t`.

### Trie-based Autocomplete

A Trie stores the corpus vocabulary and supports prefix-based autocomplete.

For example:

```text
ca
├── cat
├── car
└── camera
```

The engine first traverses the Trie to locate the requested prefix and then collects vocabulary terms below that node.

### Spell Correction

Misspelled queries are handled using Levenshtein edit distance, which measures the minimum number of insertions, deletions, and substitutions required to transform one word into another.

For example:

```text
recieve → receive
```

Candidates are filtered by word-length difference before edit distance is computed, reducing unnecessary comparisons.

### Boolean Search

The engine supports multi-word `AND` and `OR` queries.

For `AND`, matching posting lists are intersected:

```text
A ∩ B
```

The implementation sorts posting lists by size and uses two-pointer traversal for intersection.

For `OR`, matching document IDs are combined:

```text
A ∪ B
```

### LRU Cache

Frequently repeated queries are stored in a thread-safe LRU cache.

The cache combines:

- a hash map for average O(1) lookup
- a doubly linked list for O(1) recency updates and eviction

When the cache reaches capacity, the least recently used query is removed.

## Query Processing

A typical query flows through the system as follows:

```text
"space nasa"
      │
      ▼
Tokenization / Normalization
      │
      ▼
Posting-list lookup
      │
      ▼
Boolean filtering
      │
      ▼
BM25 scoring
      │
      ▼
Ranked results
```

Repeated queries can be served directly from the LRU cache.

## Data Structures & Algorithms

| Component          | Technique                         |
| ------------------ | --------------------------------- |
| Document Retrieval | Hash-based Inverted Index         |
| Ranking            | BM25                              |
| Autocomplete       | Trie                              |
| Spell Correction   | Levenshtein Edit Distance         |
| Boolean Search     | Posting-list Intersection / Union |
| Query Caching      | Hash Map + Doubly Linked List     |

## Complexity

- **Inverted-index term lookup:** average O(1)
- **AND search:** posting-list intersection using two-pointer traversal
- **OR search:** posting-list union using hash-based document collection
- **Trie prefix lookup:** O(p) to locate a prefix of length `p`, plus traversal of matching terms
- **Levenshtein distance:** O(mn) for words of lengths `m` and `n`
- **LRU cache lookup/update:** average O(1)

## Performance

| Metric                   |   Measurement |
| ------------------------ | ------------: |
| Average Query Latency    |        1–2 ms |
| Index Construction       |          ~7 s |
| Spell Suggestion Latency |       ~100 ms |
| Corpus Size              | ~1k documents |

Measurements are based on the included Simple English Wikipedia corpus and a Release build.

## Design Decisions

### Why an Inverted Index?

A forward index would require scanning documents for every query. Mapping terms directly to posting lists makes candidate retrieval substantially more efficient.

### Why BM25?

Simple keyword matching treats all matches equally. BM25 accounts for term rarity, term frequency, and document length, producing more meaningful relevance rankings.

### Why an LRU Cache?

Search workloads often contain repeated queries. Caching recent results avoids repeating indexing, filtering, and ranking work for frequently requested queries.

## Tech Stack

- **Backend:** C++17, `cpp-httplib`, `nlohmann/json`
- **Frontend:** React, Vite, Tailwind CSS
- **Build:** CMake
- **Dataset:** Simple English Wikipedia

## Getting Started

### Prerequisites

- C++17 compiler (GCC / Clang)
- CMake 3.15+
- Node.js 18+ and npm

### Build Backend

```bash
git clone https://github.com/vedant-asati/Search-Engine-IR.git
cd Search-Engine-IR

mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
./search_engine_ir
```

The backend starts on `http://localhost:8080`.

### Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Screenshots

### Search

<img src="assets/home_page.png" width="800" alt="Search interface">

<br><br>

<img src="assets/search_results.png" width="800" alt="Search results">

### Autocomplete & Spell Correction

<img src="assets/spell_correction.png" width="800" alt="Autocomplete and spell correction">

## License

This project is available under the MIT License.
