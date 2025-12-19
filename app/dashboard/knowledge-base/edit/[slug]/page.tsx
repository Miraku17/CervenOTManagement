'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LexicalEditor from '@/components/LexicalEditor';

import {
  ArrowLeft,
  Save,
  Tag,
  Folder,
  Type,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category_id: string;
  kb_code: string;
  published: boolean;
  tags: string[];
  description?: string;
  author_id: string;
}

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    content: ''
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch article data
  useEffect(() => {
    async function fetchArticle() {
      if (!slug) return;

      try {
        const response = await fetch(`/api/knowledge-base/${slug}`);
        const data = await response.json();

        if (response.ok && data.article) {
          setArticle(data.article);
          setFormData({
            title: data.article.title,
            category: data.article.category,
            description: data.article.description || '',
            content: data.article.content
          });
          setTags(data.article.tags || []);
        } else {
          setErrorMessage('Article not found or you do not have permission to edit it');
          setShowErrorModal(true);
        }
      } catch (error) {
        console.error('Error fetching article:', error);
        setErrorMessage('Failed to load article');
        setShowErrorModal(true);
      } finally {
        setIsFetching(false);
      }
    }

    fetchArticle();
  }, [slug]);

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/kb_categories/get');
        const data = await response.json();

        if (response.ok) {
          setCategories(data.categories || []);
        } else {
          console.error('Error fetching categories:', data.error);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }

    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!article) return;

    // Validate required fields
    if (!formData.title.trim()) {
      setErrorMessage('Title is required');
      setShowErrorModal(true);
      return;
    }

    if (!formData.category) {
      setErrorMessage('Category is required');
      setShowErrorModal(true);
      return;
    }

    if (!formData.content.trim()) {
      setErrorMessage('Content is required');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);

    try {
      // Find category ID from category name
      const category = categories.find(cat => cat.name === formData.category);
      const categoryId = category?.id || article.category_id;

      const response = await fetch('/api/knowledge-base/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: article.id,
          title: formData.title,
          content: formData.content,
          category_id: categoryId,
          published: article.published,
          tags: tags,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSuccessModal(true);
        setTimeout(() => {
          router.push(`/dashboard/knowledge-base/${data.article.slug}`);
        }, 1500);
      } else {
        setErrorMessage(data.error || 'Failed to update article');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error updating article:', error);
      setErrorMessage('Failed to update article. Please try again.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-slate-400">Article not found or access denied</p>
          <button
            onClick={() => router.push('/dashboard/knowledge-base')}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg"
          >
            Back to Knowledge Base
          </button>
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-white">Edit Article</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-slate-400 hover:text-white font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Update Article</span>
                </>
              )}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Article Title <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Type className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  placeholder="e.g., How to configure VPN settings"
                />
              </div>
            </div>

            {/* Content Editor */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm min-h-[600px] flex flex-col">
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Content <span className="text-red-500">*</span>
              </label>
              <div className="flex-1">
                <LexicalEditor
                  initialValue={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                />
              </div>
            </div>
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            {/* Organization */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-500" />
                Organization
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    KB Code
                  </label>
                  <div className="block w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-300 text-sm font-mono">
                    {article.kb_code}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Knowledge base identifier (cannot be changed)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all appearance-none pr-10"
                    >
                      <option value="" disabled>Select a category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Short Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="block w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all resize-none text-sm"
                    placeholder="Brief summary for search results..."
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-500" />
                Tags
              </h3>
              <div className="space-y-3">
                {/* Tag Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg font-medium transition-all"
                  >
                    Add
                  </button>
                </div>

                {/* Display Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="group px-3 py-1 bg-purple-500/10 text-purple-300 text-xs rounded-full border border-purple-500/20 flex items-center gap-2"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-purple-100 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {tags.length === 0 && (
                  <p className="text-slate-500 text-xs">No tags added yet. Tags help users find your article.</p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Article Updated Successfully!</h3>
              <p className="text-slate-400">
                Your changes have been saved and published.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
              <p className="text-slate-400 mb-6">{errorMessage}</p>
              <button
                onClick={() => setShowErrorModal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
