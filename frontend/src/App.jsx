import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  PlusCircle, 
  Code, 
  FileText, 
  Database, 
  Layers, 
  ArrowRight, 
  ChevronRight, 
  Check, 
  RefreshCw, 
  Info,
  BookOpen
} from 'lucide-react';

export default function App() {
  // Search State
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState('simple'); // 'simple', 'and', 'or'
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState({}); // { word: [sug1, sug2] }
  const [queryWords, setQueryWords] = useState([]);
  
  // Autocomplete State
  const [autocomplete, setAutocomplete] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Custom Document Form
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [docMessage, setDocMessage] = useState({ type: '', text: '' });

  // DSA Debug State
  const [debugData, setDebugData] = useState({ invertedIndex: {}, vocabulary: [], docLengths: {} });
  const [activeTab, setActiveTab] = useState('results'); // 'results', 'index', 'trie', 'tfidf'
  const [searchIndexFilter, setSearchIndexFilter] = useState('');
  const [triePrefixFilter, setTriePrefixFilter] = useState('');
  
  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingDebug, setIsRefreshingDebug] = useState(false);

  const autocompleteRef = useRef(null);

  // Fetch debug data on load and when documents change
  const fetchDebugData = async () => {
    try {
      setIsRefreshingDebug(true);
      const res = await fetch('/api/debug');
      if (res.ok) {
        const data = await res.json();
        setDebugData(data);
      }
    } catch (err) {
      console.error("Failed to load DSA debug data:", err);
    } finally {
      setIsRefreshingDebug(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, []);

  // Handle Autocomplete fetching
  useEffect(() => {
    if (query.trim() === '') {
      setAutocomplete([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      // Get the last typed word for prefix matching
      const words = query.split(/\s+/);
      const lastWord = words[words.length - 1];

      if (lastWord.length > 0) {
        try {
          const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(lastWord)}`);
          if (res.ok) {
            const list = await res.json();
            setAutocomplete(list);
          }
        } catch (err) {
          console.error("Autocomplete fetch failed:", err);
        }
      } else {
        setAutocomplete([]);
      }
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Run Search
  const handleSearch = async (searchQuery = query, mode = searchMode) => {
    if (searchQuery.trim() === '') return;
    
    setIsLoading(true);
    setShowAutocomplete(false);
    
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&mode=${mode}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSuggestions(data.suggestions || {});
        setQueryWords(data.queryWords || []);
        setActiveTab('results'); // Switch back to results view
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard navigation for autocomplete
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < autocomplete.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < autocomplete.length) {
        e.preventDefault();
        applyAutocompleteSuggestion(autocomplete[activeSuggestionIndex]);
      } else {
        handleSearch();
      }
    } else if (e.key === "Escape") {
      setShowAutocomplete(false);
    }
  };

  const applyAutocompleteSuggestion = (sug) => {
    // Replace the last word with the suggested word
    const words = query.split(/\s+/);
    words[words.length - 1] = sug;
    const newQuery = words.join(' ') + ' ';
    setQuery(newQuery);
    setAutocomplete([]);
    setActiveSuggestionIndex(-1);
    handleSearch(newQuery, searchMode);
  };

  // Add Custom Document
  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) {
      setDocMessage({ type: 'error', text: 'Title and content are required!' });
      return;
    }

    setIsSubmittingDoc(true);
    setDocMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: docTitle, content: docContent })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setDocMessage({ type: 'success', text: 'Document indexed successfully!' });
        setDocTitle('');
        setDocContent('');
        fetchDebugData(); // Update index visualization
      } else {
        setDocMessage({ type: 'error', text: data.error || 'Failed to add document' });
      }
    } catch (err) {
      setDocMessage({ type: 'error', text: 'API communication error.' });
      console.error(err);
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  // Helper to highlight matching query words in snippets
  const highlightText = (text, words) => {
    if (!words || words.length === 0) return text;
    
    // Normalize search terms
    const normalizedWords = words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(w => w.length > 0);
    if (normalizedWords.length === 0) return text;

    // Create dynamic regex matching any query words
    const pattern = `\\b(${normalizedWords.map(w => escapeRegExp(w)).join('|')})\\b`;
    const regex = new RegExp(pattern, 'gi');

    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <span key={i} className="bg-sky-500/20 text-sky-300 px-1 py-0.5 rounded font-medium border border-sky-500/10">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col antialiased selection:bg-sky-500/30 selection:text-sky-200">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0e1626]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Mini Search Engine
              </h1>
              <p className="text-xs text-sky-400 font-medium tracking-wide uppercase">DSA Laboratory Project</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={fetchDebugData}
              disabled={isRefreshingDebug}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900 text-xs transition duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDebug ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
              <span>Refresh DSA State</span>
            </button>
            <a 
              href="#visualizer" 
              className="text-xs text-sky-400 hover:text-sky-300 font-medium transition"
              onClick={() => setActiveTab('index')}
            >
              Inspect Data Structures &rarr;
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Search Panel & Add Document */}
        <div className="w-full lg:w-5/12 flex flex-col gap-6">
          
          {/* Search Box Card */}
          <div className="glass p-6 rounded-2xl glow-primary">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-sky-400" />
              <span>Search Engine Query</span>
            </h2>
            
            <div className="relative" ref={autocompleteRef}>
              <div className="relative">
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowAutocomplete(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowAutocomplete(true)}
                  placeholder="Type a word or query..." 
                  className="w-full bg-[#070b13] border border-slate-800 focus:border-sky-500 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition duration-200 text-base"
                />
                <Search className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
              </div>

              {/* Autocomplete Dropdown */}
              {showAutocomplete && autocomplete.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-[#0d1527] border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-3.5 py-1.5 bg-[#121c32]/50 border-b border-slate-800 text-[10px] uppercase font-bold text-sky-400 flex items-center justify-between">
                    <span>Trie Autocomplete Suggestions</span>
                    <span className="text-slate-500">Press enter to apply</span>
                  </div>
                  <ul>
                    {autocomplete.map((sug, index) => (
                      <li 
                        key={index}
                        onClick={() => applyAutocompleteSuggestion(sug)}
                        className={`px-4 py-2.5 hover:bg-sky-500/10 cursor-pointer flex items-center justify-between text-sm transition-colors ${
                          index === activeSuggestionIndex ? 'bg-sky-500/20 text-white font-medium' : 'text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sky-500 font-semibold">•</span>
                          {sug}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Boolean Logic Filters */}
            <div className="mt-4">
              <span className="text-xs text-slate-400 font-semibold block mb-2">Query Execution Logic</span>
              <div className="grid grid-cols-3 gap-2 bg-[#070b13] p-1 rounded-xl border border-slate-800">
                {[
                  { id: 'simple', label: 'TF-IDF Relevance' },
                  { id: 'and', label: 'AND Match' },
                  { id: 'or', label: 'OR Match' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setSearchMode(mode.id);
                      handleSearch(query, mode.id);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-medium transition duration-200 ${
                      searchMode === mode.id 
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/10' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleSearch()}
              disabled={isLoading || query.trim() === ''}
              className="w-full mt-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl transition duration-200 shadow-lg shadow-sky-500/15 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Search Database</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Add New Document Form */}
          <div className="glass p-6 rounded-2xl">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-sky-400" />
              <span>Index Custom Document</span>
            </h3>
            
            <form onSubmit={handleAddDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Document Title</label>
                <input 
                  type="text" 
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="E.g., Space flight mechanics" 
                  className="w-full bg-[#070b13] border border-slate-800 focus:border-sky-500 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Content Text</label>
                <textarea 
                  rows={4}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Insert paragraphs of text here. Our Inverted Index tokenizes and parses it into posting entries in real-time."
                  className="w-full bg-[#070b13] border border-slate-800 focus:border-sky-500 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition duration-200 resize-none"
                />
              </div>

              {docMessage.text && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  docMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  {docMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
                  <span>{docMessage.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingDoc}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium py-2 rounded-lg text-sm transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingDoc ? 'Indexing...' : 'Index Page'}
              </button>
            </form>
          </div>

        </div>

        {/* Right Column: Search Results / DSA Debug Panels */}
        <div className="w-full lg:w-7/12 flex flex-col gap-6" id="visualizer">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800">
            {[
              { id: 'results', label: 'Search Results', icon: BookOpen },
              { id: 'index', label: 'Inverted Index', icon: Database },
              { id: 'trie', label: 'Trie Vocabulary', icon: Layers },
              { id: 'tfidf', label: 'TF-IDF Breakdown', icon: Code }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition duration-200 -mb-[2px] ${
                    activeTab === tab.id
                      ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Contents */}
          <div className="flex-1 min-h-[500px]">
            
            {/* View: Search Results */}
            {activeTab === 'results' && (
              <div className="space-y-6">
                
                {/* Spell Corrector Alert Banner */}
                {Object.keys(suggestions).length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-300">Spelling Correction Suggestions</h4>
                      <p className="text-xs text-slate-400 mt-0.5">We couldn't match some terms directly. Did you mean:</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(suggestions).map(([word, wordsugList]) => (
                          <div key={word} className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                            <span className="text-slate-500 font-medium">{word} &rarr;</span>
                            {wordsugList.map((sug, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  // Replace misspelled word with suggestion
                                  const updatedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'i'), sug);
                                  setQuery(updatedQuery);
                                  handleSearch(updatedQuery, searchMode);
                                }}
                                className="text-sky-400 hover:text-sky-300 font-semibold underline cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mb-3" />
                    <p className="text-sm">Querying internal index structures...</p>
                  </div>
                )}

                {/* No Search Initiated */}
                {!isLoading && results.length === 0 && queryWords.length === 0 && (
                  <div className="text-center py-20 bg-slate-900/20 rounded-2xl border border-dashed border-slate-800">
                    <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-base font-semibold text-slate-400">Ready to search</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mt-2">
                      Enter words above. Results are indexed on-the-fly and scored instantly.
                    </p>
                  </div>
                )}

                {/* Search Completed but 0 Results (No Suggestions) */}
                {!isLoading && results.length === 0 && queryWords.length > 0 && Object.keys(suggestions).length === 0 && (
                  <div className="text-center py-20 bg-rose-950/10 rounded-2xl border border-rose-900/10">
                    <Info className="w-10 h-10 text-rose-400/70 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-300">No matching pages found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">
                      Your query <code className="text-rose-300 bg-rose-500/10 px-1 py-0.5 rounded">"{query}"</code> did not yield any document intersections. Try relaxing the search parameters or adding a custom page containing these keywords.
                    </p>
                  </div>
                )}

                {/* Search Completed but 0 Results (With Suggestions) */}
                {!isLoading && results.length === 0 && queryWords.length > 0 && Object.keys(suggestions).length > 0 && (
                  <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800/80">
                    <Sparkles className="w-10 h-10 text-amber-400/70 mx-auto mb-3 animate-pulse" />
                    <h3 className="text-base font-semibold text-slate-300">No results found for "{query}"</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2">
                      We couldn't find any direct matches. Try clicking one of the spelling suggestions above to search.
                    </p>
                  </div>
                )}

                {/* Results List */}
                {!isLoading && results.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs text-slate-400 font-medium px-1">
                      <span>Found {results.length} relevant pages</span>
                      <span>Sorted by TF-IDF relevance score</span>
                    </div>

                    {results.map((doc, idx) => (
                      <div key={doc.docId} className="glass-card p-5 rounded-xl">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/10">
                              Rank #{idx + 1}
                            </span>
                            <h3 className="text-base font-semibold text-white mt-2 hover:text-sky-400 transition cursor-pointer">
                              {doc.title}
                            </h3>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Score</span>
                            <span className="text-base font-extrabold text-emerald-400">
                              {doc.score.toFixed(5)}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                          {highlightText(doc.snippet, queryWords)}
                        </p>

                        {/* Keyword contribution tags */}
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800/60">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center">
                            TF-IDF breakdown:
                          </span>
                          {Object.entries(doc.breakdown).map(([word, val]) => (
                            <span 
                              key={word} 
                              className={`text-xs px-2 py-0.5 rounded flex items-center gap-1.5 ${
                                val > 0 
                                  ? 'bg-[#0f243d] border border-sky-500/20 text-sky-300' 
                                  : 'bg-slate-900/50 border border-slate-800 text-slate-500'
                              }`}
                            >
                              <span className="font-semibold text-[10px] uppercase">{word}</span>
                              <span className="font-mono text-[10px] bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                                {val.toFixed(4)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* View: Inverted Index */}
            {activeTab === 'index' && (
              <div className="glass p-5 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase">Inverted Index Dictionary</h3>
                    <p className="text-xs text-slate-400">Maps parsed terms to their document frequencies and raw count logs.</p>
                  </div>
                  <input
                    type="text"
                    value={searchIndexFilter}
                    onChange={(e) => setSearchIndexFilter(e.target.value.toLowerCase())}
                    placeholder="Filter terms..."
                    className="w-full sm:w-48 bg-[#070b13] border border-slate-800 focus:border-sky-500 rounded-lg p-1.5 text-xs focus:outline-none"
                  />
                </div>

                <div className="max-h-[500px] overflow-y-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0f172a] text-slate-400 font-bold border-b border-slate-800">
                        <th className="p-3">Term</th>
                        <th className="p-3">Doc Freq (DF)</th>
                        <th className="p-3">Postings List (Doc ID &rarr; Term Freq)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/55">
                      {Object.entries(debugData.invertedIndex)
                        .filter(([term]) => term.includes(searchIndexFilter))
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([term, postings]) => (
                          <tr key={term} className="hover:bg-slate-900/30">
                            <td className="p-3 font-semibold text-sky-400 font-mono">{term}</td>
                            <td className="p-3 font-medium text-slate-300">{postings.length}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2">
                                {postings.map((post, idx) => (
                                  <span key={idx} className="bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1.5 font-mono text-[10px] text-slate-300">
                                    <span className="text-slate-500">Doc</span>{post.docId}
                                    <span className="text-slate-600">|</span>
                                    <span className="text-slate-500">tf:</span><span className="text-emerald-400 font-bold">{post.freq}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      {Object.keys(debugData.invertedIndex).length === 0 && (
                        <tr>
                          <td colSpan="3" className="p-10 text-center text-slate-500">
                            No indexed terms. Add a document to build the Inverted Index!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* View: Trie Vocabulary */}
            {activeTab === 'trie' && (
              <div className="glass p-5 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase">Trie Prefix Words</h3>
                    <p className="text-xs text-slate-400">Lists all unique spelling elements registered in the Autocomplete Trie.</p>
                  </div>
                  <input
                    type="text"
                    value={triePrefixFilter}
                    onChange={(e) => setTriePrefixFilter(e.target.value.toLowerCase())}
                    placeholder="Search prefix..."
                    className="w-full sm:w-48 bg-[#070b13] border border-slate-800 focus:border-sky-500 rounded-lg p-1.5 text-xs focus:outline-none"
                  />
                </div>

                <div className="bg-[#070b13] p-4 rounded-xl border border-slate-800/80 max-h-[400px] overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {debugData.vocabulary
                      .filter(word => word.startsWith(triePrefixFilter))
                      .sort()
                      .map((word, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setQuery(prev => {
                              const words = prev.trim().split(/\s+/);
                              if (words.length > 0 && !prev.endsWith(' ')) {
                                words[words.length - 1] = word;
                              } else {
                                words.push(word);
                              }
                              return words.join(' ') + ' ';
                            });
                          }}
                          className="bg-slate-900 border border-slate-800 hover:border-sky-500 hover:text-white px-2.5 py-1 rounded-lg text-xs text-slate-300 font-mono transition duration-150 cursor-pointer"
                        >
                          {word}
                        </button>
                      ))}
                    {debugData.vocabulary.length === 0 && (
                      <span className="text-xs text-slate-500 p-4 w-full text-center">
                        Trie is empty. Once you add documents, words are inserted automatically.
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/40">
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Clicking a vocabulary token loads it into the search box to demonstrate Trie extraction.</span>
                </div>
              </div>
            )}

            {/* View: TF-IDF Debugger */}
            {activeTab === 'tfidf' && (
              <div className="glass p-5 rounded-2xl space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase">TF-IDF Math breakdown</h3>
                  <p className="text-xs text-slate-400">See how Inverse Document Frequency (IDF) is calculated for terms based on the current collection.</p>
                </div>

                {queryWords.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    Please submit a search query first to examine TF-IDF values.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* IDF calculation block */}
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#070b13]">
                      <div className="px-4 py-2.5 bg-[#0f172a] border-b border-slate-800 text-xs font-bold text-slate-300">
                        1. Query Term IDFs (Inverse Document Frequency)
                      </div>
                      <table className="w-full text-left text-xs border-collapse font-mono">
                        <thead>
                          <tr className="text-slate-400 font-bold border-b border-slate-800/60 bg-[#0e1626]/20">
                            <th className="p-3">Term</th>
                            <th className="p-3 text-center">Docs with Term (DF)</th>
                            <th className="p-3">IDF Formula: ln(1 + N/DF)</th>
                            <th className="p-3 text-right">IDF Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {queryWords.map((word) => {
                            const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const postings = debugData.invertedIndex[cleaned] || [];
                            const df = postings.length;
                            const totalDocs = Object.keys(debugData.docLengths).length;
                            const idf = df > 0 ? Math.log(1.0 + (totalDocs / df)) : 0;
                            return (
                              <tr key={word} className="hover:bg-slate-900/10">
                                <td className="p-3 text-sky-400 font-semibold">{word}</td>
                                <td className="p-3 text-center font-semibold text-slate-300">{df}</td>
                                <td className="p-3 text-slate-500">ln(1 + {totalDocs} / {df || 0})</td>
                                <td className="p-3 text-right text-emerald-400 font-bold">{idf.toFixed(5)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Document weights details */}
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#070b13]">
                      <div className="px-4 py-2.5 bg-[#0f172a] border-b border-slate-800 text-xs font-bold text-slate-300">
                        2. Matching Documents TF-IDF Details
                      </div>
                      
                      {results.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No matching docs to calculate TF.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800">
                          {results.map((resDoc) => (
                            <div key={resDoc.docId} className="p-4 space-y-3">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-white">{resDoc.title}</span>
                                <span className="text-[10px] text-slate-500">Total words in doc: <strong className="text-slate-300">{debugData.docLengths[resDoc.docId]}</strong></span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {Object.entries(resDoc.breakdown).map(([term, tfidf]) => {
                                  const postings = debugData.invertedIndex[term] || [];
                                  const termPosting = postings.find(p => p.docId === resDoc.docId);
                                  const count = termPosting ? termPosting.freq : 0;
                                  const totalLen = debugData.docLengths[resDoc.docId] || 1;
                                  const tf = count / totalLen;
                                  
                                  return (
                                    <div key={term} className="bg-slate-900 border border-slate-800/80 p-2.5 rounded-lg text-[10px] font-mono">
                                      <div className="flex justify-between font-bold border-b border-slate-800/60 pb-1.5 mb-1.5">
                                        <span className="text-sky-400 uppercase">{term}</span>
                                        <span className="text-emerald-400">{tfidf.toFixed(5)}</span>
                                      </div>
                                      <div className="space-y-1 text-slate-400 text-[9px]">
                                        <div className="flex justify-between">
                                          <span>Freq in Doc:</span>
                                          <span className="text-slate-300">{count}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>TF (f/length):</span>
                                          <span className="text-slate-300">{tf.toFixed(4)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>TF-IDF (TF * IDF):</span>
                                          <span className="text-slate-300">{tf.toFixed(3)} * {(tfidf/tf || 0).toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="text-right text-[10px] text-emerald-400 font-bold border-t border-slate-800/40 pt-2 flex justify-end gap-2">
                                <span className="text-slate-500 uppercase font-mono">Total Cumulative Score:</span>
                                <span className="underline">{resDoc.score.toFixed(5)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 bg-[#070b13] py-8 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-400 mb-2">Designed for CLion C++ Backend + React Frontend integration</p>
          <p>Concepts demonstrated: Prefix Trees (Trie), Posting lists, boolean list operations, Edit Distance dynamic programming, TF-IDF ranking models.</p>
        </div>
      </footer>

    </div>
  );
}
