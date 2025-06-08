import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Login from '../../pages/Login'
import { useAuthStore } from '../../stores/authStore'

// Mock the auth store
vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn()
}))

// Mock react-router-dom navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const LoginWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Login Component', () => {
  const mockLogin = vi.fn()
  const mockSetUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the auth store implementation
    ;(useAuthStore as any).mockReturnValue({
      login: mockLogin,
      setUser: mockSetUser,
      user: null,
      token: null
    })
  })

  it('renders login form correctly', () => {
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue your learning journey')).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
  })

  it('validates email field correctly', async () => {
    const user = userEvent.setup()
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Test empty email
    await user.click(submitButton)
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()

    // Test invalid email format
    await user.type(emailInput, 'invalid-email')
    await user.click(submitButton)
    expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument()

    // Test valid email
    await user.clear(emailInput)
    await user.type(emailInput, 'test@example.com')
    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid email/i)).not.toBeInTheDocument()
    })
  })

  it('validates password field correctly', async () => {
    const user = userEvent.setup()
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Test empty password
    await user.click(submitButton)
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()

    // Test valid password
    await user.type(passwordInput, 'password123')
    await waitFor(() => {
      expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const passwordInput = screen.getByLabelText('Password')
    const toggleButton = screen.getByLabelText(/toggle password visibility/i)

    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Click to show password
    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    // Click to hide password again
    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('submits form with valid credentials', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({
      user: { id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      token: 'mock-token'
    })

    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('handles login error correctly', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Invalid credentials'
    mockLogin.mockRejectedValue(new Error(errorMessage))

    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('shows loading state during form submission', async () => {
    const user = userEvent.setup()
    let resolveLogin: (value: any) => void
    const loginPromise = new Promise(resolve => {
      resolveLogin = resolve
    })
    mockLogin.mockReturnValue(loginPromise)

    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    // Should show loading state
    expect(screen.getByText('Signing in...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    // Resolve the login
    resolveLogin!({
      user: { id: 1, email: 'test@example.com' },
      token: 'mock-token'
    })

    await waitFor(() => {
      expect(screen.queryByText('Signing in...')).not.toBeInTheDocument()
    })
  })

  it('navigates to dashboard after successful login', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({
      user: { id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      token: 'mock-token'
    })

    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('has accessible form elements', () => {
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('required')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('required')
    expect(submitButton).toHaveAttribute('type', 'submit')
  })

  it('links to registration page', () => {
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const registerLink = screen.getByRole('link', { name: /sign up/i })
    expect(registerLink).toHaveAttribute('href', '/register')
  })
}) 