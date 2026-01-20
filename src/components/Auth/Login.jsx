import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

// If you don't want to use react-icons, you can use these SVG icons instead
const GraduationCapIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
  </svg>
);

const UserGraduateIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4C8.14 4 5 4.85 5 6v12c0 1.15 3.14 2 7 2s7-.85 7-2V6c0-1.15-3.14-2-7-2zm5 15.68c-1.38.49-3.39.82-5 .82s-3.62-.33-5-.82V16c0 .41 2.55 1 5 1s5-.59 5-1v3.68zm0-4.68c-1.38.49-3.39.82-5 .82s-3.62-.33-5-.82V12c0 .41 2.55 1 5 1s5-.59 5-1v3.68zm0-4.68c-1.38.49-3.39.82-5 .82s-3.62-.33-5-.82V8c0 .41 2.55 1 5 1s5-.59 5-1v3.68z"/>
  </svg>
);

const MoneyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.78-1.18 2.73-3.12 3.16z"/>
  </svg>
);



const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, userRole } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (error) {
      setError('Failed to log in. Please check your email and password.');
      console.error(error);
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      {/* Left Side - Branding Section */}
      <div className="login-branding">
        <div className="branding-content">
          <div className="college-logo">
            <GraduationCapIcon />
          </div>
          <div className="college-info">
            <h1>AGS College of Education</h1>
            <p className="college-tagline">Shaping Future Educators</p>
            <div className="branding-features">
              <div className="feature-item">
                <UserGraduateIcon />
                <div className="feature-text">
                  <strong>Admission Management</strong>
                  <span>Streamlined student enrollment process</span>
                </div>
              </div>
              <div className="feature-item">
                <DatabaseIcon />
                <div className="feature-text">
                  <strong>Student Records</strong>
                  <span>Comprehensive student database management</span>
                </div>
              </div>
              <div className="feature-item">
                <MoneyIcon />
                <div className="feature-text">
                  <strong>Fee Management</strong>
                  <span>Efficient fee collection and tracking</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form Section */}
      <div className="login-form-section">
        <div className="login-form-wrapper">
          <div className="login-form-container">
            <div className="form-header">
              <h2>Welcome Back</h2>
              <p>Sign in to your admission panel account</p>
            </div>

            {error && (
              <div className="error-message">
                <div className="error-icon">⚠️</div>
                <span>{error}</span>
              </div>
            )}

            {userRole && (
              <div className="role-message">
                <div className="success-icon">✅</div>
                Logged in as: <span className="role-badge">{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-container">
              
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your college email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-container">
               
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              

              <button 
                type="submit" 
                disabled={loading} 
                className={`login-btn ${loading ? 'loading' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Signing In...
                  </>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>
            </form>

            <div className="login-footer">
              <p>Need help? Contact IT Support at 
                <a href="mailto:support@agscollege.edu">support@agscollege.edu</a>
              </p>
              <p className="copyright">© 2024 AGS College of Education. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;