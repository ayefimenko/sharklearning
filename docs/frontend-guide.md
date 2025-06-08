# 🎨 SharkLearning Frontend Guide

## Overview

The SharkLearning frontend is a modern React application built with TypeScript, featuring a beautiful purple gradient design system inspired by contemporary e-learning platforms. It provides an intuitive and engaging user experience for QA engineers learning new skills.

## 🏗️ Architecture

### Technology Stack
- **Framework**: React 18 with TypeScript 5
- **Build Tool**: Vite 4 for fast development and optimized builds
- **Styling**: Tailwind CSS 3 with custom design system
- **State Management**: Zustand for lightweight global state
- **HTTP Client**: Axios for API communication
- **Routing**: React Router 6 for client-side navigation
- **Icons**: Heroicons for consistent iconography
- **Animations**: Framer Motion for smooth interactions
- **Forms**: React Hook Form for efficient form handling

### Project Structure
```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # Base UI components
│   │   ├── layout/       # Layout components
│   │   └── features/     # Feature-specific components
│   ├── pages/            # Route-level page components
│   ├── stores/           # Zustand state stores
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── services/         # API service functions
│   └── styles/           # Global styles and themes
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration
```

---

## 🎨 Design System

### Color Palette
The design system features a modern purple gradient theme with carefully selected colors for accessibility and visual appeal.

#### Primary Colors
```css
primary: {
  50: '#fdf4ff',   /* Very light purple */
  100: '#fae8ff',  /* Light purple */
  200: '#f5d0fe',  /* Lighter purple */
  300: '#f0abfc',  /* Light purple */
  400: '#e879f9',  /* Medium light purple */
  500: '#d946ef',  /* Main purple */
  600: '#c026d3',  /* Dark purple */
  700: '#a21caf',  /* Darker purple */
  800: '#86198f',  /* Very dark purple */
  900: '#701a75',  /* Darkest purple */
  950: '#4a044e',  /* Ultra dark purple */
}
```

#### Secondary Colors
```css
secondary: {
  50: '#eff6ff',   /* Very light blue */
  500: '#3b82f6',  /* Main blue */
  600: '#2563eb',  /* Dark blue */
}
```

#### Gradient Definitions
```css
/* Primary gradient - main theme */
.bg-gradient-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Secondary gradient - accent elements */
.bg-gradient-secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}
```

### Typography
- **Font Family**: Inter (primary), system fonts (fallback)
- **Font Weights**: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Responsive Scale**: Tailwind's default typography scale

### Component Library

#### Buttons
```css
/* Primary button - main actions */
.btn-primary {
  @apply bg-gradient-primary text-white font-medium px-6 py-3 rounded-lg 
         hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl;
}

/* Secondary button - secondary actions */
.btn-secondary {
  @apply bg-white text-gray-700 font-medium px-6 py-3 rounded-lg border 
         border-gray-200 hover:bg-gray-50 transition-all duration-200 
         shadow-sm hover:shadow-md;
}

/* Ghost button - subtle actions */
.btn-ghost {
  @apply text-gray-600 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 
         transition-all duration-200;
}
```

#### Cards
```css
/* Standard card */
.card {
  @apply bg-white rounded-xl shadow-card border border-gray-100 p-6 
         transition-all duration-200 hover:shadow-card-hover;
}

/* Gradient card - featured content */
.card-gradient {
  @apply bg-gradient-primary text-white rounded-xl shadow-card border-0 p-6 
         transition-all duration-200 hover:shadow-card-hover;
}
```

#### Form Elements
```css
/* Input fields */
.input {
  @apply w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 
         focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-white;
}

/* Error state */
.input-error {
  @apply border-red-300 focus:ring-red-500;
}
```

#### Badges
```css
.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.badge-primary { @apply bg-primary-100 text-primary-800; }
.badge-success { @apply bg-green-100 text-green-800; }
.badge-warning { @apply bg-yellow-100 text-yellow-800; }
.badge-error { @apply bg-red-100 text-red-800; }
```

---

## 🔧 State Management

### Zustand Stores

#### Authentication Store
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}
```

**Features:**
- Persistent storage with localStorage
- Automatic rehydration on app load
- Type-safe user data management
- Clean logout functionality

#### Usage Example
```typescript
import { useAuthStore } from '@/stores/authStore';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuthStore();
  
  if (!isAuthenticated) {
    return <LoginPrompt />;
  }
  
  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## 📱 Layout System

### Main Layout Component
The `Layout` component provides the core application structure with:

- **Sidebar Navigation**: Clean, organized navigation menu
- **Top Header**: Search bar and user profile section
- **Main Content Area**: Responsive content container
- **Responsive Design**: Mobile-first approach

#### Sidebar Features
- **Overview Section**: Dashboard, Inbox, Lessons, Tasks, Groups
- **Friends Section**: Social learning connections
- **Settings Section**: User preferences and logout
- **Visual Hierarchy**: Clear section separation
- **Active States**: Highlighted current page

#### Header Features
- **Global Search**: Course and content search
- **Notifications**: Bell icon with future notification support
- **User Profile**: Greeting message and avatar
- **Responsive**: Adapts to different screen sizes

### Navigation Structure
```typescript
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Inbox', href: '/inbox', icon: InboxIcon },
  { name: 'Lesson', href: '/courses', icon: BookOpenIcon },
  { name: 'Task', href: '/tasks', icon: UserGroupIcon },
  { name: 'Group', href: '/groups', icon: UserGroupIcon },
];
```

---

## 🧩 Component Architecture

### Component Categories

#### 1. UI Components (`/components/ui/`)
Base-level reusable components:
- `Button` - Various button styles and states
- `Input` - Form input fields with validation
- `Card` - Content containers
- `Badge` - Status indicators
- `Modal` - Overlay dialogs
- `Spinner` - Loading indicators

#### 2. Layout Components (`/components/layout/`)
Structural components:
- `Layout` - Main application layout
- `Header` - Top navigation and search
- `Sidebar` - Side navigation menu
- `Container` - Content wrappers

#### 3. Feature Components (`/components/features/`)
Domain-specific components:
- `CourseCard` - Course display component
- `ProgressBar` - Learning progress indicator
- `AchievementBadge` - Gamification elements
- `LeaderboardItem` - User ranking display

### Component Design Principles

#### Props Interface Design
```typescript
// Example: CourseCard component
interface CourseCardProps {
  course: {
    id: number;
    title: string;
    description: string;
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
    progress?: number;
    isCompleted?: boolean;
  };
  onEnroll?: (courseId: number) => void;
  onContinue?: (courseId: number) => void;
  className?: string;
}
```

#### Compound Components
```typescript
// Example: Modal compound component
<Modal>
  <Modal.Header>
    <Modal.Title>Course Enrollment</Modal.Title>
    <Modal.CloseButton />
  </Modal.Header>
  <Modal.Body>
    <p>Are you sure you want to enroll in this course?</p>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Enroll</Button>
  </Modal.Footer>
</Modal>
```

---

## 🔄 Routing & Navigation

### Route Structure
```typescript
// App routing configuration
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  
  {/* Protected routes */}
  <Route path="/" element={<ProtectedRoute />}>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="courses" element={<Courses />} />
    <Route path="courses/:id" element={<CourseDetail />} />
    <Route path="profile" element={<Profile />} />
    <Route index element={<Navigate to="/dashboard" />} />
  </Route>
</Routes>
```

### Route Protection
```typescript
function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
```

---

## 🌐 API Integration

### Service Layer Architecture
```typescript
// services/api.ts
const api = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
});

// Request interceptor for auth tokens
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
```

### Type-Safe API Calls
```typescript
// services/userService.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  message: string;
}

export const userService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/users/login', data);
    return response.data;
  },
  
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/api/users/profile');
    return response.data;
  },
};
```

---

## 📱 Responsive Design

### Breakpoint Strategy
- **Mobile First**: Default styles for mobile (320px+)
- **Tablet**: `md:` prefix (768px+)
- **Desktop**: `lg:` prefix (1024px+)
- **Large Desktop**: `xl:` prefix (1280px+)

### Layout Adaptations
```typescript
// Example: Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {courses.map(course => (
    <CourseCard key={course.id} course={course} />
  ))}
</div>

// Example: Responsive navigation
<nav className="hidden lg:block"> {/* Desktop navigation */}
  <DesktopNav />
</nav>
<nav className="lg:hidden"> {/* Mobile navigation */}
  <MobileNav />
</nav>
```

---

## ⚡ Performance Optimization

### Code Splitting
```typescript
// Lazy loading for route components
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Courses = lazy(() => import('@/pages/Courses'));

// Lazy loading with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/courses" element={<Courses />} />
  </Routes>
</Suspense>
```

### Image Optimization
```typescript
// Optimized image component
interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
}

function OptimizedImage({ src, alt, className }: OptimizedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
```

### Bundle Optimization
- **Tree Shaking**: Automatic with Vite
- **Chunk Splitting**: Vendor libs separated
- **CSS Purging**: Tailwind removes unused styles
- **Asset Optimization**: Images and fonts optimized

---

## 🧪 Development Workflow

### Development Server
```bash
# Start development server
npm run dev

# Server runs on http://localhost:3000
# Hot module replacement enabled
# TypeScript checking in real-time
```

### Build Process
```bash
# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

### Code Quality
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with React rules
- **Prettier**: Automatic code formatting
- **Husky**: Git hooks for quality gates

---

## 🔮 Future Enhancements

### Planned Features
- **Dark Mode**: Theme switching capability
- **Offline Support**: PWA with service workers
- **Real-time Updates**: WebSocket integration
- **Advanced Animations**: Enhanced micro-interactions
- **Accessibility**: WCAG 2.1 AA compliance
- **Testing**: Jest + React Testing Library setup
- **Storybook**: Component documentation and testing 