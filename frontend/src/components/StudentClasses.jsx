import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function StudentClasses({ user, onLogout }) {
  const [classCode, setClassCode] = useState('');
  const [joinedClasses, setJoinedClasses] = useState([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJoinedClasses();
  }, []);

  const fetchJoinedClasses = async () => {
    try {
      const response = await axios.get(`/api/classes/student/${user.username}`);
      setJoinedClasses(response.data || []);
    } catch (err) {
      console.error('Error fetching joined classes:', err);
      setJoinedClasses([]);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanedCode = classCode.trim().toUpperCase();

    if (cleanedCode.length !== 6) {
      setError('Class code must be 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/classes/join', {
        student_username: user.username,
        class_code: cleanedCode,
      });

      setSuccessMessage(response.data.message || 'Joined class successfully');
      setClassCode('');
      await fetchJoinedClasses();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to join class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />

      <div className="profile-container">
        <div className="profile-header">
          <h1>🏫 {user.username}'s Classes</h1>
          <p>Join a class and learn with your teacher</p>

          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-value">
                {joinedClasses.length > 0 ? '✓' : '—'}
              </div>
              <div className="profile-stat-label">Enrollment Status</div>
            </div>
          </div>
        </div>

        <div className="profile-sections">
          <div className="profile-section">
            <h2>➕ Join a Class</h2>

            <form onSubmit={handleJoinClass}>
              <div className="form-group">
                <label htmlFor="classCode">Enter 6-Character Class Code</label>
                <input
                  id="classCode"
                  autoComplete="off"
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder="Example: A7K2QX"
                  maxLength={6}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Joining...' : 'Join Class'}
              </button>
            </form>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {successMessage && (
              <div
                className="join-success"
              >
                {successMessage}
              </div>
            )}
          </div>

          <div className="profile-section">
            <h2>📚 My Classes</h2>

            {joinedClasses.length > 0 ? (
              <div className="favorites-grid">
                {joinedClasses.map((classItem) => (
                  <div
                    key={classItem.id}
                    className="favorite-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/classes/${classItem.id}`)}
                  >
                    <div className="class-card-emoji">
                      🏫
                    </div>

                    <h4 className="class-card-name">
                      {classItem.name}
                    </h4>

                    <p className="class-card-teacher">
                      Teacher: {classItem.teacher_username}
                    </p>

                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🏫</div>
                <h3>No classes joined yet</h3>
                <p>Enter a class code from your teacher to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentClasses;
