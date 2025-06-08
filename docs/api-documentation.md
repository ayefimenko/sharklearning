# 📡 SharkLearning API Documentation

## Overview

This document provides comprehensive documentation for all SharkLearning microservices APIs. All APIs follow RESTful design principles and return JSON responses.

## 🔗 Base URLs

- **API Gateway**: `http://localhost:8000`
- **User Service**: `http://localhost:8001`
- **Content Service**: `http://localhost:8002`
- **Progress Service**: `http://localhost:8003`

> **Note**: All client requests should go through the API Gateway at port 8000.

## 🔐 Authentication

### JWT Token Authentication

Most endpoints require authentication using JWT tokens in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Token Format
```json
{
  "userId": 123,
  "email": "user@example.com",
  "role": "student"
}
```

---

## 🚪 API Gateway

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "api-gateway"
}
```

### API Information
```http
GET /api
```

**Response:**
```json
{
  "name": "SharkLearning API Gateway",
  "version": "1.0.0",
  "description": "API Gateway for SharkLearning microservices",
  "endpoints": {
    "users": "/api/users - User management service",
    "content": "/api/content - Learning content service",
    "progress": "/api/progress - Progress tracking service"
  }
}
```

---

## 👤 User Service (`/api/users`)

### Register User
```http
POST /api/users/register
```

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login User
```http
POST /api/users/login
```

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "email": "student@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student",
  "profileImage": null,
  "createdAt": "2024-01-15T08:00:00.000Z"
}
```

### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "firstName": "Johnny",
  "lastName": "Smith"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "firstName": "Johnny",
    "lastName": "Smith",
    "role": "student",
    "profileImage": null
  }
}
```

### Get All Users (Admin Only)
```http
GET /api/users/users
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "email": "student@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "isActive": true,
      "createdAt": "2024-01-15T08:00:00.000Z"
    }
  ]
}
```

---

## 📚 Content Service (`/api/content`)

### Get All Learning Tracks
```http
GET /api/content/tracks
```

**Response:**
```json
{
  "tracks": [
    {
      "id": 1,
      "title": "QA Fundamentals",
      "description": "Learn the basics of software testing and quality assurance",
      "difficultyLevel": "beginner",
      "estimatedHours": 20,
      "isPublished": true,
      "createdAt": "2024-01-15T08:00:00.000Z"
    }
  ]
}
```

### Get Learning Track with Courses
```http
GET /api/content/tracks/:id
```

**Response:**
```json
{
  "id": 1,
  "title": "QA Fundamentals",
  "description": "Learn the basics of software testing and quality assurance",
  "difficultyLevel": "beginner",
  "estimatedHours": 20,
  "isPublished": true,
  "createdAt": "2024-01-15T08:00:00.000Z",
  "courses": [
    {
      "id": 1,
      "title": "Introduction to QA",
      "description": "Basic concepts of quality assurance",
      "content": "Course content here...",
      "orderIndex": 0,
      "isPublished": true,
      "createdAt": "2024-01-15T08:00:00.000Z"
    }
  ]
}
```

### Get All Courses
```http
GET /api/content/courses
```

**Response:**
```json
{
  "courses": [
    {
      "id": 1,
      "title": "Introduction to QA",
      "description": "Basic concepts of quality assurance",
      "content": "Course content here...",
      "orderIndex": 0,
      "isPublished": true,
      "createdAt": "2024-01-15T08:00:00.000Z",
      "trackTitle": "QA Fundamentals",
      "difficultyLevel": "beginner"
    }
  ]
}
```

### Get Single Course
```http
GET /api/content/courses/:id
```

**Response:**
```json
{
  "id": 1,
  "title": "Introduction to QA",
  "description": "Basic concepts of quality assurance",
  "content": "Detailed course content...",
  "orderIndex": 0,
  "isPublished": true,
  "createdAt": "2024-01-15T08:00:00.000Z",
  "track": {
    "id": 1,
    "title": "QA Fundamentals",
    "difficultyLevel": "beginner"
  }
}
```

### Create Learning Track (Admin Only)
```http
POST /api/content/tracks
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "title": "Advanced QA Techniques",
  "description": "Advanced testing methodologies",
  "difficultyLevel": "advanced",
  "estimatedHours": 40
}
```

### Create Course (Admin Only)
```http
POST /api/content/courses
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "trackId": 1,
  "title": "Test Automation Basics",
  "description": "Introduction to automated testing",
  "content": "Detailed course content...",
  "orderIndex": 1
}
```

---

## 📊 Progress Service (`/api/progress`)

### Get User Progress Overview
```http
GET /api/progress/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "stats": {
    "completedCourses": 5,
    "totalEnrolled": 8,
    "averageProgress": 75,
    "totalPoints": 150
  },
  "recentProgress": [
    {
      "courseId": 1,
      "courseTitle": "Introduction to QA",
      "trackTitle": "QA Fundamentals",
      "progressPercentage": 100,
      "isCompleted": true,
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "achievements": [
    {
      "title": "First Steps",
      "description": "Complete your first course",
      "badgeIcon": "🎯",
      "points": 10,
      "earnedAt": "2024-01-15T09:30:00.000Z"
    }
  ]
}
```

### Get Course Progress
```http
GET /api/progress/courses/:courseId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "courseId": 1,
  "trackId": 1,
  "progressPercentage": 75,
  "isCompleted": false,
  "startedAt": "2024-01-15T08:00:00.000Z",
  "completedAt": null,
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### Update Course Progress
```http
PUT /api/progress/courses/:courseId
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "progressPercentage": 100,
  "isCompleted": true
}
```

**Response:**
```json
{
  "message": "Progress updated successfully",
  "progress": {
    "courseId": 1,
    "trackId": 1,
    "progressPercentage": 100,
    "isCompleted": true,
    "startedAt": "2024-01-15T08:00:00.000Z",
    "completedAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get All Achievements
```http
GET /api/progress/achievements
```

**Response:**
```json
{
  "achievements": [
    {
      "id": 1,
      "title": "First Steps",
      "description": "Complete your first course",
      "badgeIcon": "🎯",
      "points": 10
    },
    {
      "id": 2,
      "title": "Speed Learner",
      "description": "Complete a course in under 2 hours",
      "badgeIcon": "⚡",
      "points": 25
    }
  ]
}
```

### Get User Achievements
```http
GET /api/progress/achievements/user
Authorization: Bearer <token>
```

**Response:**
```json
{
  "achievements": [
    {
      "id": 1,
      "title": "First Steps",
      "description": "Complete your first course",
      "badgeIcon": "🎯",
      "points": 10,
      "earnedAt": "2024-01-15T09:30:00.000Z"
    }
  ]
}
```

### Get Leaderboard
```http
GET /api/progress/leaderboard
```

**Response:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "userId": 2,
      "firstName": "Alice",
      "lastName": "Johnson",
      "profileImage": null,
      "totalPoints": 250,
      "achievementCount": 8
    },
    {
      "rank": 2,
      "userId": 1,
      "firstName": "John",
      "lastName": "Doe",
      "profileImage": null,
      "totalPoints": 150,
      "achievementCount": 5
    }
  ]
}
```

---

## 📋 HTTP Status Codes

### Success Codes
- `200 OK` - Successful GET, PUT requests
- `201 Created` - Successful POST requests

### Client Error Codes
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists

### Server Error Codes
- `500 Internal Server Error` - Unexpected server error
- `503 Service Unavailable` - Service temporarily unavailable

---

## 🚨 Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message description",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": "Optional additional details"
}
```

### Validation Errors
```json
{
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 6 characters"
    }
  ]
}
```

---

## 🧪 Testing

### Example with cURL

**Login:**
```bash
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"password123"}'
```

**Get Progress with Token:**
```bash
curl -X GET http://localhost:8000/api/progress/overview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: 
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time 