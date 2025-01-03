import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../config/firebase';
import styles from './Login.module.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { email, password } = formData;
      await signInWithEmailAndPassword(auth, email, password);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/chat');
      }, 500);
    } catch {
      setError('Invalid email or password');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/chat');
      }, 500);
    } catch {
      setError('Could not sign in with Google');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={`${styles.loginBox} ${isSuccess ? styles.success : ''}`}>
        <h1>Welcome Back</h1>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className={styles.error}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}
          <div className={styles.inputGroup}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <div className={styles.inputGroup}>
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <button type="submit" className={styles.loginButton} disabled={isLoading}>
            {isLoading ? (
              <div className={styles.loadingSpinner}></div>
            ) : (
              'Log In'
            )}
          </button>
        </form>
        
        <div className={styles.divider}>
          <span>OR</span>
        </div>
        
        <button 
          onClick={handleGoogleSignIn} 
          className={styles.googleButton}
          disabled={isLoading}
        >
          <img src="/google-icon.png" alt="Google" />
          Sign in with Google
        </button>
        
        <div className={styles.links}>
          <Link to="/signup">Do not have an account? Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;