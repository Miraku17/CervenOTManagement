'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LexicalEditor from '@/components/LexicalEditor';

import {
  ArrowLeft,
  Save,
  Folder,
  Type,
  ChevronDown,
  X,
  CheckCircle,
  AlertCircle,
  Video,
  Plus,
  Image as ImageIcon,
  Upload
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

export default function CreateArticlePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kbCode, setKbCode] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    content: ''
  });
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch next KB code on mount
  useEffect(() => {
    async function fetchNextKbCode() {
      try {
        const response = await fetch('/api/knowledge-base/next-code');
        const data = await response.json();

        if (response.ok && data.kb_code) {
          setKbCode(data.kb_code);
        } else {
          // Fallback if API fails - generate random code client-side
          console.error('Failed to fetch KB code:', data.error);
          const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
          let code = '';
          for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          setKbCode(`KB-${code}`);
        }
      } catch (error) {
        console.error('Error fetching KB code:', error);
        // Fallback - generate random code client-side
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 4; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setKbCode(`KB-${code}`);
      }
    }

    fetchNextKbCode();
  }, []);

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
      // Convert images to base64
      const imageData = await Promise.all(
        images.map(async (file, index) => {
          return new Promise<{ fileName: string; fileData: string; fileType: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve({
                fileName: file.name,
                fileData: base64,
                fileType: file.type
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );

      const response = await fetch('/api/knowledge-base/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          category: formData.category,
          description: formData.description,
          published: true,
          kb_code: kbCode,
          video_urls: videoUrls,
          images: imageData,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSuccessModal(true);
        setTimeout(() => {
          router.push('/dashboard/knowledge-base');
        }, 1500);
      } else {
        setErrorMessage(data.error || 'Failed to create article');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error creating article:', error);
      setErrorMessage('Failed to create article. Please try again.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVideoUrl = () => {
    const trimmedUrl = videoUrlInput.trim();
    if (trimmedUrl && !videoUrls.includes(trimmedUrl)) {
      setVideoUrls([...videoUrls, trimmedUrl]);
      setVideoUrlInput('');
    }
  };

  const handleRemoveVideoUrl = (urlToRemove: string) => {
    setVideoUrls(videoUrls.filter(url => url !== urlToRemove));
  };

  const handleVideoUrlInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddVideoUrl();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);

    // Check if adding new files would exceed limit
    if (images.length + newFiles.length > 5) {
      setErrorMessage(`You can only upload a maximum of 5 images. Currently you have ${images.length} image(s). You can add ${5 - images.length} more.`);
      setShowErrorModal(true);
      e.target.value = '';
      return;
    }

    const newPreviews: string[] = [];

    newFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === newFiles.length) {
            setImages([...images, ...newFiles]);
            setImagePreviews([...imagePreviews, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset input
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

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
            <h1 className="text-2xl font-bold text-white">Create New Article</h1>
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
                  <span>Publish Article</span>
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
                    {kbCode || 'Loading...'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Auto-generated unique code for easy reference (e.g., KB-A7X2, KB-P4M9)</p>
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

            {/* Images */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-green-500" />
                  Images
                </h3>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  images.length >= 5
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {images.length}/5
                </span>
              </div>
              <div className="space-y-3">
                {/* Image Upload */}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                    disabled={images.length >= 5}
                  />
                  <div className={`flex items-center justify-center gap-2 px-4 py-3 text-white text-sm rounded-lg font-medium transition-all ${
                    images.length >= 5
                      ? 'bg-slate-700 cursor-not-allowed opacity-50'
                      : 'bg-green-600 hover:bg-green-500 cursor-pointer'
                  }`}>
                    <Upload className="w-4 h-4" />
                    {images.length >= 5 ? 'Maximum Reached' : 'Upload Images'}
                  </div>
                </label>

                {/* Display Images */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div
                        key={index}
                        className="relative group bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden aspect-square"
                      >
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                          <p className="text-xs text-white truncate font-medium">{images[index]?.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {imagePreviews.length === 0 && (
                  <div className="border-2 border-dashed border-slate-800 rounded-lg p-4 text-center">
                    <p className="text-slate-500 text-xs">No images uploaded yet</p>
                    <p className="text-slate-600 text-xs mt-1">JPG, PNG, WebP, GIF (Max 5)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Video URLs */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-500" />
                Video Links
              </h3>
              <div className="space-y-3">
                {/* Video URL Input */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    onKeyDown={handleVideoUrlInputKeyDown}
                    placeholder="Paste video URL..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddVideoUrl}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-all flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                {/* Display Video URLs */}
                {videoUrls.length > 0 && (
                  <div className="space-y-2">
                    {videoUrls.map((url, index) => (
                      <div
                        key={index}
                        className="group px-3 py-2 bg-blue-500/10 text-blue-300 text-xs rounded-lg border border-blue-500/20 flex items-center justify-between gap-2"
                      >
                        <span className="truncate flex-1">{url}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVideoUrl(url)}
                          className="hover:text-blue-100 transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {videoUrls.length === 0 && (
                  <p className="text-slate-500 text-xs">No video links added yet. Supports YouTube, Vimeo, and other video platforms.</p>
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
              <h3 className="text-xl font-semibold text-white mb-2">Article Created Successfully!</h3>
              <p className="text-slate-400">
                Your knowledge base article has been published and is now available.
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