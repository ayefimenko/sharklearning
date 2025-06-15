// API utility for handling all API calls
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api'  // Use proxy in production/Docker
  : '/api'; // Use proxy in development too

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: this.getHeaders(),
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Authentication
  async login(email: string, password: string) {
    return this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // User endpoints
  async getUsers(page = 1, limit = 10, search = '', role = 'all', status = 'all') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search,
      role,
      status
    });
    return this.request(`/users/users?${params}`);
  }

  async createUser(userData: any) {
    return this.request('/users/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: number, userData: any) {
    return this.request(`/users/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: number) {
    return this.request(`/users/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Content endpoints - using working endpoints
  async getContent(type: 'tracks' | 'courses', status = 'all') {
    if (type === 'tracks') {
      return this.getTracks();
    } else {
      return this.getCourses();
    }
  }

  async getTracks() {
    return this.request('/content/tracks');
  }

  async getCourses() {
    return this.request('/content/courses');
  }

  async createTrack(trackData: any) {
    return this.request('/content/tracks', {
      method: 'POST',
      body: JSON.stringify(trackData),
    });
  }

  async createCourse(courseData: any) {
    return this.request('/content/courses', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  }

  async updateTrack(trackId: number, trackData: any) {
    return this.request(`/content/tracks/${trackId}`, {
      method: 'PUT',
      body: JSON.stringify(trackData),
    });
  }

  async updateCourse(courseId: number, courseData: any) {
    return this.request(`/content/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(courseData),
    });
  }

  async deleteTrack(trackId: number) {
    return this.request(`/content/tracks/${trackId}`, {
      method: 'DELETE',
    });
  }

  async deleteCourse(courseId: number) {
    return this.request(`/content/courses/${courseId}`, {
      method: 'DELETE',
    });
  }

  // Learning paths (using working tracks endpoint for now)
  async getLearningPaths() {
    const response = await this.getTracks() as { tracks: any[] };
    // Transform tracks to look like paths for the admin interface
    return {
      paths: response.tracks?.map(track => ({
        ...track,
        courseCount: 0,
        enrolledUsers: 0,
        avgProgress: '0%',
        courses: []
      })) || []
    };
  }

  async createLearningPath(pathData: any) {
    return this.createTrack(pathData);
  }

  async updateLearningPath(pathId: number, pathData: any) {
    return this.updateTrack(pathId, pathData);
  }

  async deleteLearningPath(pathId: number) {
    return this.deleteTrack(pathId);
  }

  // Templates
  async getTemplates() {
    return this.request('/content/templates');
  }

  // Bulk operations
  async bulkOperation(type: string, operation: string, ids: number[]) {
    return this.request('/content/bulk', {
      method: 'POST',
      body: JSON.stringify({ type, operation, ids }),
    });
  }

  async bulkUserOperation(operation: string, userIds: number[], data?: any) {
    return this.request('/users/admin/users/bulk', {
      method: 'POST',
      body: JSON.stringify({ operation, userIds, ...data }),
    });
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the class for testing or multiple instances
export default ApiClient; 