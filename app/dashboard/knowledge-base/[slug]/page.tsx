'use client';

import React, { useState, useEffect, ReactElement } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/services/supabase';
import {
  ArrowLeft,
  Clock,
  User,
  Calendar,
  Tag,
  Edit,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  kb_code: string;
  author: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export default function ArticlePage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const ALLOWED_DELETE_POSITIONS = [
    'Operations Manager',
    'Technical Support Engineer',
    'Operations Technical Lead'
  ];

  // Get current user and their position
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);

        // Fetch user's position from profiles (with positions table relationship)
        const { data: profile } = await supabase
          .from('profiles')
          .select('positions(name)')
          .eq('id', user.id)
          .single();

        if (profile) {
          const position = (profile?.positions as any)?.name || null;
          setUserPosition(position);
          console.log('User position from database:', position);
          console.log('Allowed delete positions:', ALLOWED_DELETE_POSITIONS);
          console.log('Can delete:', ALLOWED_DELETE_POSITIONS.includes(position));
          setCanDelete(ALLOWED_DELETE_POSITIONS.includes(position));
        }
      }
    }
    getCurrentUser();
  }, []);

  // Check if current user is the author
  useEffect(() => {
    if (article && currentUserId) {
      setIsAuthor(article.author_id === currentUserId);
    }
  }, [article, currentUserId]);

  useEffect(() => {
    if (!slug) return;

    async function fetchArticle() {
      try {
        const response = await fetch(`/api/knowledge-base/${slug}`);
        const data = await response.json();

        if (response.ok) {
          setArticle(data.article);
        } else {
          setError(data.error || 'Failed to load article');
        }
      } catch (error) {
        console.error('Error fetching article:', error);
        setError('Failed to load article');
      } finally {
        setIsLoading(false);
      }
    }

    fetchArticle();
  }, [slug]);

  // Render Lexical content
  const renderLexicalContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      const root = parsed.root;

      if (!root || !root.children) {
        return <p>No content available</p>;
      }

      return root.children.map((node: any, index: number) => {
        return renderNode(node, index);
      });
    } catch (error) {
      console.error('Error parsing content:', error);
      return <p>Error displaying content</p>;
    }
  };

  const renderNode = (node: any, index: number): ReactElement | null => {
    if (!node) return null;

    const key = `${node.type}-${index}`;

    // Get alignment style if present
    const getAlignmentStyle = () => {
      if (!node.format) return {};
      const alignments: Record<string, string> = {
        'left': 'text-left',
        'center': 'text-center',
        'right': 'text-right',
        'justify': 'text-justify'
      };
      return alignments[node.format] ? { className: alignments[node.format] } : {};
    };

    // Heading
    if (node.type === 'heading') {
      const Tag = node.tag || 'h2';
      const alignStyle = getAlignmentStyle();
      return React.createElement(
        Tag,
        {
          key,
          className: `${getHeadingClass(node.tag)} ${alignStyle.className || ''}`
        },
        node.children?.map((child: any, i: number) => renderTextNode(child, i))
      );
    }

    // Paragraph
    if (node.type === 'paragraph') {
      const alignStyle = getAlignmentStyle();
      return (
        <p key={key} className={`mb-4 text-slate-300 leading-relaxed ${alignStyle.className || ''}`}>
          {node.children?.map((child: any, i: number) => renderTextNode(child, i))}
        </p>
      );
    }

    // List
    if (node.type === 'list') {
      const ListTag = node.listType === 'number' ? 'ol' : 'ul';
      const listClass = node.listType === 'number'
        ? 'list-decimal list-inside mb-4 space-y-2 text-slate-300 ml-6'
        : 'list-disc list-inside mb-4 space-y-2 text-slate-300 ml-6';

      return React.createElement(
        ListTag,
        { key, className: listClass },
        node.children?.map((child: any, i: number) => renderNode(child, i))
      );
    }

    // List item
    if (node.type === 'listitem') {
      return (
        <li key={key} className="mb-1">
          {node.children?.map((child: any, i: number) => {
            // Handle paragraph nodes inside list items
            if (child.type === 'paragraph') {
              return child.children?.map((textChild: any, j: number) => renderTextNode(textChild, j));
            }
            return renderTextNode(child, i);
          })}
        </li>
      );
    }

    // Quote
    if (node.type === 'quote') {
      return (
        <blockquote key={key} className="border-l-4 border-blue-500 pl-4 italic my-4 text-slate-400 bg-slate-900/50 py-3 rounded-r">
          {node.children?.map((child: any, i: number) => renderNode(child, i))}
        </blockquote>
      );
    }

    // Code block
    if (node.type === 'code') {
      const codeText = node.children?.map((child: any) => child.text || '').join('') || '';
      return (
        <pre key={key} className="bg-slate-900 p-4 rounded-lg font-mono text-sm text-slate-200 my-4 overflow-x-auto border border-slate-800">
          <code>{codeText}</code>
        </pre>
      );
    }

    return null;
  };

  const renderTextNode = (node: any, index?: number): ReactElement | string => {
    if (!node || node.type !== 'text') {
      return '';
    }

    const text = node.text || '';
    const key = index !== undefined ? `text-${index}` : undefined;

    // Check for format flags (Lexical uses bitmask for formats)
    // 1 = bold, 2 = italic, 4 = strikethrough, 8 = underline, 16 = code
    const format = node.format || 0;
    const isBold = (format & 1) !== 0;
    const isItalic = (format & 2) !== 0;
    const isStrikethrough = (format & 4) !== 0;
    const isUnderline = (format & 8) !== 0;
    const isCode = (format & 16) !== 0;

    // Apply formatting
    let element: React.ReactNode = text;

    if (isCode) {
      element = <code className="font-mono text-sm bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">{element}</code>;
    }

    if (isBold) {
      element = <strong className="font-bold text-white">{element}</strong>;
    }

    if (isItalic) {
      element = <em className="italic">{element}</em>;
    }

    if (isUnderline) {
      element = <span className="underline">{element}</span>;
    }

    if (isStrikethrough) {
      element = <span className="line-through opacity-70">{element}</span>;
    }

    // If any formatting was applied, wrap in a span with key
    if (format !== 0) {
      return <span key={key}>{element}</span>;
    }

    return text;
  };

  const getHeadingClass = (tag: string) => {
    const classes: Record<string, string> = {
      h1: 'text-3xl font-bold text-white mb-6 mt-8',
      h2: 'text-2xl font-bold text-white mb-4 mt-6',
      h3: 'text-xl font-semibold text-white mb-3 mt-4',
      h4: 'text-lg font-semibold text-white mb-2 mt-3',
    };
    return classes[tag] || classes.h2;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDelete = async () => {
    if (!article) return;

    setIsDeleting(true);

    try {
      const response = await fetch('/api/knowledge-base/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: article.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to knowledge base main page
        router.push('/dashboard/knowledge-base');
      } else {
        alert(data.error || 'Failed to delete article');
      }
    } catch (error) {
      console.error('Error deleting article:', error);
      alert('Failed to delete article. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Article Not Found</h2>
          <p className="text-slate-400 mb-6">{error || 'The article you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/dashboard/knowledge-base')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-all"
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

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back Button and Action Buttons */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex items-center gap-3">
            {isAuthor && (
              <button
                onClick={() => router.push(`/dashboard/knowledge-base/edit/${article?.slug}`)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Article</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Article Header */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-400 text-sm font-medium rounded-full border border-blue-500/20">
              <Tag className="w-3.5 h-3.5" />
              {article.category}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800/50 text-slate-300 text-sm font-mono rounded-full border border-slate-700/50">
              {article.kb_code}
            </span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            {article.title}
          </h1>

          {/* Tags Display */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {article.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-purple-500/10 text-purple-300 text-xs rounded-full border border-purple-500/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{article.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(article.created_at)}</span>
            </div>
            {article.updated_at && article.updated_at !== article.created_at && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Updated {formatDate(article.updated_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Article Content */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
          <div className="prose prose-invert prose-slate max-w-none">
            {renderLexicalContent(article.content)}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Delete Article?</h3>
              <p className="text-slate-400 mb-6">
                Are you sure you want to delete &quot;{article?.title}&quot;? This action will soft delete the article and it will no longer be visible to users.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
