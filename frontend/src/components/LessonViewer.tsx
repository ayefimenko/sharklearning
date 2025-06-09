import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface Lesson {
  id: number;
  title: string;
  content: string;
  orderIndex: number;
  lessonType: string;
  durationMinutes: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  maxAttempts: number;
  questions: QuizQuestion[];
}

interface QuizQuestion {
  id: number;
  questionText: string;
  questionType: string;
  answerOptions: string[];
  points: number;
  orderIndex: number;
}

interface LessonViewerProps {
  courseId: number;
  courseName: string;
  onProgressUpdate?: (progress: number) => void;
}

const LessonViewer: React.FC<LessonViewerProps> = ({ courseId, courseName, onProgressUpdate }) => {
  const { token } = useAuthStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lessonDetail, setLessonDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  useEffect(() => {
    fetchLessons();
  }, [courseId]);

  useEffect(() => {
    if (lessons.length > 0) {
      fetchLessonDetail(lessons[currentLessonIndex].id);
    }
  }, [currentLessonIndex, lessons]);

  useEffect(() => {
    if (lessons.length > 0) {
      const progress = (completedLessons.size / lessons.length) * 100;
      onProgressUpdate?.(progress);
    }
  }, [completedLessons, lessons.length, onProgressUpdate]);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content/courses/${courseId}/lessons`);
      
      if (response.ok) {
        const data = await response.json();
        setLessons(data.lessons || []);
      }
    } catch (error) {
      console.error('Error fetching lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessonDetail = async (lessonId: number) => {
    try {
      setLoadingDetail(true);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizScore(null);
      
      const response = await fetch(`/api/content/lessons/${lessonId}`);
      
      if (response.ok) {
        const data = await response.json();
        setLessonDetail(data);
      }
    } catch (error) {
      console.error('Error fetching lesson detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const markLessonComplete = async (lessonId: number) => {
    if (completedLessons.has(lessonId)) return;

    setCompletedLessons(prev => new Set([...prev, lessonId]));
    
    // TODO: Send to backend progress service when it's implemented
    if (token) {
      try {
        await fetch(`/api/progress/lessons/${lessonId}/complete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Error marking lesson complete:', error);
      }
    }
  };

  const handleQuizAnswer = (questionId: number, answer: string) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitQuiz = () => {
    if (!lessonDetail?.quiz) return;
    
    let correctAnswers = 0;
    const totalQuestions = lessonDetail.quiz.questions.length;
    
    lessonDetail.quiz.questions.forEach((question: QuizQuestion) => {
      const userAnswer = quizAnswers[question.id];
      let isCorrect = false;
      
      if (question.questionType === 'multiple_choice' || question.questionType === 'true_false') {
        // For quiz data, the correct answer is the first option in the array
        const correctAnswer = question.answerOptions[0];
        isCorrect = userAnswer === correctAnswer;
      }
      
      if (isCorrect) {
        correctAnswers++;
      }
    });
    
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
    
    if (score >= lessonDetail.quiz.passingScore) {
      markLessonComplete(lessonDetail.id);
    }
  };

  const nextLesson = () => {
    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  };

  const previousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  const goToLesson = (index: number) => {
    setCurrentLessonIndex(index);
  };

  const isLessonAccessible = (index: number) => {
    // First lesson is always accessible
    if (index === 0) return true;
    
    // Sequential access: previous lesson must be completed
    const previousLesson = lessons[index - 1];
    return completedLessons.has(previousLesson.id);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading lessons...</span>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No lessons available for this course yet.</p>
      </div>
    );
  }

  const currentLesson = lessons[currentLessonIndex];

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Lesson Progress Bar */}
      <div className="bg-gray-50 p-4 border-b">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-800">{courseName}</h3>
          <span className="text-sm text-gray-600">
            {completedLessons.size} of {lessons.length} lessons completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedLessons.size / lessons.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Lesson Navigation */}
      <div className="p-4 border-b">
        <div className="flex flex-wrap gap-2">
          {lessons.map((lesson, index) => (
            <button
              key={lesson.id}
              onClick={() => goToLesson(index)}
              disabled={!isLessonAccessible(index)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                index === currentLessonIndex
                  ? 'bg-blue-600 text-white'
                  : completedLessons.has(lesson.id)
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : isLessonAccessible(index)
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-1">
                {completedLessons.has(lesson.id) && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {index + 1}. {lesson.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lesson Content */}
      <div className="p-6">
        {loadingDetail ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : lessonDetail ? (
          <div>
            {/* Lesson Header */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-2xl font-bold">{lessonDetail.title}</h2>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  lessonDetail.lessonType === 'quiz' 
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {lessonDetail.lessonType}
                </span>
                <span className="text-sm text-gray-600">
                  ~{lessonDetail.durationMinutes} min
                </span>
              </div>
            </div>

            {/* Lesson Content */}
            {lessonDetail.lessonType === 'quiz' && lessonDetail.quiz ? (
              <div className="space-y-6">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">{lessonDetail.quiz.title}</h3>
                  <p className="text-purple-700 mb-3">{lessonDetail.quiz.description}</p>
                  <div className="flex gap-4 text-sm text-purple-600">
                    <span>⏱️ {lessonDetail.quiz.timeLimitMinutes} minutes</span>
                    <span>🎯 {lessonDetail.quiz.passingScore}% to pass</span>
                    <span>🔄 {lessonDetail.quiz.maxAttempts} attempts</span>
                  </div>
                </div>

                {!quizSubmitted ? (
                  <div className="space-y-4">
                    {lessonDetail.quiz.questions.map((question: QuizQuestion, qIndex: number) => (
                      <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">
                          {qIndex + 1}. {question.questionText}
                        </h4>
                        <div className="space-y-2">
                          {question.answerOptions.map((option: string, oIndex: number) => (
                            <label key={oIndex} className="flex items-center">
                              <input
                                type={question.questionType === 'true_false' ? 'radio' : 'radio'}
                                name={`question-${question.id}`}
                                value={option}
                                onChange={(e) => handleQuizAnswer(question.id, e.target.value)}
                                className="mr-2"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    <button
                      onClick={submitQuiz}
                      disabled={Object.keys(quizAnswers).length !== lessonDetail.quiz.questions.length}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Submit Quiz
                    </button>
                  </div>
                ) : (
                  <div className={`p-4 rounded-lg ${quizScore! >= lessonDetail.quiz.passingScore ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <h4 className={`font-semibold mb-2 ${quizScore! >= lessonDetail.quiz.passingScore ? 'text-green-800' : 'text-red-800'}`}>
                      Quiz Results
                    </h4>
                    <p className={`text-lg ${quizScore! >= lessonDetail.quiz.passingScore ? 'text-green-700' : 'text-red-700'}`}>
                      Your Score: {quizScore}%
                    </p>
                    <p className={`text-sm ${quizScore! >= lessonDetail.quiz.passingScore ? 'text-green-600' : 'text-red-600'}`}>
                      {quizScore! >= lessonDetail.quiz.passingScore 
                        ? '🎉 Congratulations! You passed the quiz.' 
                        : `You need ${lessonDetail.quiz.passingScore}% to pass. Try again!`}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {lessonDetail.content}
                </div>
                
                {!completedLessons.has(currentLesson.id) && (
                  <div className="mt-6 pt-6 border-t">
                    <button
                      onClick={() => markLessonComplete(currentLesson.id)}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Mark as Complete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center p-4 bg-gray-50 border-t">
        <button
          onClick={previousLesson}
          disabled={currentLessonIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Previous
        </button>

        <span className="text-sm text-gray-600">
          Lesson {currentLessonIndex + 1} of {lessons.length}
        </span>

        <button
          onClick={nextLesson}
          disabled={currentLessonIndex === lessons.length - 1}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          Next
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default LessonViewer; 