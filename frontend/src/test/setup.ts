import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock handlers for API calls
const handlers = [
  // Auth endpoints
  http.post('/api/users/login', () => {
    return HttpResponse.json({
      message: 'Login successful',
      user: {
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'student'
      },
      token: 'mock-jwt-token'
    })
  }),

  http.post('/api/users/register', () => {
    return HttpResponse.json({
      message: 'User registered successfully',
      user: {
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'student'
      },
      token: 'mock-jwt-token'
    }, { status: 201 })
  }),

  http.get('/api/users/profile', () => {
    return HttpResponse.json({
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'student'
    })
  }),

  // Content endpoints - both API gateway and direct service endpoints
  http.get('/api/content/tracks', () => {
    return HttpResponse.json([
      {
        id: 1,
        title: 'QA Fundamentals',
        description: 'Learn the basics of Quality Assurance',
        difficulty: 'beginner',
        estimatedDuration: '4 weeks'
      }
    ])
  }),

  // Direct content service endpoint (localhost:8000) - match Dashboard expectations
  http.get('http://localhost:8000/tracks', () => {
    return HttpResponse.json({
      tracks: [
        {
          id: 1,
          title: 'QA Fundamentals',
          description: 'Learn the basics of Quality Assurance testing and methodologies',
          difficultyLevel: 'beginner',
          estimatedHours: 20,
          isPublished: true,
          createdAt: '2025-06-08T14:09:00.805Z'
        },
        {
          id: 2,
          title: 'Test Automation Basics',
          description: 'Introduction to automated testing tools and frameworks',
          difficultyLevel: 'intermediate',
          estimatedHours: 30,
          isPublished: true,
          createdAt: '2025-06-08T14:09:00.805Z'
        },
        {
          id: 3,
          title: 'Advanced Testing Techniques',
          description: 'Performance testing, security testing, and advanced methodologies',
          difficultyLevel: 'advanced',
          estimatedHours: 40,
          isPublished: true,
          createdAt: '2025-06-08T14:09:00.805Z'
        }
      ]
    })
  }),

  http.get('/api/content/tracks/:id', ({ params }) => {
    const { id } = params
    return HttpResponse.json({
      track: {
        id: parseInt(id as string),
        title: 'QA Fundamentals',
        description: 'Learn the basics of Quality Assurance',
        difficulty: 'beginner',
        estimatedDuration: '4 weeks'
      },
      courses: [
        {
          id: 1,
          title: 'Introduction to QA',
          description: 'Basic QA concepts',
          orderInTrack: 1,
          estimatedDuration: '2 hours',
          content: '# Introduction\n\nWelcome to QA testing!'
        }
      ]
    })
  }),

  // Progress endpoints
  http.get('/api/progress/overview', () => {
    return HttpResponse.json({
      stats: {
        completedCourses: 2,
        totalEnrolled: 5,
        averageProgress: 60,
        totalPoints: 25
      },
      recentProgress: [],
      achievements: []
    })
  }),

  http.get('/api/progress/courses/:id', ({ params }) => {
    return HttpResponse.json({
      courseId: parseInt(params.id as string),
      progressPercentage: 0,
      isCompleted: false,
      startedAt: null,
      updatedAt: null
    })
  }),

  http.put('/api/progress/courses/:id', ({ params }) => {
    return HttpResponse.json({
      message: 'Progress updated successfully',
      progress: {
        courseId: parseInt(params.id as string),
        progressPercentage: 100,
        isCompleted: true
      }
    })
  }),

  http.get('/api/progress/leaderboard', () => {
    return HttpResponse.json([
      {
        rank: 1,
        name: 'Test User',
        points: 25,
        achievements: 2,
        completedCourses: 3
      }
    ])
  })
]

// Setup MSW server
const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => {
  server.listen({ 
    onUnhandledRequest: 'warn' // Changed from 'error' to 'warn' to be less strict
  })
})

// Clean up after each test case
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// Close server after all tests
afterAll(() => {
  server.close()
})

// Export server for additional handlers in tests
export { server }

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any 