import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface Question {
  id: number;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false';
  answerOptions: string[];
  points: number;
  orderIndex: number;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  maxAttempts: number;
  questions: Question[];
  totalQuestions: number;
  totalPoints: number;
}

interface QuizResult {
  quizId: number;
  quizTitle: string;
  totalQuestions: number;
  correctAnswers: number;
  totalPoints: number;
  earnedPoints: number;
  scorePercentage: number;
  passingScore: number;
  passed: boolean;
  timeSpent: number;
  results: Array<{
    questionId: number;
    questionText: string;
    correctAnswer: string;
    userAnswer: string;
    isCorrect: boolean;
    points: number;
    earnedPoints: number;
  }>;
}

const Quiz: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: number]: string }>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quizStarted && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (quizStarted && timeLeft === 0 && !quizCompleted) {
      handleSubmitQuiz();
    }
  }, [timeLeft, quizStarted, quizCompleted]);

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`/api/content/quizzes/${quizId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quiz');
      }
      const data = await response.json();
      setQuiz(data);
      setTimeLeft(data.timeLimitMinutes * 60);
    } catch (error) {
      setError('Failed to load quiz');
      console.error('Error fetching quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    setQuizStarted(true);
    setStartTime(Date.now());
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!quiz) return;
    
    setSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      const submissionData = {
        answers: quiz.questions.map(q => ({
          questionId: q.id,
          answer: answers[q.id] || ''
        })),
        timeSpent
      };

      const response = await fetch(`/api/content/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      const resultData = await response.json();
      setResult(resultData);
      setQuizCompleted(true);
    } catch (error) {
      setError('Failed to submit quiz');
      console.error('Error submitting quiz:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!quiz) return 0;
    return ((currentQuestion + 1) / quiz.totalQuestions) * 100;
  };

  const canSubmit = () => {
    if (!quiz) return false;
    return quiz.questions.every(q => answers[q.id]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Quiz not found</h2>
        </div>
      </div>
    );
  }

  // Quiz Results View
  if (quizCompleted && result) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              {result.passed ? (
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {result.passed ? 'Congratulations!' : 'Quiz Complete'}
              </h1>
              <p className="text-xl text-gray-600">
                You scored {result.scorePercentage}% ({result.earnedPoints}/{result.totalPoints} points)
              </p>
              <p className="text-gray-500 mt-2">
                Passing score: {result.passingScore}%
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{result.correctAnswers}</div>
                <div className="text-blue-800">Correct Answers</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{result.totalQuestions}</div>
                <div className="text-purple-800">Total Questions</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{formatTime(result.timeSpent)}</div>
                <div className="text-green-800">Time Taken</div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Question Review</h3>
              {result.results.map((questionResult, index) => (
                <div key={questionResult.questionId} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium text-gray-900">
                      Question {index + 1}: {questionResult.questionText}
                    </h4>
                    {questionResult.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Your answer: </span>
                      <span className={questionResult.isCorrect ? 'text-green-600' : 'text-red-600'}>
                        {questionResult.userAnswer || 'No answer'}
                      </span>
                    </div>
                    {!questionResult.isCorrect && (
                      <div>
                        <span className="font-medium">Correct answer: </span>
                        <span className="text-green-600">{questionResult.correctAnswer}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Points: </span>
                      <span>{questionResult.earnedPoints}/{questionResult.points}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center space-x-4">
              <button
                onClick={() => navigate('/courses')}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Back to Courses
              </button>
              {!result.passed && (
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Start Screen
  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{quiz.title}</h1>
            <p className="text-gray-600 mb-6">{quiz.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Clock className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">Time Limit</span>
                </div>
                <p className="text-blue-700">{quiz.timeLimitMinutes} minutes</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />
                  <span className="font-medium text-purple-900">Passing Score</span>
                </div>
                <p className="text-purple-700">{quiz.passingScore}%</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <span className="font-medium text-green-900">Questions</span>
                </div>
                <p className="text-green-700">{quiz.totalQuestions} questions</p>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <span className="font-medium text-orange-900">Total Points</span>
                </div>
                <p className="text-orange-700">{quiz.totalPoints} points</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-yellow-900 mb-2">Instructions:</h3>
              <ul className="text-yellow-800 text-sm space-y-1">
                <li>• You have {quiz.timeLimitMinutes} minutes to complete this quiz</li>
                <li>• You can navigate between questions before submitting</li>
                <li>• Make sure to answer all questions before submitting</li>
                <li>• You need {quiz.passingScore}% to pass</li>
                <li>• You have {quiz.maxAttempts} attempts maximum</li>
              </ul>
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startQuiz}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
              >
                Start Quiz
                <ArrowRight className="h-5 w-5 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Taking Interface
  const currentQ = quiz.questions[currentQuestion];
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-gray-600">
                <Clock className="h-5 w-5 mr-2" />
                <span className={`font-mono ${timeLeft < 300 ? 'text-red-600' : ''}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>Question {currentQuestion + 1} of {quiz.totalQuestions}</span>
            <span>{quiz.totalPoints} total points</span>
          </div>
        </div>

        {/* Question */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {currentQ.questionText}
              </h2>
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                {currentQ.points} {currentQ.points === 1 ? 'point' : 'points'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {currentQ.answerOptions.map((option, index) => (
              <label
                key={index}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={`question-${currentQ.id}`}
                  value={option}
                  checked={answers[currentQ.id] === option}
                  onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                />
                <span className="ml-3 text-gray-900">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Previous
            </button>

            <div className="flex space-x-2">
              {quiz.questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    index === currentQuestion
                      ? 'bg-purple-600 text-white'
                      : answers[quiz.questions[index].id]
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {currentQuestion === quiz.totalQuestions - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={!canSubmit() || submitting}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
                <CheckCircle className="h-5 w-5 ml-2" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestion(Math.min(quiz.totalQuestions - 1, currentQuestion + 1))}
                disabled={currentQuestion === quiz.totalQuestions - 1}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight className="h-5 w-5 ml-2" />
              </button>
            )}
          </div>

          {!canSubmit() && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                Please answer all questions before submitting the quiz.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Quiz; 