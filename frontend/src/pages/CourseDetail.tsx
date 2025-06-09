import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import RichTextDisplay from '../components/RichTextDisplay';
import LessonViewer from '../components/LessonViewer';

interface Course {
  id: number;
  title: string;
  description: string;
  content: string;
  orderInTrack: number;
  isPublished: boolean;
  createdAt: string;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  maxAttempts: number;
  lessonId: number;
  lessonTitle: string;
  lessonOrder: number;
}

interface Track {
  id: number;
  title: string;
  description: string;
  difficultyLevel: string;
  estimatedHours: number;
  isPublished: boolean;
  createdAt: string;
  courses: Course[];
}

const CourseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuthStore();
  const [track, setTrack] = useState<Track | null>(null);
  const [currentCourseIndex, setCurrentCourseIndex] = useState(0);
  const [courseProgress, setCourseProgress] = useState<Record<number, number>>({});
  const [completedCourses, setCompletedCourses] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [showLessons, setShowLessons] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchTrackDetail(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    if (track && token) {
      fetchUserProgress();
    }
  }, [track, token]);



  const fetchTrackDetail = async (trackId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content/tracks/${trackId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Learning track not found');
        }
        throw new Error('Failed to fetch track details');
      }
      
      const data = await response.json();
      
      // Combine track and courses data as expected by the component
      const trackWithCourses = {
        ...data.track,
        courses: data.courses || []
      };
      
      // Sort courses by order index
      if (trackWithCourses.courses) {
        trackWithCourses.courses.sort((a: Course, b: Course) => a.orderInTrack - b.orderInTrack);
      }
      
      setTrack(trackWithCourses);
      
    } catch (err) {
      console.error('Error fetching track detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load track details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProgress = async () => {
    if (!track || !token) return;

    try {
      const progressPromises = track.courses.map(async (course) => {
        const response = await fetch(`/api/progress/courses/${course.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          return {
            courseId: course.id,
            progressPercentage: data.progressPercentage || 0,
            isCompleted: data.isCompleted || false,
          };
        }
        return {
          courseId: course.id,
          progressPercentage: 0,
          isCompleted: false,
        };
      });

      const progressResults = await Promise.all(progressPromises);
      
      const progressMap: Record<number, number> = {};
      const completedSet = new Set<number>();
      
      progressResults.forEach(({ courseId, progressPercentage, isCompleted }) => {
        progressMap[courseId] = progressPercentage;
        if (isCompleted) {
          completedSet.add(courseId);
        }
      });
      
      setCourseProgress(progressMap);
      setCompletedCourses(completedSet);
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  };

  const updateCourseProgress = async (courseId: number, progressPercentage: number, isCompleted: boolean = false) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/progress/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          progressPercentage,
          isCompleted,
        }),
      });

      if (response.ok) {
        setCourseProgress(prev => ({ ...prev, [courseId]: progressPercentage }));
        if (isCompleted) {
          setCompletedCourses(prev => new Set([...prev, courseId]));
        }
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const fetchQuizzes = async (courseId: number) => {
    try {
      setLoadingQuizzes(true);
      const response = await fetch(`/api/content/courses/${courseId}/quizzes`);
      
      if (response.ok) {
        const data = await response.json();
        setQuizzes(data.quizzes || []);
      } else {
        setQuizzes([]);
      }
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      setQuizzes([]);
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getDifficultyLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };



  const currentCourse = track?.courses[currentCourseIndex];
  
  // Calculate real progress based on completed courses
  const completedCount = track?.courses.filter(course => completedCourses.has(course.id)).length || 0;
  const progress = track?.courses ? (completedCount / track.courses.length) * 100 : 0;

  // Fetch quizzes when current course changes
  useEffect(() => {
    if (currentCourse) {
      fetchQuizzes(currentCourse.id);
    }
  }, [currentCourse]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Track</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={() => fetchTrackDetail(parseInt(id!))}
              className="btn-primary"
            >
              Try Again
            </button>
            <Link to="/courses" className="btn-secondary">
              Back to Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Track not found</p>
        <Link to="/courses" className="btn-primary mt-4">
          Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <Link 
            to="/courses" 
            className="flex items-center text-purple-100 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Courses
          </Link>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(track.difficultyLevel)}`}>
            {getDifficultyLabel(track.difficultyLevel)}
          </span>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">{track.title}</h1>
        <p className="text-purple-100 text-lg mb-4">{track.description}</p>
        
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {track.estimatedHours} hours
          </div>
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {track.courses.length} courses
          </div>
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {Math.round(progress)}% Complete
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Course Navigation Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-card p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Contents</h3>
            <div className="space-y-2">
              {track.courses.map((course, index) => (
                <button
                  key={course.id}
                  onClick={() => setCurrentCourseIndex(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    index === currentCourseIndex
                      ? 'bg-purple-100 border-2 border-purple-500 text-purple-900'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                      completedCourses.has(course.id)
                        ? 'bg-green-500 text-white' 
                        : index === currentCourseIndex
                        ? 'bg-purple-500 text-white'
                        : courseProgress[course.id] > 0
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {completedCourses.has(course.id) ? '✓' : courseProgress[course.id] > 0 ? '◐' : index + 1}
                    </div>
                      <div>
                        <p className="font-medium text-sm">{course.title}</p>
                        <p className="text-xs text-gray-500">Lesson {index + 1}</p>
                      </div>
                    </div>
                    {index === currentCourseIndex && (
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          {currentCourse && (
            <div className="bg-white rounded-xl shadow-card">
              {/* Course Header */}
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">{currentCourse.title}</h2>
                  <span className="text-sm text-gray-500">
                    Lesson {currentCourseIndex + 1} of {track.courses.length}
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{currentCourse.description}</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowContent(!showContent);
                      setShowLessons(false);
                      if (!showContent && currentCourse && courseProgress[currentCourse.id] === 0) {
                        // Mark as started (25% progress)
                        updateCourseProgress(currentCourse.id, 25);
                      }
                    }}
                    className="btn-secondary"
                  >
                    {showContent ? 'Hide Overview' : 'Course Overview'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowLessons(!showLessons);
                      setShowContent(false);
                      if (!showLessons && currentCourse && courseProgress[currentCourse.id] === 0) {
                        // Mark as started (25% progress)
                        updateCourseProgress(currentCourse.id, 25);
                      }
                    }}
                    className="btn-primary"
                  >
                    {showLessons ? 'Hide Lessons' : completedCourses.has(currentCourse?.id || 0) ? 'Continue Learning' : 'Start Learning'}
                  </button>
                </div>
              </div>

              {/* Course Content */}
              {showContent && (
                <div className="p-6">
                  <RichTextDisplay 
                    content={currentCourse.content}
                    className="prose prose-lg max-w-none"
                  />
                </div>
              )}

              {/* Lesson Viewer */}
              {showLessons && currentCourse && (
                <div className="p-6">
                  <LessonViewer 
                    courseId={currentCourse.id}
                    courseName={currentCourse.title}
                    onProgressUpdate={(progress) => {
                      if (progress === 100) {
                        updateCourseProgress(currentCourse.id, 100, true);
                      } else {
                        updateCourseProgress(currentCourse.id, Math.max(25, progress));
                      }
                    }}
                  />
                </div>
              )}

              {/* Quizzes Section */}
              {showContent && quizzes.length > 0 && (
                <div className="border-t border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Practice Quizzes
                  </h3>
                  
                  {loadingQuizzes ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {quizzes.map((quiz) => (
                        <div key={quiz.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-purple-900 mb-2">{quiz.title}</h4>
                              <p className="text-purple-700 text-sm mb-3">{quiz.description}</p>
                              
                              <div className="flex items-center space-x-4 text-xs text-purple-600">
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {quiz.timeLimitMinutes} minutes
                                </div>
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {quiz.passingScore}% to pass
                                </div>
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  {quiz.maxAttempts} attempts
                                </div>
                              </div>
                            </div>
                            
                            <Link
                              to={`/quiz/${quiz.id}`}
                              className="ml-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center"
                            >
                              Start Quiz
                              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="border-t border-gray-200 p-6">
                {/* Mark as Complete Button */}
                {showContent && currentCourse && !completedCourses.has(currentCourse.id) && (
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        updateCourseProgress(currentCourse.id, 100, true);
                      }}
                      className="btn-primary w-full"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Mark as Complete
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentCourseIndex(Math.max(0, currentCourseIndex - 1))}
                    disabled={currentCourseIndex === 0}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      currentCourseIndex === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>

                  <button
                    onClick={() => {
                      const nextIndex = Math.min(track.courses.length - 1, currentCourseIndex + 1);
                      setCurrentCourseIndex(nextIndex);
                      setShowContent(false); // Hide content when moving to next course
                    }}
                    disabled={currentCourseIndex === track.courses.length - 1}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      currentCourseIndex === track.courses.length - 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                  >
                    Next
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {completedCount === track.courses.length && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-green-800">Congratulations!</h4>
                        <p className="text-sm text-green-700 mt-1">
                          You've completed the {track.title} learning track! 🎉
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          You've earned points and may have unlocked achievements!
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex space-x-3">
                      <Link
                        to="/courses"
                        className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-600"
                      >
                        Explore more courses
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                      <Link
                        to="/profile"
                        className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-600"
                      >
                        View achievements
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDetail; 