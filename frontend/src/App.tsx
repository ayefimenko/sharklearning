import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Quiz from './pages/Quiz';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import LearningPaths from './pages/LearningPaths';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  console.log('App component is rendering');
  
  // Add error boundary for debugging
  const [hasError, setHasError] = React.useState(false);
  
  React.useEffect(() => {
    console.log('App component mounted');
    const errorHandler = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      setHasError(true);
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600 mb-4">Error Detected</h1>
          <p className="text-gray-600">Check browser console for details</p>
        </div>
      </div>
    );
  }

  const { isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(true);

  console.log('Auth state:', { isAuthenticated, user: user?.email });

  React.useEffect(() => {
    // Add a small delay to check auth state
    const timer = setTimeout(() => {
      console.log('Loading complete');
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    console.log('Showing loading screen');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-purple-600 mb-4">SharkLearning</h1>
          <p className="text-gray-600">Loading application...</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  console.log('Rendering main app content');

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Toaster position="top-right" />
          <Routes>
            {/* Public routes */}
            <Route 
              path="/login" 
              element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/register" 
              element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} 
            />
            
            {/* Protected routes */}
            <Route 
              path="/*" 
              element={
                isAuthenticated ? (
                  <Layout>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/courses" element={<Courses />} />
                      <Route path="/courses/:id" element={<CourseDetail />} />
                      <Route path="/quiz/:courseId" element={<Quiz />} />
                      <Route path="/learning-paths" element={<LearningPaths />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/settings" element={<Settings />} />
                      {user?.role === 'admin' && (
                        <Route path="/admin" element={<Admin />} />
                      )}
                      <Route path="/" element={<Navigate to="/dashboard" />} />
                    </Routes>
                  </Layout>
                ) : (
                  <Navigate to="/login" />
                )
              } 
            />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App; 