import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Track {
  id: number;
  title: string;
  description: string;
  difficultyLevel: string;
  estimatedHours: number;
  isPublished: boolean;
  createdAt: string;
}

const Courses: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('All Levels');

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      
      // Try the direct content service endpoint first
      let response = await fetch('http://localhost:8000/tracks');
      
      if (!response.ok) {
        // Fallback to API gateway endpoint
        response = await fetch('/api/content/tracks');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch tracks');
      }
      
      const data = await response.json();
      setTracks(data.tracks || []);
    } catch (err) {
      console.error('Error fetching tracks:', err);
      
      // Fallback to mock data when backend is not available
      console.warn('Backend not available, using mock data for development');
      const mockTracks: Track[] = [
        {
          id: 1,
          title: 'QA Fundamentals',
          description: 'Learn the basics of quality assurance and testing methodologies. This comprehensive course covers manual testing, test planning, and bug reporting.',
          difficultyLevel: 'beginner',
          estimatedHours: 20,
          isPublished: true,
          createdAt: '2025-06-08T14:09:00.805Z'
        },
        {
          id: 2,
          title: 'Test Automation Basics',
          description: 'Introduction to automated testing tools and frameworks. Learn Selenium WebDriver, API testing, and continuous integration.',
          difficultyLevel: 'intermediate',
          estimatedHours: 30,
          isPublished: true,
          createdAt: '2025-06-08T14:09:00.805Z'
        },
        {
          id: 3,
          title: 'Advanced Testing Techniques',
          description: 'Master advanced testing strategies and best practices. Performance testing, security testing, and test architecture.',
          difficultyLevel: 'advanced',
          estimatedHours: 40,
          isPublished: true,
          createdAt: '2025-06-08T14:09:00.805Z'
        },
        {
          id: 4,
          title: 'Mobile Testing Essentials',
          description: 'Learn mobile application testing for iOS and Android platforms. Device testing, emulators, and mobile-specific challenges.',
          difficultyLevel: 'intermediate',
          estimatedHours: 25,
          isPublished: true,
          createdAt: '2025-06-08T14:09:00.805Z'
        }
      ];
      
      setTracks(mockTracks);
      
      // Only set error if it's a real error, not just backend unavailable
      if (err instanceof Error && !err.message.includes('fetch')) {
        setError('Failed to load courses. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTracks = tracks.filter(track => 
    selectedLevel === 'All Levels' || track.difficultyLevel === selectedLevel.toLowerCase()
  );

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'badge-success';
      case 'intermediate':
        return 'badge-warning';
      case 'advanced':
        return 'badge-error';
      default:
        return 'badge-primary';
    }
  };

  const getDifficultyLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Courses</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Courses</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Courses</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchTracks}
            className="mt-4 btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Learning Tracks</h1>
        <div className="flex space-x-4">
          <select 
            className="input"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option>All Levels</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No courses found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedLevel === 'All Levels' 
              ? 'No courses are available at the moment.'
              : `No ${selectedLevel.toLowerCase()} courses are available.`
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTracks.map((track) => (
            <div key={track.id} className="bg-white rounded-xl p-6 shadow-card hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <span className={`badge ${getDifficultyColor(track.difficultyLevel)}`}>
                  {getDifficultyLabel(track.difficultyLevel)}
                </span>
                <span className="text-sm text-gray-500">{track.estimatedHours} hours</span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">{track.title}</h3>
              <p className="text-gray-600 mb-4 line-clamp-3">{track.description}</p>
              
              <div className="flex space-x-2">
                <Link
                  to={`/courses/${track.id}`}
                  className="btn-primary flex-1 text-center"
                >
                  View Track
                </Link>
                <button className="btn-secondary">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Courses; 