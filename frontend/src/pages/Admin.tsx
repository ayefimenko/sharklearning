import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import RichTextEditor from '../components/RichTextEditor';

interface Track {
  id: number;
  title: string;
  description: string;
  difficultyLevel: string;
  estimatedHours: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Course {
  id: number;
  title: string;
  description: string;
  trackId: number;
  trackTitle: string;
  orderIndex: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

interface LearningPath {
  id: number;
  title: string;
  description: string;
  difficultyLevel: string;
  estimatedHours: number;
  isPublished: boolean;
  courseCount: number;
  enrolledUsers: number;
  avgProgress: string;
  createdAt: string;
  updatedAt: string;
  courses: Course[];
}

interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  sections: string[];
}

type AdminTab = 'users' | 'courses' | 'paths' | 'tracks';
type ContentType = 'tracks' | 'courses';
type ContentStatus = 'all' | 'published' | 'draft';
type UserStatus = 'all' | 'active' | 'inactive';
type UserRole = 'all' | 'admin' | 'instructor' | 'student';

const Admin: React.FC = () => {
  const { user, token, isAuthenticated } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<AdminTab>('tracks');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Filters and search
  const [statusFilter, setStatusFilter] = useState<ContentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Track | Course | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    difficultyLevel: 'beginner',
    estimatedHours: 1,
    orderIndex: 0,
    trackId: 0,
    isPublished: false
  });

  // Check admin permissions
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin' && token) {
      apiClient.setToken(token);
      fetchContent();
      fetchTemplates();
    } else if (!isAuthenticated) {
      setError('Authentication required');
    } else if (user?.role !== 'admin') {
      setError('Admin access required');
    }
  }, [isAuthenticated, user, token]);

  useEffect(() => {
    if (user?.role === 'admin' && token) {
      fetchContent();
    }
  }, [activeTab, statusFilter, user, token]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'tracks') {
        const data = await apiClient.getContent('tracks', statusFilter) as { content: { tracks: Track[] } };
        setTracks(data.content?.tracks || []);
      } else if (activeTab === 'courses') {
        const data = await apiClient.getContent('courses', statusFilter) as { content: { courses: Course[] } };
        setCourses(data.content?.courses || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await apiClient.getTemplates() as { templates: ContentTemplate[] };
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (activeTab === 'tracks') {
        await apiClient.createTrack({
          title: formData.title,
          description: formData.description,
          difficultyLevel: formData.difficultyLevel,
          estimatedHours: formData.estimatedHours
        });
      } else {
        await apiClient.createCourse({
          title: formData.title,
          description: formData.description,
          content: formData.content,
          trackId: formData.trackId,
          orderIndex: formData.orderIndex
        });
      }

      setShowCreateModal(false);
      resetForm();
      fetchContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create content');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingItem) return;

    try {
      if (activeTab === 'tracks') {
        await apiClient.updateTrack(editingItem.id, {
          title: formData.title,
          description: formData.description,
          difficultyLevel: formData.difficultyLevel,
          estimatedHours: formData.estimatedHours,
          isPublished: formData.isPublished
        });
      } else {
        await apiClient.updateCourse(editingItem.id, {
          title: formData.title,
          description: formData.description,
          content: formData.content,
          orderIndex: formData.orderIndex,
          isPublished: formData.isPublished
        });
      }

      setShowEditModal(false);
      setEditingItem(null);
      resetForm();
      fetchContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update content');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      if (activeTab === 'tracks') {
        await apiClient.deleteTrack(id);
      } else {
        await apiClient.deleteCourse(id);
      }

      fetchContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete content');
    }
  };

  const handleBulkOperation = async (operation: 'publish' | 'unpublish' | 'delete') => {
    if (selectedItems.length === 0) return;
    
    if (operation === 'delete' && !confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) {
      return;
    }

    try {
      await apiClient.bulkOperation(activeTab, operation, selectedItems);
      setSelectedItems([]);
      fetchContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform bulk operation');
    }
  };

  const openEditModal = (item: Track | Course) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      content: 'content' in item ? item.content : '',
      difficultyLevel: 'difficultyLevel' in item ? (item as Track).difficultyLevel : 'beginner',
      estimatedHours: 'estimatedHours' in item ? (item as Track).estimatedHours : 1,
      orderIndex: 'orderIndex' in item ? (item as Course).orderIndex : 0,
      trackId: 'trackId' in item ? (item as Course).trackId : 0,
      isPublished: item.isPublished
    });
    setShowEditModal(true);
  };

  const applyTemplate = (template: ContentTemplate) => {
    setFormData(prev => ({
      ...prev,
      title: template.name,
      description: template.description,
      content: template.content
    }));
    setShowTemplateModal(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      difficultyLevel: 'beginner',
      estimatedHours: 1,
      orderIndex: 0,
      trackId: 0,
      isPublished: false
    });
  };

  // Filter content based on search and status
  const filteredTracks = tracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         track.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'published' && track.isPublished) ||
                         (statusFilter === 'draft' && !track.isPublished);
    return matchesSearch && matchesStatus;
  });

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'published' && course.isPublished) ||
                         (statusFilter === 'draft' && !course.isPublished);
    return matchesSearch && matchesStatus;
  });

  const currentData = activeTab === 'tracks' ? filteredTracks : filteredCourses;

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-300">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      {/* INDICATOR FOR WRONG COMPONENT */}
      <div className="bg-red-500 text-white text-center py-4 text-2xl font-bold">
        ❌ WRONG COMPONENT! This is Admin.tsx (Content Management Only) ❌
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Content Management</h1>
          <p className="text-gray-300">Create, edit, and manage learning content</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={() => setError('')}
              className="text-red-300 hover:text-red-200 mt-2 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'courses'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              Courses
            </button>
            <button
              onClick={() => setActiveTab('tracks')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'tracks'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              Learning Tracks
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 bg-gray-800 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none w-64"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ContentStatus)}
                  className="pl-10 pr-8 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none appearance-none"
                >
                  <option value="all">All Content</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              {selectedItems.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkOperation('publish')}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    Publish ({selectedItems.length})
                  </button>
                  <button
                    onClick={() => handleBulkOperation('unpublish')}
                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm"
                  >
                    Unpublish ({selectedItems.length})
                  </button>
                  <button
                    onClick={() => handleBulkOperation('delete')}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                  >
                    Delete ({selectedItems.length})
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                <PlusIcon className="h-5 w-5" />
                Create {activeTab === 'tracks' ? 'Track' : 'Course'}
              </button>
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading content...</p>
            </div>
          ) : currentData.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No {activeTab} found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === currentData.length && currentData.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(currentData.map(item => item.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                        className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    {activeTab === 'tracks' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Difficulty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Hours
                        </th>
                      </>
                    )}
                    {activeTab === 'courses' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Track
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {currentData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-700">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems([...selectedItems, item.id]);
                            } else {
                              setSelectedItems(selectedItems.filter(id => id !== item.id));
                            }
                          }}
                          className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">{item.title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300 max-w-xs truncate">{item.description}</div>
                      </td>
                      {activeTab === 'tracks' && (
                        <>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              (item as Track).difficultyLevel === 'beginner' ? 'bg-green-100 text-green-800' :
                              (item as Track).difficultyLevel === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {(item as Track).difficultyLevel}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {(item as Track).estimatedHours}h
                          </td>
                        </>
                      )}
                      {activeTab === 'courses' && (
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {(item as Course).trackTitle}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {item.isPublished ? (
                            <EyeIcon className="h-4 w-4 text-green-400 mr-2" />
                          ) : (
                            <EyeSlashIcon className="h-4 w-4 text-gray-400 mr-2" />
                          )}
                          <span className={`text-sm ${item.isPublished ? 'text-green-400' : 'text-gray-400'}`}>
                            {item.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">
                    Create New {activeTab === 'tracks' ? 'Learning Track' : 'Course'}
                  </h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                {activeTab === 'courses' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.content}
                        onChange={(value) => setFormData({...formData, content: value})}
                        placeholder="Create engaging course content with rich formatting..."
                        includeQATools={true}
                        height="400px"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Learning Track
                        </label>
                        <select
                          value={formData.trackId}
                          onChange={(e) => setFormData({...formData, trackId: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                          required
                        >
                          <option value={0}>Select a track</option>
                          {tracks.map(track => (
                            <option key={track.id} value={track.id}>{track.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Order Index
                        </label>
                        <input
                          type="number"
                          value={formData.orderIndex}
                          onChange={(e) => setFormData({...formData, orderIndex: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                          min={0}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'tracks' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Difficulty Level
                      </label>
                      <select
                        value={formData.difficultyLevel}
                        onChange={(e) => setFormData({...formData, difficultyLevel: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        value={formData.estimatedHours}
                        onChange={(e) => setFormData({...formData, estimatedHours: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        min={1}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="publishOnCreate"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({...formData, isPublished: e.target.checked})}
                    className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="publishOnCreate" className="ml-2 text-sm text-gray-300">
                    Publish immediately
                  </label>
                </div>

                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                      Use Template
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                    >
                      Create {activeTab === 'tracks' ? 'Track' : 'Course'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">
                    Edit {activeTab === 'tracks' ? 'Learning Track' : 'Course'}
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleEdit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                {activeTab === 'courses' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Content
                    </label>
                    <RichTextEditor
                      value={formData.content}
                      onChange={(value) => setFormData({...formData, content: value})}
                      placeholder="Edit course content with rich formatting..."
                      includeQATools={true}
                      height="400px"
                    />
                  </div>
                )}

                {activeTab === 'tracks' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Difficulty Level
                      </label>
                      <select
                        value={formData.difficultyLevel}
                        onChange={(e) => setFormData({...formData, difficultyLevel: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        value={formData.estimatedHours}
                        onChange={(e) => setFormData({...formData, estimatedHours: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        min={1}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="publishStatus"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({...formData, isPublished: e.target.checked})}
                    className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="publishStatus" className="ml-2 text-sm text-gray-300">
                    Published
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                  >
                    Update {activeTab === 'tracks' ? 'Track' : 'Course'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">Choose Template</h2>
                  <button
                    onClick={() => setShowTemplateModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 cursor-pointer"
                      onClick={() => applyTemplate(template)}
                    >
                      <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                      <p className="text-gray-300 text-sm mb-3">{template.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {template.sections.map((section, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-purple-600 text-purple-100 text-xs rounded"
                          >
                            {section}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin; 