import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function StudentClassDetail({ user, onLogout }) {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [activeGame, setActiveGame] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [classLeaderboard, setClassLeaderboard] = useState([]);

  useEffect(() => {
    fetchAll();
  }, [classId]);

  useEffect(() => {
    const checkGame = () => {
      axios.get(`/api/game/active/${classId}`)
        .then(r => setActiveGame(r.data.active ? r.data : null))
        .catch(() => {});
    };
    checkGame();
    const interval = setInterval(checkGame, 5000);
    return () => clearInterval(interval);
  }, [classId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [classRes, studentsRes, assignmentsRes, studentAssignmentsRes, lbRes] = await Promise.all([
        axios.get(`/api/classes/${classId}`),
        axios.get(`/api/classes/${classId}/students`),
        axios.get(`/api/classes/${classId}/assignments`),
        axios.get(`/api/students/${user.username}/assignments`),
        axios.get(`/api/classes/${classId}/leaderboard`),
      ]);
      setClassroom(classRes.data);
      setStudents(studentsRes.data);
      setClassLeaderboard(lbRes.data || []);
      // Merge completion status into assignments
      const completedIds = new Set(
        (studentAssignmentsRes.data || [])
          .filter(a => a.completed)
          .map(a => a.id)
      );
      const withStatus = (assignmentsRes.data || []).map(a => ({
        ...a,
        completed: completedIds.has(a.id),
      }));
      setAssignments(withStatus);
    } catch (err) {
      setError('Failed to load class');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await axios.delete(`/api/classes/${classId}/leave/${user.username}`);
      navigate('/classes');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to leave class');
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  if (loading) return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="profile-container"><p>Loading...</p></div>
    </div>
  );

  if (error && !classroom) return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="profile-container">
        <div className="error-message">{error}</div>
        <Link to="/classes">← Back to Classes</Link>
      </div>
    </div>
  );

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="profile-container">

        <div>
          <Link to="/classes" className="tc-back-link">
            ← Back to Classes
          </Link>
        </div>

        {/* Header */}
        <div className="welcome-section">
          <h1>🏫 {classroom.name}</h1>
          <p>Taught by {classroom.teacher_username} · {students.length} student{students.length !== 1 ? 's' : ''}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="profile-sections">

          {/* Assignments */}
          <div className="profile-section">
            <h2>📝 Assignments ({assignments.length})</h2>
            {assignments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>No assignments yet</h3>
                <p>Your teacher hasn't posted any assignments. Check back soon!</p>
              </div>
            ) : (() => {
              const pending = assignments.filter(a => !a.completed);
              const completed = assignments.filter(a => a.completed);
              const renderRow = (a) => (
                <div key={a.id} className="tc-student-row" style={{ cursor: 'pointer', opacity: a.completed ? 0.6 : 1 }}
                  onClick={() => {
                    if (!a.completed) {
                      if (a.assignment_type === 'animal_quiz') {
                        navigate(`/custom-quiz/${a.animal_id}?type=animal&assignmentId=${a.id}&classId=${classId}`);
                      } else {
                        navigate(`/custom-quiz/${a.custom_quiz_id}?assignmentId=${a.id}&classId=${classId}`);
                      }
                    }
                  }}>
                  <div className="tc-student-info">
                    <p className="tc-student-name">{a.source_name}</p>
                    <p className="tc-student-stats">{a.assignment_type === 'animal_quiz' ? '🐾 Animal Quiz' : '🧩 Custom Quiz'}</p>
                  </div>
                  {a.completed
                    ? <span className="scd-assignment-row-done">✓ Done</span>
                    : <span className="scd-assignment-row-start">Start →</span>}
                </div>
              );
              return (
                <div>
                  {pending.length > 0 && (
                    <>
                      <p className="scd-section-label">To Do</p>
                      <div className="tc-student-list scd-pending-list">{pending.map(renderRow)}</div>
                    </>
                  )}
                  {completed.length > 0 && (
                    <>
                      <p className="scd-section-label">Completed</p>
                      <div className="tc-student-list">{completed.map(renderRow)}</div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Class Leaderboard */}
          <div className="profile-section">
            <h2>🏆 Class Leaderboard</h2>
            {classLeaderboard.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏆</div>
                <p>No points yet. Complete quizzes and activities to earn points!</p>
              </div>
            ) : (
              <div className="tc-student-list">
                {classLeaderboard.map((entry, i) => {
                  const isMe = entry.username === user.username;
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <div key={entry.username} className={`sc-student-row${isMe ? ' is-me' : ''}`}>
                      <div style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: medal ? '1.3rem' : '0.95rem', color: '#888' }}>
                        {medal || `#${i + 1}`}
                      </div>
                      <div className="sc-avatar" style={{ background: isMe ? 'var(--select-color)' : 'var(--dark-gradient)' }}>
                        {entry.username[0].toUpperCase()}
                      </div>
                      <div className="tc-student-info">
                        <p className="sc-student-name">{entry.username}{isMe && <span className="sc-you-label"> (you)</span>}</p>
                        <p className="sc-student-stats">🔍 {entry.discoveries} discoveries · 🏅 {entry.badges} badges</p>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--dark-gradient)', whiteSpace: 'nowrap' }}>
                        {entry.points.toLocaleString()} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BioQuiz */}
          <div className="profile-section">
            <h2>🎮 BioQuiz</h2>
            {activeGame ? (
              <div>
                <p className="scd-bioquiz-active-text">
                  🟢 A game is active! Join now before it starts.
                </p>
                <button
                  className="btn-primary scd-bioquiz-join-btn"
                  onClick={() => navigate(`/bioquiz?classId=${classId}`)}
                >
                  Join BioQuiz →
                </button>
              </div>
            ) : (
              <div>
                <p className="scd-bioquiz-inactive-text">No active game right now. Your teacher will launch one from this class.</p>
                <button className="btn-primary scd-bioquiz-disabled-btn" disabled>
                  No game active
                </button>
              </div>
            )}
          </div>

          {/* Leave class */}
          <div className="profile-section">
            <h2>⚠️ Leave Class</h2>
            <p className="text-muted sc-leave-warning">
              Once you leave, you'll need the class code to rejoin.
            </p>
            {!confirmLeave ? (
              <button
                onClick={() => setConfirmLeave(true)}
                className="sc-leave-btn"
              >
                Leave {classroom.name}
              </button>
            ) : (
              <div className="sc-leave-confirm-bar">
                <p className="sc-leave-confirm-text">
                  Are you sure you want to leave <strong>{classroom.name}</strong>?
                </p>
                <div className="sc-leave-confirm-btns">
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="sc-confirm-yes-btn"
                  >
                    {leaving ? 'Leaving...' : 'Yes, leave'}
                  </button>
                  <button
                    onClick={() => setConfirmLeave(false)}
                    className="sc-confirm-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default StudentClassDetail;