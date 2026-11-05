import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

function Navigation({ user, onLogout }) {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  const isActive = (path) => {
    return location.pathname.startsWith(path) ? 'active' : '';
  };

  const isTeacher = user?.role === 'teacher';
  const classesPath = isTeacher ? '/teacher/classes' : '/classes';

   useEffect(() => {
    if (isTeacher || !user?.username) return;

    const fetchCount = () => {
      axios.get(`/api/students/${user.username}/assignments`)
        .then(res => {
          const pending = (res.data || []).filter(a => !a.completed).length;
          setPendingCount(pending);
        })
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user?.username, isTeacher, location.pathname]);
  
  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <img src="/BioTrack_logo.svg" alt="BioTrack" className="nav-logo" /> BioTrack
      </Link>
      
      <div className="navbar-menu">
        <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
          🏠 Home
        </Link>
                
        <Link to={classesPath} className={`nav-link ${isActive(classesPath)}`}>
          🏫 Classes
        </Link>

        {isTeacher && (
          <Link
            to="/teacher/custom-quizzes"
            className={`nav-link ${isActive('/teacher/custom-quizzes')}`}
          >
            🧩 Custom Quizzes
          </Link>
        )}


        {isTeacher && (
          <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
            ⚙️ Settings
          </Link>
        )}


        {!isTeacher && (
          <>
            <Link to="/explore" className={`nav-link ${isActive('/explore')}`}>
              🔍 Explore
            </Link>

            <Link to="/flashcards" className={`nav-link ${isActive('/flashcards')}`}>
              📚 Study
            </Link>


            <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
              👤 Profile
            </Link>

            <Link to="/inbox" className={`nav-link nav-link-badge-wrap ${isActive('/inbox')}`}>
              📬 Inbox
              {pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </Link>

            <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
              ⚙️ Settings
            </Link>
          </>
        )}

        <button onClick={onLogout} className="btn-logout">
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navigation;