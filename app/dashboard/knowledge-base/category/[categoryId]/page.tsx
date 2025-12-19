'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Clock,
  Search,
  ChevronRight,
  Calendar,
  BookOpen,
  Filter,
  SortAsc
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

export default function CategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params?.categoryId as string;

  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');

  useEffect(() => {
    if (!categoryId) return;

    async function fetchData() {
      try {
        // Fetch category details
        const categoryResponse = await fetch('/api/kb_categories/get');
        const categoryData = await categoryResponse.json();

        if (categoryResponse.ok) {
          const foundCategory = categoryData.categories?.find((c: Category) => c.id === categoryId);
          setCategory(foundCategory || null);
        }

        // Fetch articles for this category
        const articlesResponse = await fetch(`/api/knowledge-base/get?category_id=${categoryId}&limit=100`);
        const articlesData = await articlesResponse.json();

        if (articlesResponse.ok) {
          setArticles(articlesData.articles || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [categoryId]);

  const filteredArticles = articles
    .filter(article =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        return a.title.localeCompare(b.title);
      }
    });

  const calculateReadTime = (content: string) => {
    try {
      const jsonContent = JSON.parse(content);
      const text = JSON.stringify(jsonContent);
      const words = text.split(/\s+/).length;
      const minutes = Math.ceil(words / 200);
      return `${minutes} min`;
    } catch {
      return '5 min';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400">Loading articles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-purple-900/10 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/knowledge-base')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Knowledge Base</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm font-medium text-white">{category?.name || 'Category'}</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/60 rounded-3xl p-8 md:p-10 backdrop-blur-md relative overflow-hidden">
            {/* Decorative gradient */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <BookOpen className="w-6 h-6 text-blue-400" />
                </div>
                <div className="px-4 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-full">
                  <span className="text-sm font-medium text-slate-300">
                    {articles.length} {articles.length === 1 ? 'Article' : 'Articles'}
                  </span>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
                {category?.name || 'Category'}
              </h1>

              <p className="text-slate-400 text-lg max-w-2xl">
                Browse all articles and guides in this category
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all backdrop-blur-sm"
              placeholder="Search articles in this category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none pl-4 pr-10 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all backdrop-blur-sm cursor-pointer min-w-[180px]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">A-Z</option>
            </select>
            <SortAsc className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Results Count */}
        {searchQuery && (
          <div className="mb-6">
            <p className="text-slate-400 text-sm">
              Found {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        )}

        {/* Articles List */}
        {filteredArticles.length === 0 ? (
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-16 text-center backdrop-blur-sm">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery ? 'No articles found' : 'No articles yet'}
              </h3>
              <p className="text-slate-400">
                {searchQuery
                  ? 'Try adjusting your search terms or filters'
                  : 'Articles in this category will appear here once published'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => router.push(`/dashboard/knowledge-base/${article.id}`)}
                className="group bg-slate-900/50 border border-slate-800/60 hover:border-blue-500/30 rounded-2xl p-6 transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-blue-900/20 backdrop-blur-sm relative overflow-hidden"
              >
                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
                        {article.title}
                      </h3>

                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(article.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{calculateReadTime(article.content)} read</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/50">
                    <span className="text-sm text-slate-500">Read article</span>
                    <div className="flex items-center gap-2 text-blue-400 group-hover:translate-x-1 transition-transform">
                      <span className="text-sm font-medium">View</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
