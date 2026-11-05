import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function fuzzyMatch(target, query) {
  if (!query) return true;
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function TeacherClassDetail({ user, onLogout }) {
  const { classId } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [removingStudent, setRemovingStudent] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const navigate = useNavigate();
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSort, setStudentSort] = useState('alpha-asc');
  const [assignments, setAssignments] = useState([]);
  const [allAnimals, setAllAnimals] = useState([]);
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [teacherClasses] = useState([{ id: parseInt(classId), name: 'This class' }]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [classLeaderboard, setClassLeaderboard] = useState([]);
  const [assignType, setAssignType] = useState('animal_quiz');
  const [assignAnimalId, setAssignAnimalId] = useState('');
  const [assignAnimalSearch, setAssignAnimalSearch] = useState('');
  const [assignQuizId, setAssignQuizId] = useState('');
  const [assignQuizSearch, setAssignQuizSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [bioquizQuizId, setBioquizQuizId] = useState('');
  const [bioquizQuizSearch, setBioquizQuizSearch] = useState('');

  useEffect(() => {
    fetchAll();
  }, [classId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [classRes, studentsRes, assignmentsRes, animalsRes, quizzesRes, lbRes] = await Promise.all([
        axios.get(`/api/classes/${classId}`),
        axios.get(`/api/classes/${classId}/students`),
        axios.get(`/api/classes/${classId}/assignments`),
        axios.get('/api/animals'),
        axios.get(`/api/custom-quizzes/teacher/${user.username}`),
        axios.get(`/api/classes/${classId}/leaderboard`),
      ]);
      setClassroom(classRes.data);
      setStudents(studentsRes.data);
      setClassLeaderboard(lbRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setAllAnimals(Object.values(animalsRes.data || {}).sort((a, b) => a.commonName.localeCompare(b.commonName)));
      setSavedQuizzes(quizzesRes.data || []);
    } catch (err) {
      setError('Failed to load class');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    const message = `Join my BioTrack class!\nClass: ${classroom.name}\nJoin code: ${classroom.code}\nGo to BioTrack → Join Class and enter the code above.`;
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleRemoveStudent = async (username) => {
    setRemovingStudent(username);
    try {
      await axios.delete(`/api/classes/${classId}/students/${username}`);
      setStudents(prev => prev.filter(s => s.username !== username));
      setConfirmRemove(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove student');
    } finally {
      setRemovingStudent(null);
    }
  };

  const handleAssign = async () => {
    setAssignError('');
    if (assignType === 'animal_quiz' && !assignAnimalId) { setAssignError('Please select an animal'); return; }
    if (assignType === 'custom_quiz' && !assignQuizId) { setAssignError('Please select a quiz'); return; }
    setAssigning(true);
    try {
      await axios.post('/api/assignments', {
        class_id: parseInt(classId),
        teacher_username: user.username,
        assignment_type: assignType,
        animal_id: assignType === 'animal_quiz' ? parseInt(assignAnimalId) : null,
        custom_quiz_id: assignType === 'custom_quiz' ? parseInt(assignQuizId) : null,
      });
      const res = await axios.get(`/api/classes/${classId}/assignments`);
      setAssignments(res.data || []);
      setShowAssignModal(false);
      setAssignAnimalId(''); setAssignAnimalSearch('');
      setAssignQuizId(''); setAssignQuizSearch('');
      setAssignType('animal_quiz');
    } catch (err) {
      setAssignError(err.response?.data?.detail || 'Failed to create assignment');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await axios.delete(`/api/assignments/${assignmentId}?teacher_username=${user.username}`);
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) {
      setError('Failed to delete assignment');
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="dashboard">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !classroom) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="dashboard">
          <div className="error-message">{error}</div>
          <Link to="/teacher/classes">← Back to Classes</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="dashboard">

        {/* Header */}
        <div className="mb-8">
          <Link to="/teacher/classes" className="tc-back-link">
            ← Back to Classes
          </Link>
        </div>

        <div className="welcome-section">
          <h1>🏫 {classroom.name}</h1>
          <p>Taught by {classroom.teacher_username} · {students.length} student{students.length !== 1 ? 's' : ''}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Share code card */}
        <div
          className="tc-join-code-card"
        >
          <div>
            <p className="tc-join-code-label">
              Join Code
            </p>
            <h2 className="tc-join-code-value">
              {classroom.code}
            </h2>
          </div>
          <button
            onClick={handleCopyCode}
            className={`tc-copy-btn${copied ? ' copied' : ''}`}
          >
            {copied ? '✓ Copied!' : '📋 Copy invite message'}
          </button>
        </div>

        <div className="tc-two-col">

          {/* Students */}
          <div
            className="tc-panel"
          >
            <h3 className="tc-panel-h3">
              👥 Students
              <span className="tc-panel-count">({students.length})</span>
            </h3>

            {students.length > 0 && (
              <div className="tc-student-controls">
                <input
                  type="text"
                  className="tc-student-search"
                  placeholder="🔍 Search students..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                />
                <select
                  className="tc-student-sort"
                  value={studentSort}
                  onChange={e => setStudentSort(e.target.value)}
                >
                  <option value="alpha-asc">A → Z</option>
                  <option value="alpha-desc">Z → A</option>
                </select>
              </div>
            )}

            {students.length === 0 ? (
              <div className="empty-state tc-empty-state">
                <div className="empty-state-icon">👤</div>
                <p>No students yet. Share the join code!</p>
              </div>
            ) : (
              <div className="tc-student-list">
                {[...students]
                  .filter(s => s.username.toLowerCase().includes(studentSearch.toLowerCase()))
                  .sort((a, b) => studentSort === 'alpha-asc'
                    ? a.username.localeCompare(b.username)
                    : b.username.localeCompare(a.username))
                  .map(student => (
                  <div
                    key={student.username}
                    className={`tc-student-row${confirmRemove === student.username ? ' confirming' : ''}`}
                  >
                    <div className="tc-student-info">
                      <p className="tc-student-name">
                        {student.username}
                      </p>
                      <p className="tc-student-stats">
                        {student.discoveries} discoveries · {student.badges} badges · {student.quiz_scores} quizzes
                      </p>
                    </div>

                    {confirmRemove === student.username ? (
                      <div className="tc-confirm-btns">
                        <button
                          onClick={() => handleRemoveStudent(student.username)}
                          disabled={removingStudent === student.username}
                          className="tc-remove-confirm-btn"
                        >
                          {removingStudent === student.username ? '...' : 'Remove'}
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="tc-cancel-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(student.username)}
                        className="tc-remove-btn"
                        title="Remove student"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignments */}
          <div className="tc-panel">
            <div className="tc-panel-header">
              <h3 className="tc-panel-h3" style={{ margin: 0 }}>📝 Assignments</h3>
              <button className="tc-assign-btn"
                onClick={() => { setShowAssignModal(true); setAssignError(''); setAssignSuccess(''); }}>
                + Assign Quiz
              </button>
            </div>
            {assignments.length === 0 ? (
              <div className="empty-state tc-empty-state">
                <div className="empty-state-icon">📋</div>
                <p>No assignments yet. Use the button above to assign a quiz.</p>
              </div>
            ) : (
              <div className="tc-student-list">
                {assignments.map(a => (
                  <div key={a.id} className="tc-student-row">
                    <div className="tc-student-info">
                      <p className="tc-student-name">{a.source_name}</p>
                      <p className="tc-student-stats">{a.assignment_type === 'animal_quiz' ? '🐾 Animal Quiz' : '🧩 Custom Quiz'} · {a.completed_count}/{students.length} completed</p>
                    </div>
                    <button className="tc-remove-btn" title="Delete assignment"
                      onClick={() => handleDeleteAssignment(a.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* BioQuiz */}
        <div className="tc-panel tc-bioquiz-panel">
          <h3 className="tc-panel-h3">🎮 BioQuiz</h3>
          <p className="tc-bioquiz-desc">
            Launch a live quiz game for this class using one of your custom quizzes.
          </p>
          {savedQuizzes.length === 0 ? (
            <p className="tc-bioquiz-no-quizzes">No custom quizzes yet. Create one in <strong>Custom Quizzes</strong> first.</p>
          ) : (
            <div className="tc-bioquiz-picker">
              <div className="form-group">
                <label className="tc-bioquiz-picker-label">Select Quiz</label>
                <input
                  type="text"
                  className="tc-student-search"
                  style={{ width: '100%', marginBottom: 8 }}
                  placeholder="🔍 Search quizzes..."
                  autoComplete="off"
                  value={bioquizQuizSearch}
                  onChange={e => { setBioquizQuizSearch(e.target.value); setBioquizQuizId(''); }}
                />
                {bioquizQuizId ? (
                  <div className="tc-selected-quiz-row">
                    <span className="tc-selected-quiz-name">
                      ✓ {savedQuizzes.find(q => String(q.id) === bioquizQuizId)?.title}
                    </span>
                    <button onClick={() => { setBioquizQuizId(''); setBioquizQuizSearch(''); }}
                      className="tc-clear-btn">✕</button>
                  </div>
                ) : (
                  <div className="tc-picker-dropdown">
                    {savedQuizzes.filter(q => fuzzyMatch(q.title, bioquizQuizSearch)).map(q => (
                      <div key={q.id}
                        onClick={() => { setBioquizQuizId(String(q.id)); setBioquizQuizSearch(''); }}
                        className="tc-picker-row">
                        {q.title}
                        <span className="tc-picker-count">{q.question_count} Qs</span>
                      </div>
                    ))}
                    {savedQuizzes.filter(q => fuzzyMatch(q.title, bioquizQuizSearch)).length === 0 && (
                      <p className="tc-picker-empty">No quizzes found</p>
                    )}
                  </div>
                )}
              </div>
              <button
                className="btn-primary"
                style={{ maxWidth: 240, opacity: bioquizQuizId ? 1 : 0.45, cursor: bioquizQuizId ? 'pointer' : 'not-allowed' }}
                disabled={!bioquizQuizId}
                onClick={() => navigate(`/bioquiz?classroom=${classId}&quizId=${bioquizQuizId}`)}
              >
                🚀 Launch BioQuiz
              </button>
            </div>
          )}
        </div>

        {/* Class Leaderboard */}
        <div className="tc-panel" style={{ marginTop: 24 }}>
          <h3 className="tc-panel-h3">🏆 Class Leaderboard</h3>
          {classLeaderboard.length === 0 ? (
            <div className="empty-state tc-empty-state">
              <div className="empty-state-icon">🏆</div>
              <p>No points yet. Students earn points by completing quizzes, flashcards, and BioQuiz.</p>
            </div>
          ) : (
            <div className="tc-student-list">
              {classLeaderboard.map((entry, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <div key={entry.username} className="tc-student-row">
                    <div style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: medal ? '1.3rem' : '0.95rem', color: '#888' }}>
                      {medal || `#${i + 1}`}
                    </div>
                    <div className="tc-student-info">
                      <p className="tc-student-name">{entry.username}</p>
                      <p className="tc-student-stats">🔍 {entry.discoveries} discoveries · 🏅 {entry.badges} badges</p>
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

      </div>

      {showAssignModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAssignModal(false)}>
          <div className="modal-box">
            <h2 className="tc-modal-title">📋 Assign a Quiz</h2>
            <div className="form-group">
              <label>Quiz Type</label>
              <select value={assignType} onChange={e => { setAssignType(e.target.value); setAssignAnimalId(''); setAssignAnimalSearch(''); setAssignQuizId(''); setAssignQuizSearch(''); }}>
                <option value="animal_quiz">🐾 Animal Quiz</option>
                <option value="custom_quiz">🧩 Custom Quiz</option>
              </select>
            </div>
            {assignType === 'animal_quiz' && (
              <div className="form-group">
                <label>Select Animal</label>
                <input
                  type="text"
                  className="tc-student-search"
                  style={{ width: '100%', marginBottom: 8 }}
                  placeholder="🔍 Search animals..."
                  autoComplete="off"
                  value={assignAnimalSearch}
                  onChange={e => { setAssignAnimalSearch(e.target.value); setAssignAnimalId(''); }}
                />
                {assignAnimalId ? (
                  <div className="tc-modal-selected-row">
                    <span className="tc-modal-selected-name">
                      ✓ {allAnimals.find(a => String(a.id) === assignAnimalId)?.commonName}
                    </span>
                    <button onClick={() => { setAssignAnimalId(''); setAssignAnimalSearch(''); }}
                      className="tc-clear-btn">✕</button>
                  </div>
                ) : (
                  <div className="tc-modal-dropdown">
                    {allAnimals.filter(a => fuzzyMatch(a.commonName, assignAnimalSearch)).map(a => (
                      <div key={a.id}
                        onClick={() => { setAssignAnimalId(String(a.id)); setAssignAnimalSearch(''); }}
                        className="tc-modal-dropdown-row">
                        {a.commonName}
                      </div>
                    ))}
                    {allAnimals.filter(a => fuzzyMatch(a.commonName, assignAnimalSearch)).length === 0 && (
                      <p className="tc-picker-empty">No animals found</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {assignType === 'custom_quiz' && (
              <div className="form-group">
                <label>Select Custom Quiz</label>
                {savedQuizzes.length === 0 ? (
                  <p className="tc-modal-no-quizzes">No custom quizzes yet. Create one in Custom Quizzes.</p>
                ) : (<>
                  <input
                    type="text"
                    className="tc-student-search"
                    style={{ width: '100%', marginBottom: 8 }}
                    placeholder="🔍 Search quizzes..."
                    autoComplete="off"
                    value={assignQuizSearch}
                    onChange={e => { setAssignQuizSearch(e.target.value); setAssignQuizId(''); }}
                  />
                  {assignQuizId ? (
                    <div className="tc-modal-selected-row">
                      <span className="tc-modal-selected-name">
                        ✓ {savedQuizzes.find(q => String(q.id) === assignQuizId)?.title}
                      </span>
                      <button onClick={() => { setAssignQuizId(''); setAssignQuizSearch(''); }}
                        className="tc-clear-btn">✕</button>
                    </div>
                  ) : (
                    <div className="tc-modal-dropdown">
                      {savedQuizzes.filter(q => fuzzyMatch(q.title, assignQuizSearch)).map(q => (
                        <div key={q.id}
                          onClick={() => { setAssignQuizId(String(q.id)); setAssignQuizSearch(''); }}
                          className="tc-modal-dropdown-row">
                          {q.title}
                        </div>
                      ))}
                      {savedQuizzes.filter(q => fuzzyMatch(q.title, assignQuizSearch)).length === 0 && (
                        <p className="tc-picker-empty">No quizzes found</p>
                      )}
                    </div>
                  )}
                </>)}
              </div>
            )}
            {assignError && <div className="error-message">{assignError}</div>}
            {assignSuccess && <div className="success-message">{assignSuccess}</div>}
            <div className="tc-modal-actions">
              <button type="button" className="btn-back" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button type="button" className="btn-primary tc-modal-confirm-btn" onClick={handleAssign} disabled={assigning}>
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherClassDetail;