#include "dsa_engine.hpp"
#include <cmath>
#include <sstream>
#include <algorithm>

// --- Helper Functions ---
std::string cleanWord(const std::string& word) {
    std::string cleaned;
    for (char c : word) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            cleaned += std::tolower(static_cast<unsigned char>(c));
        }
    }
    return cleaned;
}

std::vector<std::string> tokenize(const std::string& text) {
    std::vector<std::string> tokens;
    std::stringstream ss(text);
    std::string word;
    while (ss >> word) {
        std::string cleaned = cleanWord(word);
        if (!cleaned.empty()) {
            tokens.push_back(cleaned);
        }
    }
    return tokens;
}

// --- Trie Implementation ---
Trie::Trie() {
    root = std::make_shared<TrieNode>();
}

void Trie::insert(const std::string& word) {
    auto current = root;
    for (char c : word) {
        if (current->children.find(c) == current->children.end()) {
            current->children[c] = std::make_shared<TrieNode>();
        }
        current = current->children[c];
    }
    current->isEndOfWord = true;
}

bool Trie::search(const std::string& word) const {
    auto current = root;
    for (char c : word) {
        if (current->children.find(c) == current->children.end()) {
            return false;
        }
        current = current->children[c];
    }
    return current->isEndOfWord;
}

void Trie::collectWords(const std::shared_ptr<TrieNode>& node, std::string currentPrefix, std::vector<std::string>& results) const {
    if (!node) return;
    if (node->isEndOfWord) {
        results.push_back(currentPrefix);
    }
    
    // Sort keys alphabetically so autocomplete suggestions are returned in alphabetical order
    std::vector<char> keys;
    for (const auto& pair : node->children) {
        keys.push_back(pair.first);
    }
    std::sort(keys.begin(), keys.end());

    for (char c : keys) {
        collectWords(node->children.at(c), currentPrefix + c, results);
    }
}

std::vector<std::string> Trie::getWordsWithPrefix(const std::string& prefix) const {
    std::vector<std::string> results;
    auto current = root;
    for (char c : prefix) {
        if (current->children.find(c) == current->children.end()) {
            return results; // No words match this prefix
        }
        current = current->children[c];
    }
    collectWords(current, prefix, results);
    return results;
}

std::vector<std::string> Trie::getVocabulary() const {
    return getWordsWithPrefix("");
}

// --- Inverted Index Implementation ---
void InvertedIndex::addDocument(int docId, const std::string& content) {
    std::vector<std::string> tokens = tokenize(content);
    docLengths[docId] = tokens.size();

    // Count term frequencies within this document
    std::unordered_map<std::string, int> termCounts;
    for (const auto& token : tokens) {
        termCounts[token]++;
        vocabularyTrie.insert(token);
    }

    // Insert into Inverted Index
    for (const auto& pair : termCounts) {
        const std::string& term = pair.first;
        int freq = pair.second;
        
        index[term].push_back(Posting{docId, freq});
    }
}

std::vector<Posting> InvertedIndex::searchWord(const std::string& word) const {
    std::string cleaned = cleanWord(word);
    auto it = index.find(cleaned);
    if (it != index.end()) {
        return it->second;
    }
    return {};
}

std::vector<int> InvertedIndex::searchAnd(const std::vector<std::string>& words) const {
    if (words.empty()) return {};

    std::vector<std::vector<int>> docLists;
    for (const auto& w : words) {
        std::string cleaned = cleanWord(w);
        auto it = index.find(cleaned);
        if (it == index.end()) {
            // One of the query terms has no documents, so intersection must be empty
            return {};
        }
        
        std::vector<int> docs;
        for (const auto& posting : it->second) {
            docs.push_back(posting.docId);
        }
        docLists.push_back(docs);
    }

    // Sort document lists by size (ascending) to optimize intersection
    std::sort(docLists.begin(), docLists.end(), [](const std::vector<int>& a, const std::vector<int>& b) {
        return a.size() < b.size();
    });

    std::vector<int> result = docLists[0];
    for (size_t i = 1; i < docLists.size(); ++i) {
        std::vector<int> temp;
        const auto& currentList = docLists[i];
        size_t p1 = 0, p2 = 0;
        
        while (p1 < result.size() && p2 < currentList.size()) {
            if (result[p1] == currentList[p2]) {
                temp.push_back(result[p1]);
                p1++;
                p2++;
            } else if (result[p1] < currentList[p2]) {
                p1++;
            } else {
                p2++;
            }
        }
        result = std::move(temp);
        if (result.empty()) break;
    }

    return result;
}

std::vector<int> InvertedIndex::searchOr(const std::vector<std::string>& words) const {
    std::unordered_set<int> uniqueDocs;
    for (const auto& w : words) {
        std::string cleaned = cleanWord(w);
        auto it = index.find(cleaned);
        if (it != index.end()) {
            for (const auto& posting : it->second) {
                uniqueDocs.insert(posting.docId);
            }
        }
    }

    std::vector<int> result(uniqueDocs.begin(), uniqueDocs.end());
    std::sort(result.begin(), result.end());
    return result;
}

// --- Spell Corrector Implementation ---
int SpellCorrector::levenshteinDistance(const std::string& s1, const std::string& s2) {
    size_t m = s1.length();
    size_t n = s2.length();
    
    std::vector<std::vector<int>> dp(m + 1, std::vector<int>(n + 1));

    for (size_t i = 0; i <= m; ++i) dp[i][0] = i;
    for (size_t j = 0; j <= n; ++j) dp[0][j] = j;

    for (size_t i = 1; i <= m; ++i) {
        for (size_t j = 1; j <= n; ++j) {
            if (s1[i - 1] == s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + std::min({
                    dp[i - 1][j],    // Deletion
                    dp[i][j - 1],    // Insertion
                    dp[i - 1][j - 1] // Substitution
                });
            }
        }
    }
    return dp[m][n];
}

std::vector<std::string> SpellCorrector::getSuggestions(const std::string& word, const std::vector<std::string>& vocabulary, int maxDistance) {
    std::string cleaned = cleanWord(word);
    if (cleaned.empty()) return {};

    std::vector<std::pair<std::string, int>> candidates;

    for (const auto& vocabWord : vocabulary) {
        // Quick length check optimization: if length difference is greater than maxDistance, 
        // edit distance is guaranteed to be greater than maxDistance.
        if (std::abs(static_cast<int>(cleaned.length()) - static_cast<int>(vocabWord.length())) > maxDistance) {
            continue;
        }

        int dist = levenshteinDistance(cleaned, vocabWord);
        if (dist <= maxDistance) {
            candidates.push_back({vocabWord, dist});
        }
    }

    // Sort suggestions by distance (ascending)
    std::sort(candidates.begin(), candidates.end(), [](const std::pair<std::string, int>& a, const std::pair<std::string, int>& b) {
        if (a.second != b.second) {
            return a.second < b.second; // lower edit distance first
        }
        return a.first < b.first; // alphabetical second
    });

    std::vector<std::string> suggestions;
    for (const auto& cand : candidates) {
        suggestions.push_back(cand.first);
    }
    return suggestions;
}

// --- TF-IDF Ranking Implementation ---
std::vector<SearchResult> TFIDF::rankDocuments(
    const std::vector<std::string>& queryWords,
    const std::vector<int>& matchingDocIds,
    const InvertedIndex& invertedIndex,
    int totalDocuments
) {
    std::vector<SearchResult> results;
    if (matchingDocIds.empty() || queryWords.empty() || totalDocuments == 0) return results;

    const auto& rawIndex = invertedIndex.getRawIndex();
    const auto& docLengths = invertedIndex.getDocLengths();

    // 1. Calculate IDF for each query word
    std::unordered_map<std::string, double> idfs;
    for (const auto& w : queryWords) {
        std::string cleaned = cleanWord(w);
        auto it = rawIndex.find(cleaned);
        
        int docsWithWord = 0;
        if (it != rawIndex.end()) {
            docsWithWord = it->second.size();
        }

        if (docsWithWord > 0) {
            // IDF = ln(1 + Total Documents / Documents containing word)
            idfs[cleaned] = std::log(1.0 + (static_cast<double>(totalDocuments) / docsWithWord));
        } else {
            idfs[cleaned] = 0.0;
        }
    }

    // 2. Score each matching document
    for (int docId : matchingDocIds) {
        double score = 0.0;
        std::unordered_map<std::string, double> tfIdfBreakdown;
        
        auto lengthIt = docLengths.find(docId);
        int totalWordsInDoc = (lengthIt != docLengths.end()) ? lengthIt->second : 1;

        for (const auto& w : queryWords) {
            std::string cleaned = cleanWord(w);
            auto indexIt = rawIndex.find(cleaned);
            if (indexIt == rawIndex.end()) continue;

            // Find term frequency in this specific document
            int termCountInDoc = 0;
            for (const auto& posting : indexIt->second) {
                if (posting.docId == docId) {
                    termCountInDoc = posting.termFrequency;
                    break;
                }
            }

            if (termCountInDoc > 0) {
                double tf = static_cast<double>(termCountInDoc) / totalWordsInDoc;
                double idf = idfs[cleaned];
                double tfidfVal = tf * idf;

                score += tfidfVal;
                tfIdfBreakdown[cleaned] = tfidfVal;
            } else {
                tfIdfBreakdown[cleaned] = 0.0;
            }
        }

        results.push_back(SearchResult{docId, score, tfIdfBreakdown});
    }

    // 3. Sort documents by score descending
    std::sort(results.begin(), results.end(), [](const SearchResult& a, const SearchResult& b) {
        return a.score > b.score;
    });

    return results;
}

// --- LRU Cache Implementation ---

LRUCache::LRUCache(int cap) : capacity(cap), size(0) {
    // Create dummy head and tail sentinel nodes
    // Real nodes are inserted between them
    // head <-> [most recent] <-> ... <-> [least recent] <-> tail
    head = new LRUNode();
    tail = new LRUNode();
    head->next = tail;
    tail->prev = head;
}

LRUCache::~LRUCache() {
    clear();
    delete head;
    delete tail;
}

void LRUCache::removeNode(LRUNode* node) {
    // Detach node from its current position in the doubly linked list
    // Before: A <-> node <-> B
    // After:  A <-> B
    node->prev->next = node->next;
    node->next->prev = node->prev;
}

void LRUCache::insertAtFront(LRUNode* node) {
    // Insert node right after the dummy head
    // Before: head <-> oldFirst <-> ...
    // After:  head <-> node <-> oldFirst <-> ...
    node->next = head->next;
    node->prev = head;
    head->next->prev = node;
    head->next = node;
}

void LRUCache::moveToFront(LRUNode* node) {
    // Step 1: Remove from current position
    removeNode(node);
    // Step 2: Insert at front (most recently used)
    insertAtFront(node);
}

void LRUCache::evictLRU() {
    // The least recently used node is right before the dummy tail
    LRUNode* lruNode = tail->prev;
    if (lruNode == head) return; // Cache is empty, nothing to evict

    // Remove from linked list
    removeNode(lruNode);
    // Remove from hash map
    hashMap.erase(lruNode->key);
    // Free memory
    delete lruNode;
    size--;
}

std::string LRUCache::get(const std::string& key) {
    auto it = hashMap.find(key);
    if (it == hashMap.end()) {
        // Cache MISS — key not found
        return "";
    }
    
    // Cache HIT — promote to most recently used
    LRUNode* node = it->second;
    moveToFront(node);
    return node->value;
}

void LRUCache::put(const std::string& key, const std::string& value) {
    auto it = hashMap.find(key);
    
    if (it != hashMap.end()) {
        // Key already exists — update value and promote to front
        LRUNode* existingNode = it->second;
        existingNode->value = value;
        moveToFront(existingNode);
    } else {
        // New key — check if we need to evict
        if (size >= capacity) {
            evictLRU();
        }
        
        // Create new node and insert at front
        LRUNode* newNode = new LRUNode(key, value);
        insertAtFront(newNode);
        hashMap[key] = newNode;
        size++;
    }
}

void LRUCache::clear() {
    // Walk the linked list and delete all real nodes
    LRUNode* current = head->next;
    while (current != tail) {
        LRUNode* nextNode = current->next;
        delete current;
        current = nextNode;
    }
    // Reset list to empty: head <-> tail
    head->next = tail;
    tail->prev = head;
    hashMap.clear();
    size = 0;
}

std::vector<std::string> LRUCache::getKeysInOrder() const {
    // Walk from head->next (most recent) to tail (least recent)
    std::vector<std::string> keys;
    LRUNode* current = head->next;
    while (current != tail) {
        keys.push_back(current->key);
        current = current->next;
    }
    return keys;
}
