import React from 'react';
import { useAuthStore } from '../stores/authStore';

const AdminTest: React.FC = () => {
  const { user, token, isAuthenticated } = useAuthStore();

  console.log('AdminTest component loaded');
  console.log('Auth state:', { user, token: token ? 'present' : 'missing', isAuthenticated });

  return (
    <div className="min-h-screen bg-red-500 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg p-6">
        <h1 className="text-3xl font-bold text-black mb-4">ADMIN TEST PAGE</h1>
        
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Authentication Status</h2>
            <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'YES' : 'NO'}</p>
            <p><strong>User Email:</strong> {user?.email || 'Not available'}</p>
            <p><strong>User Role:</strong> {user?.role || 'Not available'}</p>
            <p><strong>Token:</strong> {token ? 'Present' : 'Missing'}</p>
          </div>

          <div className="bg-blue-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Test Results</h2>
            {!isAuthenticated && <p className="text-red-600">❌ Not authenticated - you need to login first</p>}
            {isAuthenticated && user?.role !== 'admin' && <p className="text-red-600">❌ Not admin - user role is: {user?.role}</p>}
            {isAuthenticated && user?.role === 'admin' && <p className="text-green-600">✅ Admin access confirmed!</p>}
          </div>

          <div className="bg-yellow-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Next Steps</h2>
            {!isAuthenticated && (
              <p>Please go to <a href="/login" className="text-blue-600 underline">login page</a> and login with admin credentials.</p>
            )}
            {isAuthenticated && user?.role !== 'admin' && (
              <p>You are logged in but need admin privileges. Contact an administrator.</p>
            )}
            {isAuthenticated && user?.role === 'admin' && (
              <p>Admin access confirmed! You should be able to access the admin dashboard.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTest; 