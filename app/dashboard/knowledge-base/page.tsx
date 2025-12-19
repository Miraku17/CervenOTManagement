'use client';

import React, { useState, useEffect, ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';
import {
  Search,
  FileText,
  Users,
  Shield,
  Clock,
  Briefcase,
  ChevronRight,
  HelpCircle,
  Terminal,
  Database,
  ArrowLeft,
  Plus
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  articleCount: number;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  kb_code: string;
  tags?: string[];
  created_at: string;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('employee');

  const isLoading = isCategoriesLoading || isArticlesLoading;

  // Fetch user role
  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile) {
            setUserRole(profile.role || 'employee');
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    }

    fetchUserRole();
  }, []);

  // Fetch categories with article counts
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/knowledge-base/category-counts');
        const data = await response.json();

        if (response.ok) {
          setCategories(data.categories || []);
        } else {
          console.error('Error fetching categories:', data.error);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsCategoriesLoading(false);
      }
    }

    fetchCategories();
  }, []);

  // Fetch recent articles
  useEffect(() => {
    async function fetchRecentArticles() {
      try {
        const response = await fetch('/api/knowledge-base/get?recent=true&limit=6');
        const data = await response.json();

        if (response.ok) {
          setRecentArticles(data.articles || []);
        } else {
          console.error('Error fetching articles:', data.error);
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
      } finally {
        setIsArticlesLoading(false);
      }
    }

    fetchRecentArticles();
  }, []);

  // Handle back button navigation based on role
  const handleBack = () => {
    if (userRole === 'admin') {
      router.push('/dashboard/admin');
    } else {
      router.push('/dashboard/employee');
    }
  };

  // Handle search
  const handleSearch = async (query: string) => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const response = await fetch(`/api/knowledge-base/search?q=${encodeURIComponent(trimmedQuery)}`);
      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.articles || []);
      } else {
        console.error('Search error:', data.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        setShowSearchResults(false);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Helper function to get category icon and color
  const getCategoryIcon = (categoryName: string) => {
    const iconMap: Record<string, ReactElement> = {
      'Getting Started': <Briefcase className="w-6 h-6 text-blue-400" />,
      'Hardware Support': <Terminal className="w-6 h-6 text-purple-400" />,
      'Software & Applications': <Database className="w-6 h-6 text-cyan-400" />,
      'Network & Connectivity': <Shield className="w-6 h-6 text-emerald-400" />,
      'Account & Access Management': <Users className="w-6 h-6 text-orange-400" />,
      'Security & Compliance': <Shield className="w-6 h-6 text-red-400" />,
      'Troubleshooting & FAQs': <HelpCircle className="w-6 h-6 text-yellow-400" />,
    };

    return iconMap[categoryName] || <FileText className="w-6 h-6 text-slate-400" />;
  };

  const getCategoryDescription = (categoryName: string) => {
    const descMap: Record<string, string> = {
      'Getting Started': 'New to our systems? Start here for an overview of our platforms and workflows.',
      'Hardware Support': 'Information about hardware setup, maintenance, and troubleshooting.',
      'Software & Applications': 'Guides for software installation, configuration, and application usage.',
      'Network & Connectivity': 'Network setup, connectivity issues, and VPN configuration guides.',
      'Account & Access Management': 'User account management, permissions, and access control procedures.',
      'Security & Compliance': 'Security policies, compliance requirements, and data protection protocols.',
      'Troubleshooting & FAQs': 'Common issues, frequently asked questions, and quick solutions.',
    };

    return descMap[categoryName] || 'Articles and guides for this category.';
  };

  // Helper function to calculate read time from content
  const calculateReadTime = (content: string) => {
    try {
      const jsonContent = JSON.parse(content);
      const text = JSON.stringify(jsonContent);
      const words = text.split(/\s+/).length;
      const minutes = Math.ceil(words / 200); // Average reading speed
      return `${minutes} min`;
    } catch {
      return '5 min';
    }
  };

  // Show loading state until all data is fetched
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
        {/* Background Gradients */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[120px]" />
          <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-purple-900/10 blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]" />
        </div>

        {/* Hero Section Skeleton */}
        <div className="relative z-10 bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-b border-slate-800/60 pb-16 pt-8 px-4 sm:px-6 lg:px-8 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between animate-pulse">
            <div className="w-20 h-10 bg-slate-800 rounded-lg"></div>
            <div className="w-32 h-10 bg-slate-800 rounded-lg"></div>
          </div>

          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="p-3 bg-slate-800/80 rounded-2xl w-24 h-24 animate-pulse"></div>
            </div>
            <div className="flex flex-col items-center gap-4 mb-10 animate-pulse">
              <div className="w-96 h-12 bg-slate-800 rounded-lg"></div>
              <div className="w-3/4 h-6 bg-slate-800 rounded"></div>
            </div>

            <div className="relative max-w-2xl mx-auto animate-pulse">
              <div className="w-full h-16 bg-slate-800 rounded-2xl"></div>
            </div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 pb-20">
          {/* Categories Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-md animate-pulse"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl"></div>
                  <div className="w-20 h-6 bg-slate-800 rounded-full"></div>
                </div>
                <div className="w-3/4 h-6 bg-slate-800 rounded mb-2"></div>
                <div className="space-y-2 mb-6">
                  <div className="w-full h-3 bg-slate-800 rounded"></div>
                  <div className="w-5/6 h-3 bg-slate-800 rounded"></div>
                </div>
                <div className="w-32 h-4 bg-slate-800 rounded"></div>
              </div>
            ))}
          </div>

          {/* Recent Articles Skeleton */}
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6 animate-pulse">
              <div className="w-10 h-10 bg-slate-800 rounded-lg"></div>
              <div className="w-40 h-8 bg-slate-800 rounded"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-slate-950/40 border border-slate-800/40 rounded-2xl p-4 animate-pulse"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="w-3/4 h-5 bg-slate-800 rounded mb-2"></div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-4 bg-slate-800 rounded"></div>
                        <div className="w-16 h-4 bg-slate-800 rounded"></div>
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-slate-800 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-purple-900/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]" />
      </div>

      {/* Hero Section */}
      <div className="relative z-10 bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-b border-slate-800/60 pb-16 pt-8 px-4 sm:px-6 lg:px-8 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back</span>
          </button>

          <button
            onClick={() => router.push('/dashboard/knowledge-base/create')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 hover:-translate-y-0.5"
          >
            <Plus size={18} />
            <span>Create Article</span>
          </button>
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          {/* Decorative elements */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="flex justify-center mb-6 relative">
             <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
                <img src="/cerventech.png" alt="Cerventech Logo" className="w-16 h-16 rounded-full object-cover" />
             </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6 relative drop-shadow-sm">
            How can we help you?
          </h1>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto relative leading-relaxed">
            Search our knowledge base for answers to your questions about CervenTech systems, policies, and procedures.
          </p>
          
          <div className="relative max-w-2xl mx-auto group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-5 bg-slate-900/60 border border-slate-700/60 rounded-2xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-xl backdrop-blur-md text-lg"
              placeholder="Search for articles, guides, or troubleshooting..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {/* Search glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-500 -z-10" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 pb-20">

        {/* Search Results */}
        {showSearchResults && (
          <div className="mb-12">
            <div className="bg-slate-900/50 border border-slate-800/60 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
              <h2 className="text-2xl font-bold text-white mb-2">
                Search Results
              </h2>
              <p className="text-slate-400 mb-6">
                {isSearching ? (
                  'Searching...'
                ) : (
                  `Found ${searchResults.length} ${searchResults.length === 1 ? 'article' : 'articles'} matching "${searchQuery}"`
                )}
              </p>

              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">No articles found. Try different keywords or search by KB code.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((article) => (
                    <div
                      key={article.id}
                      onClick={() => router.push(`/dashboard/knowledge-base/${article.id}`)}
                      className="group bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 rounded-xl p-4 cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <span className="text-xs font-mono text-slate-400 bg-slate-900/50 px-2 py-1 rounded border border-slate-700/50 ml-2 shrink-0">
                          {article.kb_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                          {article.category}
                        </span>
                        <span>{new Date(article.created_at).toLocaleDateString()}</span>
                      </div>
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {article.tags.slice(0, 3).map((tag: string, index: number) => (
                            <span key={index} className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20">
                              {tag}
                            </span>
                          ))}
                          {article.tags.length > 3 && (
                            <span className="text-xs text-slate-500">+{article.tags.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Grid */}
        {!showSearchResults && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {categories.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-slate-400">No categories available</p>
            </div>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                onClick={() => router.push(`/dashboard/knowledge-base/category/${category.id}`)}
                className="group bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/60 hover:border-slate-700/80 rounded-2xl p-6 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-blue-900/10 backdrop-blur-md flex flex-col relative overflow-hidden"
              >
                {/* Card hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="flex items-center justify-between mb-4 relative">
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 group-hover:border-slate-700 transition-colors shadow-inner">
                    {getCategoryIcon(category.name)}
                  </div>
                  <span className="text-xs font-medium text-slate-400 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800/50">
                    {category.articleCount} {category.articleCount === 1 ? 'article' : 'articles'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors relative">
                  {category.name}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-grow relative">
                  {getCategoryDescription(category.name)}
                </p>
                <div className="flex items-center text-blue-400 font-medium group-hover:translate-x-1 transition-transform relative">
                  Browse category <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))
          )}
          </div>
        )}

        {/* Recent Articles Section */}
        {!showSearchResults && (
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-3xl p-6 md:p-8 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 relative">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            Recent Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
            {recentArticles.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-slate-400">No articles available yet</p>
              </div>
            ) : (
              recentArticles.map((article) => (
                <a
                  key={article.id}
                  href={`/dashboard/knowledge-base/${article.id}`}
                  className="block group bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/40 hover:border-slate-700/60 rounded-2xl p-4 transition-all duration-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-slate-200 group-hover:text-blue-400 transition-colors mb-1 truncate">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-0.5 rounded-md">
                          <FileText className="w-3 h-3" />
                          {article.category}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {calculateReadTime(article.content)}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-900/50 flex items-center justify-center group-hover:bg-blue-500/10 transition-colors">
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transform group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}