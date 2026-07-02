# 🔍 Mini Search Engine

A high-performance **C++ Search Engine** built from scratch for efficient document retrieval over a large-scale Wikipedia corpus. The project uses classic Information Retrieval techniques including **Inverted Index**, **Trie**, **TF-IDF Ranking**, **Spell Correction**, **Multi-word Search**, and **LRU Cache** to provide fast and relevant search results.

---

## ✨ Features

- 📄 Automatic Wikipedia dataset conversion into searchable documents
- 🔎 Single-word and Multi-word Search
- 📊 TF-IDF based document ranking
- 🌳 Trie-based autocomplete and prefix search
- ✍️ Spell Correction (Edit Distance ≤ 2)
- 💡 Query Recommendations
- ⚡ LRU Cache for frequently searched queries
- 📁 Automatic indexing of thousands of documents
- 🚀 Average Query Time: **1–2 ms**
- ⏱ Index Construction Time: **~7 seconds**

---

## 🏗 Project Architecture

```
Wikipedia Dataset
        │
        ▼
Dataset Converter
        │
        ▼
Documents Folder
        │
        ▼
Tokenizer
        │
        ▼
Inverted Index + Trie
        │
        ▼
TF-IDF Ranking
        │
        ▼
Search Engine
        │
        ▼
React Frontend
```

---

## 🧠 Data Structures Used

- Inverted Index
- Trie
- Hash Map
- Vector
- Queue
- LRU Cache
- Filesystem

---

## ⚙ Algorithms Used

- TF-IDF Ranking
- Edit Distance (Levenshtein Distance)
- Boolean Search
- Multi-word Search
- Prefix Search
- Tokenization

---

## 🛠 Tech Stack

- **Language:** C++17
- **Frontend:** React + Vite
- **Libraries:** STL, Filesystem
- **Dataset:** Simple English Wikipedia

---

## 📂 Project Structure

```
MiniSearchEngine/
│
├── backend/
│   ├── engine.cpp
│   ├── engine.hpp
│   └── ...
│
├── documents/
│   └── Generated Wikipedia Articles
│   └── ...
|
├── frontend/
│   └── React Application
│   └── package.json
|   └── postcss.config.js
|   └── tailwind.config.js
|   └── vite.config.js
|
└── README.md
```

---

## 🚀 Performance

| Metric | Value |
|--------|-------|
| Indexed Documents | 1,000+ |
| Index Build Time | ~7 s |
| Average Search Time | 1–2 ms |
| Spell Suggestion Time | ~100 ms |
| Ranking Algorithm | TF-IDF |
| Spell Correction | Edit Distance ≤ 2 |

---

## 📸 Screenshots

<h2 align="center">Home Page</h2>

<p align="center">
  <img src="assets/home_page.png" width="900">
</p>
---

<h2 align="center">Search Results</h2>

<p align="center">
  <img src="assets/search_results.png" width="900">
</p>

---

<h2 align="center">Spell Correction</h2>

<p align="center">
  <img src="assets/spell_correction.png" width="900">
</p>

---

## 💻 Getting Started

### Clone Repository

```bash
git clone https://github.com/KrIsH-1206/Mini-Search-Engine.git
cd Mini-Search-Engine
```

### Backend

```bash
mkdir build
cd build
cmake ..
make
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🎯 Future Improvements

- BM25 Ranking
- Persistent Index Storage
- Fuzzy Search
- Search Analytics
- Parallel Index Construction
- Advanced Query Parsing

---

## 👨‍💻 Author

**Krish Vamja**
