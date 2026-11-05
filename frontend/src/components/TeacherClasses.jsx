import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function TeacherClasses({ user, onLogout }) {
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [className, setClassName] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await axios.get(`/api/classes/teacher/${user.username}`);
      setClasses(response.data);
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Failed to load classes');
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setCreatedCode('');

    const trimmedName = className.trim();
    if (!trimmedName) {
      setError('Please enter a class name');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/classes/create', {
        teacher_username: user.username,
        class_name: trimmedName,
      });

      const newClass = response.data.class;
      setCreatedCode(newClass.code);
      setSuccessMessage(`Class "${newClass.name}" created successfully`);
      setClassName('');
      await fetchClasses();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create class');
    } finally {
      setLoading(false);
    }
  };

  const filteredClasses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return classes;

    return classes.filter((classItem) => {
      return (
        classItem.name.toLowerCase().includes(query) ||
        classItem.code.toLowerCase().includes(query)
      );
    });
  }, [classes, searchTerm]);

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />

      <div className="explorer-container">
        <div className="explorer-header">
          <h1>🏫 Manage Classes</h1>
          <p>Create classes and share join codes with your students</p>
        </div>

        <div className="animal-card create-class-card">
          <div className="animal-card-content">
            <h3>Create a New Class</h3>

            <form onSubmit={handleCreateClass}>
              <div className="form-group">
                <label htmlFor="className">Class Name</label>
                <input
                  id="className"
                  autoComplete="off"
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Enter class name..."
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating Class...' : 'Create Class'}
              </button>
            </form>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="success-message">
                {successMessage}
              </div>
            )}

            {createdCode && (
              <div className="created-code-box">
                <p className="created-code-label">Join Code</p>
                <h2 className="created-code-value">{createdCode}</h2>
              </div>
            )}
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="🔍 Search classes by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="animals-grid">
          {filteredClasses.map((classItem) => (
            <div
              key={classItem.id}
              className="animal-card"

              onClick={() => navigate(`/teacher/classes/${classItem.id}`)}
            >
              <div className="animal-card-image">
                🏫
                <span className="conservation-badge badge-least-concern">
                  {classItem.code}
                </span>
              </div>

              <div className="animal-card-content">
                <h3>{classItem.name}</h3>
                <p className="scientific-name">Teacher: {classItem.teacher_username}</p>

                <div className="animal-info">
                  <div className="info-item">
                    <span className="info-icon">🔑</span>
                    <span>Code: {classItem.code}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-icon">👩‍🏫</span>
                    <span>{classItem.teacher_username}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-icon">📚</span>
                    <span>Ready for students to join</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredClasses.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🏫</div>
            <h3>No classes found</h3>
            <p>
              {classes.length === 0
                ? 'Create your first class to get started'
                : 'Try adjusting your search'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherClasses;
