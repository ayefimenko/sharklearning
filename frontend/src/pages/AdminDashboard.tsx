import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ChartBarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import RichTextEditor from '../components/RichTextEditor';

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

interface Course {
  id: number;
  title: string;
  description: string;
  content?: string;
  trackId: number;
  trackTitle: string;
  orderIndex: number;
  isPublished: boolean;
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

type AdminTab = 'users' | 'courses' | 'paths' | 'analytics';

const AdminDashboard: React.FC = () => {
  const { user, token, isAuthenticated } = useAuthStore();
  
  console.log('AdminDashboard render:', { user: user?.email, role: user?.role, isAuthenticated, token: token ? 'present' : 'missing' });
  
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'student',
    isActive: true,
    title: '',
    description: '',
    content: '',
    difficultyLevel: 'beginner',
    estimatedHours: 1,
    trackId: 0,
    orderIndex: 0,
    isPublished: false
  });

  useEffect(() => {
    console.log('AdminDashboard useEffect1:', { isAuthenticated, userRole: user?.role, token: token ? 'present' : 'missing' });
    if (isAuthenticated && user?.role === 'admin' && token) {
      apiClient.setToken(token);
      fetchData();
    } else if (!isAuthenticated) {
      setError('Authentication required');
      console.log('Setting error: Authentication required');
    } else if (user?.role !== 'admin') {
      setError('Admin access required');
      console.log('Setting error: Admin access required, user role:', user?.role);
    }
  }, [isAuthenticated, user, token]);

  useEffect(() => {
    console.log('AdminDashboard useEffect2:', { activeTab, userRole: user?.role, token: token ? 'present' : 'missing' });
    if (user?.role === 'admin' && token) {
      apiClient.setToken(token);
      fetchData();
    }
  }, [activeTab, user, token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Fetching data for tab:', activeTab);

      if (activeTab === 'users') {
        await fetchUsers();
      } else if (activeTab === 'courses') {
        await fetchCourses();
      } else if (activeTab === 'paths') {
        await fetchPaths();
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    console.log('Fetching users...');
    try {
      const data = await apiClient.getUsers() as { users: User[] };
      console.log('Users data received:', data);
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      throw err;
    }
  };

  const fetchCourses = async () => {
    const data = await apiClient.getContent('courses') as { content: { courses: Course[] } };
    setCourses(data.content?.courses || []);
  };

  const fetchPaths = async () => {
    const data = await apiClient.getLearningPaths() as { paths: LearningPath[] };
    setPaths(data.paths || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      switch (activeTab) {
        case 'users':
          await apiClient.createUser({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            role: formData.role
          });
          break;
        case 'courses':
          await apiClient.createCourse({
            title: formData.title,
            description: formData.description,
            content: formData.content,
            trackId: formData.trackId,
            orderIndex: formData.orderIndex
          });
          break;
        case 'paths':
          await apiClient.createTrack({
            title: formData.title,
            description: formData.description,
            difficultyLevel: formData.difficultyLevel,
            estimatedHours: formData.estimatedHours
          });
          break;
      }

      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      switch (activeTab) {
        case 'users':
          await apiClient.updateUser(editingItem.id, {
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            role: formData.role,
            isActive: formData.isActive
          });
          break;
        case 'courses':
          await apiClient.updateCourse(editingItem.id, {
            title: formData.title,
            description: formData.description,
            content: formData.content,
            orderIndex: formData.orderIndex,
            isPublished: formData.isPublished
          });
          break;
        case 'paths':
          await apiClient.updateTrack(editingItem.id, {
            title: formData.title,
            description: formData.description,
            difficultyLevel: formData.difficultyLevel,
            estimatedHours: formData.estimatedHours,
            isPublished: formData.isPublished
          });
          break;
      }

      setShowEditModal(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      switch (activeTab) {
        case 'users':
          await apiClient.deleteUser(id);
          break;
        case 'courses':
          await apiClient.deleteCourse(id);
          break;
        case 'paths':
          await apiClient.deleteTrack(id);
          break;
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    
    if (activeTab === 'users') {
      setFormData({
        ...formData,
        email: item.email,
        firstName: item.firstName,
        lastName: item.lastName,
        role: item.role,
        isActive: item.isActive
      });
    } else if (activeTab === 'courses') {
      setFormData({
        ...formData,
        title: item.title,
        description: item.description,
        content: item.content || '',
        orderIndex: item.orderIndex,
        isPublished: item.isPublished
      });
    } else if (activeTab === 'paths') {
      setFormData({
        ...formData,
        title: item.title,
        description: item.description,
        difficultyLevel: item.difficultyLevel,
        estimatedHours: item.estimatedHours,
        isPublished: item.isPublished
      });
    }
    
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'student',
      isActive: true,
      title: '',
      description: '',
      content: '',
      difficultyLevel: 'beginner',
      estimatedHours: 1,
      trackId: 0,
      orderIndex: 0,
      isPublished: false
    });
  };

  // Filter data based on search and status
  const getFilteredData = () => {
    let data: any[] = [];
    
    switch (activeTab) {
      case 'users':
        data = users;
        break;
      case 'courses':
        data = courses;
        break;
      case 'paths':
        data = paths;
        break;
      default:
        return [];
    }

    return data.filter(item => {
      const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        if (activeTab === 'users') {
          matchesStatus = statusFilter === 'active' ? item.isActive : !item.isActive;
        } else {
          matchesStatus = statusFilter === 'published' ? item.isPublished : !item.isPublished;
        }
      }
      
      return matchesSearch && matchesStatus;
    });
  };

  const currentData = getFilteredData();

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
      {/* HUGE VISIBLE INDICATOR */}
      <div className="bg-green-500 text-white text-center py-4 text-2xl font-bold">
        🎉 ADMIN DASHBOARD COMPONENT LOADED SUCCESSFULLY! 🎉
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-300">Manage users, courses, and learning paths</p>
        </div>

        {/* Debug Info */}
        <div className="mb-6 bg-blue-500/10 border border-blue-500 rounded-lg p-4">
          <h3 className="text-blue-400 font-semibold mb-2">Debug Info:</h3>
          <div className="text-blue-300 text-sm space-y-1">
            <p>Active Tab: {activeTab}</p>
            <p>Users Count: {users.length}</p>
            <p>Courses Count: {courses.length}</p>
            <p>Paths Count: {paths.length}</p>
            <p>Loading: {loading.toString()}</p>
            <p>Error: {error || 'None'}</p>
            <p>Current Data Length: {currentData.length}</p>
            <p>User Role: {user?.role}</p>
            <p>Is Authenticated: {isAuthenticated.toString()}</p>
          </div>
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
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'courses'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <BookOpenIcon className="h-4 w-4" />
              Courses
            </button>
            <button
              onClick={() => setActiveTab('paths')}
              className={`flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'paths'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <AcademicCapIcon className="h-4 w-4" />
              Learning Paths
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <ChartBarIcon className="h-4 w-4" />
              Analytics
            </button>
          </div>
        </div>

        {activeTab !== 'analytics' && (
          <>
            {/* Controls */}
            <div className="mb-6 bg-gray-800 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Search ${activeTab}...`}
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
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="pl-10 pr-8 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none appearance-none"
                    >
                      <option value="all">All {activeTab}</option>
                      {activeTab === 'users' ? (
                        <>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </>
                      ) : (
                        <>
                          <option value="published">Published</option>
                          <option value="draft">Drafts</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  <PlusIcon className="h-5 w-5" />
                  Create {activeTab.slice(0, -1)}
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading {activeTab}...</p>
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
                        {activeTab === 'users' && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                          </>
                        )}
                        {activeTab === 'courses' && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Track</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                          </>
                        )}
                        {activeTab === 'paths' && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Difficulty</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Courses</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Students</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                          </>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {currentData.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-700/50">
                          {activeTab === 'users' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-white">
                                {item.firstName} {item.lastName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  item.role === 'admin' ? 'bg-red-100 text-red-800' :
                                  item.role === 'instructor' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {item.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </td>
                            </>
                          )}
                          {activeTab === 'courses' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-white">{item.title}</td>
                              <td className="px-6 py-4 text-gray-300 max-w-xs truncate">{item.description}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.trackTitle}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  item.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {item.isPublished ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </td>
                            </>
                          )}
                          {activeTab === 'paths' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-white">{item.title}</td>
                              <td className="px-6 py-4 text-gray-300 max-w-xs truncate">{item.description}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  item.difficultyLevel === 'beginner' ? 'bg-green-100 text-green-800' :
                                  item.difficultyLevel === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {item.difficultyLevel}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.courseCount}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.enrolledUsers}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  item.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {item.isPublished ? 'Published' : 'Draft'}
                                </span>
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex gap-2">
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
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Total Users</h3>
              <p className="text-3xl font-bold text-purple-400">{users.length}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Total Courses</h3>
              <p className="text-3xl font-bold text-blue-400">{courses.length}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Learning Paths</h3>
              <p className="text-3xl font-bold text-green-400">{paths.length}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Active Users</h3>
              <p className="text-3xl font-bold text-yellow-400">
                {users.filter(u => u.isActive).length}
              </p>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">
                Create New {activeTab.slice(0, -1)}
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                {activeTab === 'users' && (
                  <>
                    <input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    >
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </>
                )}
                {(activeTab === 'courses' || activeTab === 'paths') && (
                  <>
                    <input
                      type="text"
                      placeholder="Title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <textarea
                      placeholder="Description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      rows={3}
                    />
                    {activeTab === 'courses' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Course Content
                        </label>
                        <RichTextEditor
                          value={formData.content}
                          onChange={(value) => setFormData({...formData, content: value})}
                          placeholder="Enter course content with rich formatting..."
                          includeQATools={true}
                          height="300px"
                        />
                      </div>
                    )}
                    {activeTab === 'paths' && (
                      <>
                        <select
                          value={formData.difficultyLevel}
                          onChange={(e) => setFormData({...formData, difficultyLevel: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                        <input
                          type="number"
                          placeholder="Estimated Hours"
                          value={formData.estimatedHours}
                          onChange={(e) => setFormData({...formData, estimatedHours: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                          min="1"
                        />
                      </>
                    )}
                  </>
                )}
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {setShowCreateModal(false); resetForm();}}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">
                Edit {activeTab.slice(0, -1)}
              </h2>
              <form onSubmit={handleEdit} className="space-y-4">
                {activeTab === 'users' && (
                  <>
                    <input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    >
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <label className="flex items-center text-gray-300">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                        className="mr-2"
                      />
                      Active User
                    </label>
                  </>
                )}
                {(activeTab === 'courses' || activeTab === 'paths') && (
                  <>
                    <input
                      type="text"
                      placeholder="Title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                    <textarea
                      placeholder="Description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      rows={3}
                    />
                    {activeTab === 'courses' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Course Content
                        </label>
                        <RichTextEditor
                          value={formData.content}
                          onChange={(value) => setFormData({...formData, content: value})}
                          placeholder="Edit course content with rich formatting..."
                          includeQATools={true}
                          height="300px"
                        />
                      </div>
                    )}
                    {activeTab === 'paths' && (
                      <>
                        <select
                          value={formData.difficultyLevel}
                          onChange={(e) => setFormData({...formData, difficultyLevel: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                        <input
                          type="number"
                          placeholder="Estimated Hours"
                          value={formData.estimatedHours}
                          onChange={(e) => setFormData({...formData, estimatedHours: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                          min="1"
                        />
                      </>
                    )}
                    <label className="flex items-center text-gray-300">
                      <input
                        type="checkbox"
                        checked={formData.isPublished}
                        onChange={(e) => setFormData({...formData, isPublished: e.target.checked})}
                        className="mr-2"
                      />
                      Published
                    </label>
                  </>
                )}
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => {setShowEditModal(false); setEditingItem(null); resetForm();}}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 