import React from 'react';

const Courses: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Courses</h1>
        <div className="flex space-x-4">
          <select className="input">
            <option>All Levels</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <span className="badge badge-primary">Beginner</span>
            <span className="text-sm text-gray-500">20 hours</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">QA Fundamentals</h3>
          <p className="text-gray-600 mb-4">Learn the basics of software testing and quality assurance</p>
          <button className="btn-primary w-full">Start Learning</button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <span className="badge badge-warning">Intermediate</span>
            <span className="text-sm text-gray-500">30 hours</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Test Automation</h3>
          <p className="text-gray-600 mb-4">Introduction to automated testing tools and frameworks</p>
          <button className="btn-secondary w-full">Coming Soon</button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <span className="badge badge-error">Advanced</span>
            <span className="text-sm text-gray-500">40 hours</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Advanced Testing</h3>
          <p className="text-gray-600 mb-4">Advanced techniques for comprehensive software testing</p>
          <button className="btn-secondary w-full">Coming Soon</button>
        </div>
      </div>
    </div>
  );
};

export default Courses; 