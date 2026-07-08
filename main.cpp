#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <mutex>
#include <filesystem>
#include <fstream>

#include <chrono>

// Dependencies downloaded by CMake
#include "httplib.h"
#include "nlohmann/json.hpp"

// Our custom DSA Engine
#include "engine.hpp"

using json = nlohmann::json;

// Thread-safety locks for our database and index
std::mutex db_mutex;

struct DocumentData {
    int id;
    std::string title;
    std::string content;
};

// Global Database
std::vector<DocumentData> documents;
InvertedIndex searchIndex;
int nextDocId = 1;

// LRU Cache for search results (capacity: 10 most recent queries)
LRUCache searchCache(10);

void addDocToEngine(const std::string& title, const std::string& content) {
    std::lock_guard<std::mutex> lock(db_mutex);
    int docId = nextDocId++;
    documents.push_back({docId, title, content});
    
    // Index both title and content to make it richer
    std::string fullText = title + " " + content;
    searchIndex.addDocument(docId, fullText);
}

// Populate sample corpus
void initializeSampleCorpus() {
    addDocToEngine(
        "Introduction to JavaScript and Web Development",
        "JavaScript is a high-level programming language that is a core technology of the World Wide Web. "
        "It enables interactive web pages and is an essential part of web applications. Modern web browsers "
        "have dedicated JavaScript engines that execute the code on the user device. Node.js allows developer "
        "to run JavaScript code on the server side, building powerful backend APIs."
    );
    addDocToEngine(
        "Space Exploration and Rocket Science",
        "Space exploration is the ongoing discovery and exploration of celestial structures in outer space. "
        "Using rocket propulsion technology, NASA and private companies launch spacecraft to the Moon, Mars, "
        "and outer planets. Physics plays a critical role in calculating orbital trajectories and rocket fuel "
        "thrust required to escape Earth gravity."
    );
    addDocToEngine(
        "A Brief History of Modern Computing",
        "The history of computing started with mechanical calculation machines, evolving into electronic computers. "
        "Alan Turing laid the theoretical foundation for computer science and algorithms. Early computers like "
        "the ENIAC were massive, but transistor technology paved the way for microprocessors. Today, computing "
        "is embedded in software running on personal devices and cloud infrastructure."
    );
    addDocToEngine(
        "Search Engine Optimization and Web Algorithms",
        "Search Engine Optimization or SEO is the process of improving web site traffic quality and volume. "
        "Modern search engines index billions of pages using web crawler bots. They index words using inverted "
        "index data structures and rank pages using complex mathematical ranking algorithms like TF-IDF "
        "and PageRank to deliver relevant information."
    );
    addDocToEngine(
        "The Physics of Black Holes and Quantum Mechanics",
        "Black holes are regions of spacetime where gravity is so strong that nothing, not even light, can escape. "
        "Einstein theory of general relativity describes gravity at astronomical scales, whereas quantum mechanics "
        "describes physics at the atomic subatomic level. Reconciling quantum theory and gravity is one of "
        "the greatest open questions in physics."
    );
    addDocToEngine(
        "The Rise of Artificial Intelligence and Neural Networks",
        "Artificial Intelligence is a computer science field focused on creating systems capable of performing tasks "
        "that require human intelligence. Machine learning models, especially deep artificial neural networks, "
        "learn patterns from massive datasets. AI code compiles statistical weights to generate language, recognize "
        "images, and write code automatically."
    );
    addDocToEngine(
        "Cooking and Baking: Science in the Kitchen",
        "Baking and cooking are delicious practical applications of chemistry and food science. Heating foods "
        "causes chemical reactions, such as the Maillard browning reaction in bread crusts. A good recipe "
        "balances acidic and basic ingredients. Understanding science in the kitchen helps home cooks "
        "create perfect meals every time."
    );
    addDocToEngine(
        "Healthy Living and Physical Fitness Guide",
        "Maintaining a healthy lifestyle involves balanced nutrition, regular exercise, and adequate sleep. "
        "Cardiovascular fitness training strengthens the heart, while strength exercises build muscle and bone density. "
        "Nutritious foods rich in vitamins, proteins, and complex carbohydrates fuel the body and support "
        "overall well-being, preventing chronic diseases."
    );
    addDocToEngine(
        "Exploring the Ancient Monuments of Egypt",
        "Egypt is home to some of the most famous ancient archaeological monuments in human history, including "
        "the Pyramids of Giza and the Sphinx. These structure represent incredible engineering feats built by "
        "ancient civilizations. Exploring historic tombs along the Nile River provides insight into their "
        "culture, writing systems, and beliefs."
    );
    addDocToEngine(
        "Data Structures and Algorithms in C++",
        "Mastering computer science requires understanding data structures and algorithms. C++ is a powerful language "
        "frequently used in competitive coding and systems engineering. Structures like arrays, hash tables, "
        "inverted indices, and tree models (like binary search trees and Tries) store data efficiently. Algorithmic "
        "design determines execution speed and resource management."
    );
}

// Add CORS headers to response
void enableCORS(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

namespace fs = std::filesystem;

void loadDocumentsFromFolder(const std::string& folder)
{
    if (!fs::exists(folder)) {
        std::cout << "Folder not found: " << folder << '\n';
        return;
    }

    for (const auto& entry : fs::directory_iterator(folder))
    {
        if (!entry.is_regular_file())
            continue;

        std::cout << entry.path() << '\n';
        std::ifstream file(entry.path());

        if (!file)
            continue;

        std::stringstream buffer;
        buffer << file.rdbuf();

        addDocToEngine(
            entry.path().filename().string(),
            buffer.str()
        );
    }
}

int main() {

    std::cout << "Initializing Search Engine Database..." << std::endl;
    loadDocumentsFromFolder("../documents");
    std::cout << "Successfully indexed " << documents.size() << " documents." << std::endl;

    httplib::Server svr;

    // CORS preflight requests
    svr.Options(R"(/api/.*)", [](const httplib::Request&, httplib::Response& res) {
        enableCORS(res);
        res.status = 200;
    });

    // Route: List all documents
    svr.Get("/api/documents", [](const httplib::Request&, httplib::Response& res) {
        enableCORS(res);
        json response = json::array();
        
        std::lock_guard<std::mutex> lock(db_mutex);
        for (const auto& doc : documents) {
            response.push_back({
                {"id", doc.id},
                {"title", doc.title},
                {"content", doc.content}
            });
        }
        res.set_content(response.dump(), "application/json");
    });

    // Route: Add a custom document
    svr.Post("/api/documents", [](const httplib::Request& req, httplib::Response& res) {
        enableCORS(res);
        try {
            auto body = json::parse(req.body);
            std::string title = body.value("title", "Untitled Document");
            std::string content = body.value("content", "");
            
            if (content.empty()) {
                res.status = 400;
                res.set_content("{\"error\": \"Document content cannot be empty\"}", "application/json");
                return;
            }

            addDocToEngine(title, content);

            // Invalidate the entire cache since the index has changed
            searchCache.clear();
            std::cout << "[LRU Cache] Cache cleared — new document added." << std::endl;

            res.status = 201;
            res.set_content("{\"status\": \"success\", \"message\": \"Document indexed successfully\"}", "application/json");
        } catch (const std::exception& e) {
            res.status = 400;
            res.set_content(std::string("{\"error\": \"Invalid JSON: ") + e.what() + "\"}", "application/json");
        }
    });

    // Route: Autocomplete
    svr.Get("/api/autocomplete", [](const httplib::Request& req, httplib::Response& res) {
        enableCORS(res);
        std::string query = req.get_param_value("q");

        std::vector<std::string> suggestions;
        if (!query.empty()) {
            std::lock_guard<std::mutex> lock(db_mutex);
            suggestions = searchIndex.getVocabularyTrie().getWordsWithPrefix(cleanWord(query));
        }

        // Limit to top 8 autocomplete suggestions for clean UI
        if (suggestions.size() > 8) {
            suggestions.resize(8);
        }

        json response = suggestions;
        res.set_content(response.dump(), "application/json");
    });

    // Route: Spell Corrector Suggestion
    svr.Get("/api/suggest", [](const httplib::Request& req, httplib::Response& res) {
        enableCORS(res);
        std::string word = req.get_param_value("q");
        if (word.empty()) {
            res.set_content("[]", "application/json");
            return;
        }

        std::vector<std::string> suggestions;
        {
            std::lock_guard<std::mutex> lock(db_mutex);
            std::vector<std::string> vocab = searchIndex.getVocabularyTrie().getVocabulary();
            suggestions = SpellCorrector::getSuggestions(word, vocab, 2);
        }

        // Limit to top 5 spell suggestions
        if (suggestions.size() > 5) {
            suggestions.resize(5);
        }

        json response = suggestions;
        res.set_content(response.dump(), "application/json");
    });

    // Route: Search Engine main search endpoint
    svr.Get("/api/search", [](const httplib::Request& req, httplib::Response& res) {
        enableCORS(res);
        std::string query = req.get_param_value("q");
        std::string mode = req.get_param_value("mode"); // "simple", "and", "or"
        if (mode.empty()) mode = "simple";

        // --- LRU Cache Lookup ---
        std::string cacheKey = query + "|" + mode;
        std::string cachedResult = searchCache.get(cacheKey);
        if (!cachedResult.empty()) {
            std::cout << "[LRU Cache] HIT for key: \"" << cacheKey << "\"" << std::endl;
            // Return cached response directly — O(1) instant!
            // Parse cached JSON, inject cacheHit flag, and return
            json cachedJson = json::parse(cachedResult);
            cachedJson["cacheHit"] = true;
            res.set_content(cachedJson.dump(), "application/json");
            return;
        }
        std::cout << "[LRU Cache] MISS for key: \"" << cacheKey << "\" — computing results..." << std::endl;
        

        std::vector<std::string> queryWords = tokenize(query);
        
        std::vector<int> matchingDocIds;
        {
            std::lock_guard<std::mutex> lock(db_mutex);
            if (mode == "and") {
                matchingDocIds = searchIndex.searchAnd(queryWords);
            } else if (mode == "or" || mode == "simple") {
                matchingDocIds = searchIndex.searchOr(queryWords);
            }
        }

        int totalDocs = 0;
        {
            std::lock_guard<std::mutex> lock(db_mutex);
            totalDocs = documents.size();
        }

        // Rank documents
        std::vector<SearchResult> rankedResults;
        {
            std::lock_guard<std::mutex> lock(db_mutex);
            rankedResults = BM25::rankDocuments(queryWords, matchingDocIds, searchIndex, totalDocs);
        }

        // Limit to top 10 relevant documents
        if (rankedResults.size() > 10) {
            rankedResults.resize(10);
        }

        // Prepare response JSON
        json resultsJson = json::array();
        {
            std::lock_guard<std::mutex> lock(db_mutex);
            for (const auto& rankResult : rankedResults) {
                // Find document info
                const DocumentData* targetDoc = nullptr;
                for (const auto& doc : documents) {
                    if (doc.id == rankResult.docId) {
                        targetDoc = &doc;
                        break;
                    }
                }
                
                if (targetDoc) {
                    // Create a summary snippet: first 150 characters
                    std::string snippet = targetDoc->content;
                    if (snippet.length() > 150) {
                        snippet = snippet.substr(0, 150) + "...";
                    }

                    resultsJson.push_back({
                        {"docId", rankResult.docId},
                        {"title", targetDoc->title},
                        {"snippet", snippet},
                        {"score", rankResult.score},
                        {"breakdown", rankResult.tfIdfBreakdown}
                    });
                }
            }
        }

        // Collect spelling suggestions for words that didn't match anything in our index
        json suggestionsJson = json::object();
        {
            std::lock_guard<std::mutex> lock(db_mutex);
            const auto& vocabTrie = searchIndex.getVocabularyTrie();
            std::vector<std::string> vocab = vocabTrie.getVocabulary();
            
            std::cout << "\n[SpellCheck Debug] === Query: \"" << query << "\" ===" << std::endl;
            std::cout << "[SpellCheck Debug] Vocabulary Trie Size: " << vocab.size() << " unique words." << std::endl;

            for (const auto& rawWord : queryWords) {
                std::string cleaned = cleanWord(rawWord);
                bool foundInTrie = vocabTrie.search(cleaned);
                std::cout << "[SpellCheck Debug] Word: \"" << cleaned << "\" | Found in index: " << (foundInTrie ? "YES" : "NO") << std::endl;
                
                if (!cleaned.empty() && !foundInTrie) {


                    // This word is misspelled or not in index, compute suggestions
                    std::vector<std::string> sugs = SpellCorrector::getSuggestions(cleaned, vocab, 2);
                    std::cout << "[SpellCheck Debug] -> Found " << sugs.size() << " spelling candidates for \"" << cleaned << "\":" << std::endl;
                    for (const auto& sug : sugs) {
                        std::cout << "   - " << sug << std::endl;
                    }
                    
                    if (!sugs.empty()) {
                        suggestionsJson[rawWord] = sugs;
                    }
                }
            }
            std::cout << "[SpellCheck Debug] ================================\n" << std::endl;
        }

        json response;
        response["results"] = resultsJson;
        response["suggestions"] = suggestionsJson;
        response["queryWords"] = queryWords;
        response["mode"] = mode;
        response["cacheHit"] = false;

        // --- Store result in LRU Cache ---
        searchCache.put(cacheKey, response.dump());
        std::cout << "[LRU Cache] Stored result for key: \"" << cacheKey << "\" | Cache size: " << searchCache.getSize() << "/" << searchCache.getCapacity() << std::endl;

        res.set_content(response.dump(), "application/json");
    });

    // Route: Debug state for interactive visualizer
    svr.Get("/api/debug", [](const httplib::Request&, httplib::Response& res) {
        enableCORS(res);
        
        json rawIndexJson = json::object();
        json vocabularyJson = json::array();
        json docLengthsJson = json::object();

        {
            std::lock_guard<std::mutex> lock(db_mutex);
            // Inverted index
            const auto& rawIdx = searchIndex.getRawIndex();
            for (const auto& pair : rawIdx) {
                json postings = json::array();
                for (const auto& posting : pair.second) {
                    postings.push_back({
                        {"docId", posting.docId},
                        {"freq", posting.termFrequency}
                    });
                }
                rawIndexJson[pair.first] = postings;
            }

            // Trie vocabulary
            vocabularyJson = searchIndex.getVocabularyTrie().getVocabulary();

            // Document lengths
            const auto& lengths = searchIndex.getDocLengths();
            for (const auto& pair : lengths) {
                docLengthsJson[std::to_string(pair.first)] = pair.second;
            }
        }

        json response;
        response["invertedIndex"] = rawIndexJson;
        response["vocabulary"] = vocabularyJson;
        response["docLengths"] = docLengthsJson;

        res.set_content(response.dump(), "application/json");
    });

    // Route: LRU Cache state inspection
    svr.Get("/api/cache", [](const httplib::Request&, httplib::Response& res) {
        enableCORS(res);
        
        json response;
        response["size"] = searchCache.getSize();
        response["capacity"] = searchCache.getCapacity();
        response["keys"] = searchCache.getKeysInOrder();
        
        res.set_content(response.dump(), "application/json");
    });

    std::cout << "Starting C++ search engine API server on http://localhost:8080 ..." << std::endl;
    svr.listen("0.0.0.0", 8080);
    return 0;
}
