import React from 'react';
import { useAuthStore } from '@/stores/authStore';

const Profile: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-card">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input
              type="text"
              className="input"
              value={user?.firstName || ''}
              readOnly
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input
              type="text"
              className="input"
              value={user?.lastName || ''}
              readOnly
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              className="input"
              value={user?.email || ''}
              readOnly
            />
          </div>
        </div>
        
        <div className="mt-6">
          <button className="btn-primary">Edit Profile</button>
        </div>
      </div>
    </div>
  );
};

export default Profile; 