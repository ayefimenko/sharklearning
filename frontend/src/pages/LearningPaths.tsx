import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface Skill {
  id: number;
  name: string;
  description: string;
  category: string;
  levelDescription: any;
  icon: string;
}

interface LearningPath {
  id: number;
  title: string;
  description: string;
  targetRole: string;
  difficultyProgression: any;
  estimatedWeeks: number;
  skillsGained: any[];
  isCertificationPath: boolean;
  totalItems: number;
  enrolledUsers: number;
  createdAt: string;
  updatedAt: string;
}

interface UserLearningPath {
  enrollmentId: number;
  learningPath: LearningPath;
  progress: {
    percentage: number;
    isCompleted: boolean;
    currentItemOrder: number;
    totalItems: number;
  };
  timeline: {
    startedAt: string;
    completedAt?: string;
    estimatedCompletion: string;
  };
}

const LearningPaths: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'browse' | 'my-paths' | 'skills'>('browse');
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [myPaths, setMyPaths] = useState<UserLearningPath[]>([]);
  const [skills, setSkills] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showCertificationOnly, setShowCertificationOnly] = useState(false);

  // Mock data for demonstration (since backend endpoints are having issues)
  const mockLearningPaths: LearningPath[] = [
    {
      id: 1,
      title: 'Junior QA Engineer Track',
      description: 'Complete learning path from beginner to job-ready Junior QA Engineer. Master manual testing, test planning, and bug reporting fundamentals.',
      targetRole: 'junior-qa',
      difficultyProgression: { start: 'beginner', end: 'intermediate' },
      estimatedWeeks: 16,
      skillsGained: [
        { skill: 'Manual Testing', level: 'intermediate' },
        { skill: 'Test Planning', level: 'intermediate' },
        { skill: 'Bug Reporting', level: 'intermediate' }
      ],
      isCertificationPath: true,
      totalItems: 2,
      enrolledUsers: 45,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 2,
      title: 'QA Automation Engineer Track',
      description: 'Advanced path focusing on test automation and tools. Learn Selenium, API testing, and performance testing.',
      targetRole: 'automation-engineer',
      difficultyProgression: { start: 'intermediate', end: 'advanced' },
      estimatedWeeks: 20,
      skillsGained: [
        { skill: 'Test Automation', level: 'advanced' },
        { skill: 'Selenium WebDriver', level: 'advanced' },
        { skill: 'API Testing', level: 'intermediate' }
      ],
      isCertificationPath: true,
      totalItems: 2,
      enrolledUsers: 32,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 3,
      title: 'Senior QA Engineer Track',
      description: 'Leadership and advanced testing strategy path. Develop communication, problem-solving, and strategic thinking skills.',
      targetRole: 'senior-qa',
      difficultyProgression: { start: 'intermediate', end: 'advanced' },
      estimatedWeeks: 24,
      skillsGained: [
        { skill: 'Test Planning', level: 'advanced' },
        { skill: 'Problem Solving', level: 'advanced' },
        { skill: 'Communication', level: 'advanced' }
      ],
      isCertificationPath: true,
      totalItems: 2,
      enrolledUsers: 18,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
  ];

  const mockMyPaths: UserLearningPath[] = [
    {
      enrollmentId: 1,
      learningPath: mockLearningPaths[0],
      progress: {
        percentage: 65,
        isCompleted: false,
        currentItemOrder: 1,
        totalItems: 2
      },
      timeline: {
        startedAt: '2024-01-15',
        estimatedCompletion: '2024-05-15'
      }
    }
  ];

  const mockSkills = {
    userSkills: [
      {
        skillId: 1,
        skill: {
          name: 'Manual Testing',
          description: 'Ability to design and execute manual test cases effectively',
          category: 'technical',
          levelDescription: {
            beginner: 'Can execute basic test cases',
            intermediate: 'Can design comprehensive test scenarios',
            advanced: 'Can lead testing strategy and mentor others'
          },
          icon: '🧪'
        },
        currentLevel: 'intermediate',
        evidenceCount: 3,
        lastImproved: '2024-01-20'
      },
      {
        skillId: 2,
        skill: {
          name: 'Test Planning',
          description: 'Creating comprehensive test plans and strategies',
          category: 'methodologies',
          levelDescription: {
            beginner: 'Can follow existing test plans',
            intermediate: 'Can create detailed test plans',
            advanced: 'Can design enterprise testing strategies'
          },
          icon: '📋'
        },
        currentLevel: 'beginner',
        evidenceCount: 1,
        lastImproved: '2024-01-10'
      }
    ],
    availableSkills: [
      {
        id: 3,
        name: 'Test Automation',
        description: 'Skills in automated testing tools and frameworks',
        category: 'technical',
        levelDescription: {
          beginner: 'Basic scripting with automation tools',
          intermediate: 'Can build robust test frameworks',
          advanced: 'Can architect enterprise automation solutions'
        },
        icon: '🤖'
      }
    ],
    skillStats: {
      totalSkills: 2,
      skillsByLevel: {
        beginner: 1,
        intermediate: 1,
        advanced: 0,
        expert: 0
      }
    }
  };

  useEffect(() => {
    // Simulate API calls
    setTimeout(() => {
      setLearningPaths(mockLearningPaths);
      setMyPaths(mockMyPaths);
      setSkills(mockSkills);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredPaths = learningPaths.filter(path => {
    if (selectedRole && path.targetRole !== selectedRole) return false;
    if (showCertificationOnly && !path.isCertificationPath) return false;
    return true;
  });

  const enrollInPath = async (pathId: number) => {
    // Mock enrollment
    alert(`Enrolled in learning path ${pathId}! Check "My Learning Paths" tab.`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-blue-100 text-blue-800';
      case 'intermediate': return 'bg-purple-100 text-purple-800';
      case 'advanced': return 'bg-orange-100 text-orange-800';
      case 'expert': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading learning paths...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🎯 Learning Paths & Curriculum</h1>
          <p className="mt-2 text-gray-600">
            Structured learning progressions designed to advance your QA career
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'browse', label: 'Browse Paths', icon: '🗺️' },
              { id: 'my-paths', label: 'My Learning Paths', icon: '📚' },
              { id: 'skills', label: 'Skills Profile', icon: '🎯' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Browse Paths Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Filters */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">🔍 Filter Learning Paths</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Roles</option>
                    <option value="junior-qa">Junior QA Engineer</option>
                    <option value="automation-engineer">Automation Engineer</option>
                    <option value="senior-qa">Senior QA Engineer</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showCertificationOnly}
                      onChange={(e) => setShowCertificationOnly(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">🏆 Certification paths only</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Learning Paths Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPaths.map((path) => (
                <div key={path.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-semibold text-gray-900">{path.title}</h3>
                      {path.isCertificationPath && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          🏆 Certification
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-4">{path.description}</p>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">⏱️ Duration:</span>
                        <span className="font-medium">{path.estimatedWeeks} weeks</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">📊 Difficulty:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(path.difficultyProgression.start)}`}>
                          {path.difficultyProgression.start} → {path.difficultyProgression.end}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">👥 Enrolled:</span>
                        <span className="font-medium">{path.enrolledUsers} students</span>
                      </div>
                    </div>

                    {/* Skills Preview */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">🎯 Skills You'll Gain:</h4>
                      <div className="flex flex-wrap gap-2">
                        {path.skillsGained.slice(0, 3).map((skillGain, index) => (
                          <span
                            key={index}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getSkillLevelColor(skillGain.level)}`}
                          >
                            {skillGain.skill}
                          </span>
                        ))}
                        {path.skillsGained.length > 3 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            +{path.skillsGained.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => enrollInPath(path.id)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                    >
                      🚀 Enroll in Path
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Learning Paths Tab */}
        {activeTab === 'my-paths' && (
          <div>
            {myPaths.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Learning Paths Yet</h3>
                <p className="text-gray-600 mb-6">Start your learning journey by enrolling in a path</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  🗺️ Browse Learning Paths
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {myPaths.map((enrollment) => (
                  <div key={enrollment.enrollmentId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{enrollment.learningPath.title}</h3>
                        <p className="text-gray-600 mt-1">{enrollment.learningPath.description}</p>
                      </div>
                      {enrollment.learningPath.isCertificationPath && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          🏆 Certification
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm text-gray-600">{enrollment.progress.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${enrollment.progress.percentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Started:</span>
                        <div className="font-medium">{new Date(enrollment.timeline.startedAt).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Est. Completion:</span>
                        <div className="font-medium">{new Date(enrollment.timeline.estimatedCompletion).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Item:</span>
                        <div className="font-medium">{enrollment.progress.currentItemOrder} of {enrollment.progress.totalItems}</div>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-3">
                      <button className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                        Continue Learning
                      </button>
                      <button className="border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skills Profile Tab */}
        {activeTab === 'skills' && (
          <div>
            {/* Skills Overview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Skills Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{skills.skillStats?.totalSkills || 0}</div>
                  <div className="text-sm text-gray-600">Total Skills</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{skills.skillStats?.skillsByLevel?.beginner || 0}</div>
                  <div className="text-sm text-gray-600">Beginner</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{skills.skillStats?.skillsByLevel?.intermediate || 0}</div>
                  <div className="text-sm text-gray-600">Intermediate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{skills.skillStats?.skillsByLevel?.advanced || 0}</div>
                  <div className="text-sm text-gray-600">Advanced</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{skills.skillStats?.skillsByLevel?.expert || 0}</div>
                  <div className="text-sm text-gray-600">Expert</div>
                </div>
              </div>
            </div>

            {/* Current Skills */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Your Skills</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skills.userSkills?.map((userSkill: any) => (
                  <div key={userSkill.skillId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{userSkill.skill.icon}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{userSkill.skill.name}</h4>
                          <p className="text-sm text-gray-600">{userSkill.skill.description}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSkillLevelColor(userSkill.currentLevel)}`}>
                        {userSkill.currentLevel}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Evidence: {userSkill.evidenceCount} assessments
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Skills */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🌟 Skills to Develop</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.availableSkills?.map((skill: any) => (
                  <div key={skill.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-center mb-2">
                      <span className="text-2xl mr-3">{skill.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{skill.name}</h4>
                        <span className="text-xs text-gray-500 uppercase">{skill.category}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{skill.description}</p>
                    <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
                      Start Learning →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningPaths; 