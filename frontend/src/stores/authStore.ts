import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profileImage?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          // Try the real API first
          const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (response.ok) {
            const data = await response.json();
            set({
              token: data.token,
              user: data.user,
              isAuthenticated: true,
            });
            return;
          }
        } catch (error) {
          console.warn('Real API not available, using mock authentication for development');
        }

        // Mock authentication for development when API is not available
        if (email === 'admin@sharklearning.com' && password === 'admin123') {
          const mockUser: User = {
            id: 1,
            email: 'admin@sharklearning.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
          };
          const mockToken = 'mock-jwt-token-admin';
          
          set({
            token: mockToken,
            user: mockUser,
            isAuthenticated: true,
          });
          return;
        }
        
        if (email === 'user@sharklearning.com' && password === 'user123') {
          const mockUser: User = {
            id: 2,
            email: 'user@sharklearning.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
          };
          const mockToken = 'mock-jwt-token-user';
          
          set({
            token: mockToken,
            user: mockUser,
            isAuthenticated: true,
          });
          return;
        }

        throw new Error('Invalid credentials. Try admin@sharklearning.com / admin123 or user@sharklearning.com / user123');
      },

      setAuth: (token: string, user: User) => {
        set({
          token,
          user,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        // Clear any other local storage items if needed
        localStorage.removeItem('auth-storage');
      },

      updateUser: (updatedUser: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...updatedUser },
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 