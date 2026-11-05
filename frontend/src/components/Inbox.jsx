import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function Inbox({ user, onLogout }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await axios.get(`/api/students/${user.username}/assignments`);
      setAssignments(res.data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const pending = assignments.filter(a => !a.completed);
  const completed = assignments.filter(a => a.completed);

  const handleClick = (a) => {
    if (a.completed) return;
    if (a.assignment_type === 'animal_quiz') {
      navigate(`/custom-quiz/${a.animal_id}?type=animal&assignmentId=${a.id}&classId=${a.class_id}`);
    } else {
      navigate(`/custom-quiz/${a.custom_quiz_id}?assignmentId=${a.id}&classId=${a.class_id}`);
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="loading-screen">
          <div className="safari-loader"></div>
          <p>Loading inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />

      <div className="profile-container">
        <div className="welcome-section">
          <h1>📬 Inbox</h1>
          <p>All your assigned quizzes across all classes</p>
        </div>

        {assignments.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-state-icon">📭</div>
            <h3>No assignments yet</h3>
            <p>When your teacher assigns a quiz, it will show up here.</p>
          </div>
        ) : (
          <div className="profile-sections">

            {pending.length > 0 && (
              <div className="profile-section">
                <h2>📝 To Do ({pending.length})</h2>
                <div className="tc-student-list">
                  {pending.map(a => (
                    <div
                      key={a.id}
                      className="tc-student-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleClick(a)}
                    >
                      <div className="tc-student-info">
                        <p className="tc-student-name">{a.source_name}</p>
                        <p className="tc-student-stats">
                          {a.assignment_type === 'animal_quiz' ? '🐾 Animal Quiz' : '🧩 Custom Quiz'}
                          {' · '}🏫 {a.class_name}
                        </p>
                      </div>
                      <span className="scd-assignment-row-start">Start →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div className="profile-section">
                <h2>✅ Completed ({completed.length})</h2>
                <div className="tc-student-list">
                  {completed.map(a => (
                    <div
                      key={a.id}
                      className="tc-student-row"
                      style={{ opacity: 0.6 }}
                    >
                      <div className="tc-student-info">
                        <p className="tc-student-name">{a.source_name}</p>
                        <p className="tc-student-stats">
                          {a.assignment_type === 'animal_quiz' ? '🐾 Animal Quiz' : '🧩 Custom Quiz'}
                          {' · '}🏫 {a.class_name}
                        </p>
                      </div>
                      <span className="scd-assignment-row-done">✓ Done</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default Inbox;