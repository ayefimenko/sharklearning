import React from 'react';
import { useParams } from 'react-router-dom';

const CourseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-card">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Course Detail</h1>
        <p className="text-gray-600">Course ID: {id}</p>
        <p className="text-gray-600 mt-2">This page will show detailed course content and lessons.</p>
      </div>
    </div>
  );
};

export default CourseDetail; 