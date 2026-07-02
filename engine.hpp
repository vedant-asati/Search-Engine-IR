#ifndef DSA_ENGINE_HPP
#define DSA_ENGINE_HPP

#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <memory>
#include <algorithm>

// --- Helper Functions ---
std::string cleanWord(const std::string& word);
std::vector<std::string> tokenize(const std::string& text);

// --- Posting Struct ---
struct Posting {
    int docId;
    int termFrequency;
};

// --- Trie Data Structure for Autocomplete ---
struct TrieNode {
    std::unordered_map<char, std::shared_ptr<TrieNode>> children;
    bool isEndOfWord = false;
};

class Trie {
private:
    std::shared_ptr<TrieNode> root;
    void collectWords(const std::shared_ptr<TrieNode>& node, std::string currentPrefix, std::vector<std::string>& results) const;

public:
    Trie();
    void insert(const std::string& word);
    bool search(const std::string& word) const;
    std::vector<std::string> getWordsWithPrefix(const std::string& prefix) const;
    std::vector<std::string> getVocabulary() const;
};

// --- Inverted Index for Retrieval ---
class InvertedIndex {
private:
    std::unordered_map<std::string, std::vector<Posting>> index;
    std::unordered_map<int, int> docLengths; // docId -> total word count
    Trie vocabularyTrie;

public:
    void addDocument(int docId, const std::string& content);
    std::vector<Posting> searchWord(const std::string& word) const;
    std::vector<int> searchAnd(const std::vector<std::string>& words) const;
    std::vector<int> searchOr(const std::vector<std::string>& words) const;
    
    const std::unordered_map<std::string, std::vector<Posting>>& getRawIndex() const { return index; }
    const std::unordered_map<int, int>& getDocLengths() const { return docLengths; }
    const Trie& getVocabularyTrie() const { return vocabularyTrie; }
};

// --- Spell Corrector ---
class SpellCorrector {
public:
    static int levenshteinDistance(const std::string& s1, const std::string& s2);
    static std::vector<std::string> getSuggestions(const std::string& word, const std::vector<std::string>& vocabulary, int maxDistance = 2);
};

// --- TF-IDF Ranking ---
struct SearchResult {
    int docId;
    double score;
    std::unordered_map<std::string, double> tfIdfBreakdown; // word -> term tf-idf contribution
};

class TFIDF {
public:
    static std::vector<SearchResult> rankDocuments(
        const std::vector<std::string>& queryWords,
        const std::vector<int>& matchingDocIds,
        const InvertedIndex& invertedIndex,
        int totalDocuments
    );
};

// --- LRU Cache (Doubly Linked List + HashMap) ---
// Caches search results so repeated queries return instantly in O(1).
// When the cache is full, the Least Recently Used entry is evicted.

struct LRUNode {
    std::string key;                // cache key = "query|mode"
    std::string value;              // cached JSON response string
    LRUNode* prev = nullptr;
    LRUNode* next = nullptr;
    
    LRUNode() : key(""), value("") {}
    LRUNode(const std::string& k, const std::string& v) : key(k), value(v) {}
};

class LRUCache {
private:
    int capacity;
    int size;
    LRUNode* head;  // Dummy head (most recently used side)
    LRUNode* tail;  // Dummy tail (least recently used side)
    std::unordered_map<std::string, LRUNode*> hashMap;

    // Move an existing node to the front (right after head)
    void moveToFront(LRUNode* node);
    
    // Remove a node from the linked list (does NOT delete it)
    void removeNode(LRUNode* node);
    
    // Insert a node right after the dummy head
    void insertAtFront(LRUNode* node);
    
    // Remove and delete the least recently used node (right before tail)
    void evictLRU();

public:
    LRUCache(int cap = 10);
    ~LRUCache();

    // Returns the cached value if found (cache HIT), or empty string (cache MISS).
    // On a HIT, the accessed entry is promoted to most-recently-used.
    std::string get(const std::string& key);

    // Inserts or updates a key-value pair.
    // If cache is full, the least recently used entry is evicted first.
    void put(const std::string& key, const std::string& value);

    // Clears the entire cache (called when a new document is added, invalidating results)
    void clear();

    // Returns current cache size
    int getSize() const { return size; }
    
    // Returns cache capacity
    int getCapacity() const { return capacity; }

    // Returns list of cached keys in order from most recent to least recent
    std::vector<std::string> getKeysInOrder() const;
};

#endif // DSA_ENGINE_HPP
