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
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';

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

interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  sections: string[];
}

type ContentType = 'tracks' | 'courses';
type ContentStatus = 'all' | 'published' | 'draft';

const Admin: React.FC = () => {
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ContentType>('courses');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
    if (!user || user.role !== 'admin') {
      setError('Admin access required');
      return;
    }
    fetchContent();
    fetchTemplates();
  }, [user, token]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/content/admin/content?type=${activeTab}&status=${statusFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }

      const data = await response.json();
      
      if (data.content.tracks) {
        setTracks(data.content.tracks);
      }
      if (data.content.courses) {
        setCourses(data.content.courses);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/content/admin/templates', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const endpoint = activeTab === 'tracks' ? '/tracks' : '/courses';
      const payload = activeTab === 'tracks' 
        ? {
            title: formData.title,
            description: formData.description,
            difficultyLevel: formData.difficultyLevel,
            estimatedHours: formData.estimatedHours
          }
        : {
            title: formData.title,
            description: formData.description,
            content: formData.content,
            trackId: formData.trackId,
            orderIndex: formData.orderIndex
          };

      const response = await fetch(`http://localhost:8000/api/content${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create content');
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
      const endpoint = activeTab === 'tracks' ? `/tracks/${editingItem.id}` : `/courses/${editingItem.id}`;
      const payload = activeTab === 'tracks' 
        ? {
            title: formData.title,
            description: formData.description,
            difficultyLevel: formData.difficultyLevel,
            estimatedHours: formData.estimatedHours,
            isPublished: formData.isPublished
          }
        : {
            title: formData.title,
            description: formData.description,
            content: formData.content,
            orderIndex: formData.orderIndex,
            isPublished: formData.isPublished
          };

      const response = await fetch(`http://localhost:8000/api/content${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update content');
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
      const endpoint = activeTab === 'tracks' ? `/tracks/${id}` : `/courses/${id}`;
      const response = await fetch(`http://localhost:8000/api/content${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete content');
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
      const response = await fetch('http://localhost:8000/api/content/admin/content/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operation,
          type: activeTab,
          ids: selectedItems
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform bulk operation');
      }

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
      difficultyLevel: 'difficultyLevel' in item ? item.difficultyLevel : 'beginner',
      estimatedHours: 'estimatedHours' in item ? item.estimatedHours : 1,
      orderIndex: 'orderIndex' in item ? item.orderIndex : 0,
      trackId: 'trackId' in item ? item.trackId : 0,
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
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-200 mt-2 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Coming Soon Message */}
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">🚀 Content Management System</h2>
          <p className="text-gray-300 mb-6">
            Advanced content authoring tools are coming soon! This will include:
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-400 mb-2">📝 Rich Content Editor</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Markdown support with live preview</li>
                <li>• Drag-and-drop media uploads</li>
                <li>• Code syntax highlighting</li>
                <li>• Interactive elements</li>
              </ul>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-400 mb-2">📚 Content Templates</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• QA-specific course templates</li>
                <li>• Pre-built lesson structures</li>
                <li>• Assessment templates</li>
                <li>• Best practice examples</li>
              </ul>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-400 mb-2">⚡ Bulk Operations</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Bulk publish/unpublish</li>
                <li>• Content import/export</li>
                <li>• Version control</li>
                <li>• Content analytics</li>
              </ul>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-400 mb-2">🎯 Advanced Features</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Content scheduling</li>
                <li>• Collaboration tools</li>
                <li>• Review workflows</li>
                <li>• Performance tracking</li>
              </ul>
            </div>
          </div>
          <div className="mt-8">
            <div className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg">
              <span className="animate-pulse mr-2">●</span>
              Backend APIs ready - Frontend implementation in progress
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin; 