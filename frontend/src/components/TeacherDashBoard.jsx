import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function TeacherDashboard({ user, onLogout }) {
  const [classes, setClasses] = useState([]);
  const [totalAssignments, setTotalAssignments] = useState(0);

  useEffect(() => {
    axios.get(`/api/classes/teacher/${user.username}`)
      .then(async r => {
        setClasses(r.data);
        // Fetch assignment counts for all classes in parallel
        const counts = await Promise.all(
          r.data.map(cls =>
            axios.get(`/api/classes/${cls.id}/assignments`)
              .then(res => res.data.length)
              .catch(() => 0)
          )
        );
        setTotalAssignments(counts.reduce((a, b) => a + b, 0));
      })
      .catch(() => {});
  }, [user.username]);

  const totalStudents = classes.reduce((sum, c) => sum + (c.member_count || 0), 0);

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />

      <div className="dashboard">
        <div className="welcome-section">
          <h1>Welcome back, {user.username}! 👩‍🏫</h1>
          <p>Manage your classroom and get ready to build engaging wildlife lessons.</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🏫</div>
            <div className="stat-value">{classes.length}</div>
            <div className="stat-label">Classes</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{totalStudents}</div>
            <div className="stat-label">Students</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-value">{totalAssignments}</div>
            <div className="stat-label">Assignments</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">0</div>
            <div className="stat-label">Reports</div>
          </div>
        </div>

        <div
          className="alert-section alert-section-green"
        >
          <div>
            <h3>
              📚 Teacher Tools
            </h3>
            <p>
              Start by creating your first class.
            </p>
          </div>

          <Link to="/teacher/classes" className="text-decoration-none flex-shrink-0">
            <button
              className="btn-alert btn-alert-green"
            >
              Create Class →
            </button>
          </Link>
        </div>

        <div className="action-cards">
          <Link to="/teacher/classes" className="text-decoration-none">
            <div className="action-card">
              <div className="action-card-header action-card-header-green">
                🏫 My Classes
              </div>
              <div className="action-card-body">
                <p>Set up and manage classroom spaces for your students.</p>
                <button className="btn-action">Open Class Manager</button>
              </div>
            </div>
          </Link>

          <Link to="/teacher/custom-quizzes" className="text-decoration-none">
            <div className="action-card">
              <div className="action-card-header action-card-header-orange">
                🧩 Custom Quizzes
              </div>
              <div className="action-card-body">
                <p>Build quizzes from animal questions and flashcard sets, then assign them to your classes.</p>
                <button className="btn-action">Open Quiz Builder</button>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;