import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AnimalExplorer from './components/AnimalExplorer';
import AnimalDetail from './components/AnimalDetail';
import Quiz from './components/Quiz';
import Profile from './components/Profile';
import './App.css';
import { THEMES, applyTheme, loadThemeName } from "./theme";
import Settings from "./components/Settings";
import { FlashcardSets, FlashcardSetDetail, FlashcardStudyPage, MatchGamePage } from './components/Flashcards';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherClasses from './components/TeacherClasses';
import TeacherClassDetail from './components/TeacherClassDetail';
import StudentClasses from './components/StudentClasses';
import StudentClassDetail from './components/StudentClassDetail';
import Inbox from './components/Inbox';
import TeacherQuizBuilder from './components/TeacherQuizBuilder';
import { BioQuizHost, BioQuizJoin } from './components/BioQuiz';
import CustomQuiz from './components/CustomQuiz';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('biotrack_user');

    const themeName = loadThemeName();
    applyTheme(THEMES[themeName]);

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('biotrack_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('biotrack_user');
  };

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem('biotrack_user', JSON.stringify(updatedUserData));
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="safari-loader"></div>
        <p>Loading Safari...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app safari-theme">
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
          } />
          <Route path="/register" element={
            user ? <Navigate to="/dashboard" /> : <Register onLogin={handleLogin} />
          } />
          <Route path="/dashboard" element={
              user ? (
                user.role === 'teacher'
                  ? <TeacherDashboard user={user} onLogout={handleLogout} />
                  : <Dashboard user={user} onLogout={handleLogout} updateUser={updateUser} />
              ) : <Navigate to="/login" />
            }
          />
          <Route path="/explore" element={
            user ? <AnimalExplorer user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/flashcards" element={
            user ? <FlashcardSets user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/flashcards/:setId" element={
            user ? <FlashcardSetDetail user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/flashcards/:setId/study" element={
            user ? <FlashcardStudyPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/flashcards/:setId/match" element={
            user ? <MatchGamePage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/animal/:id" element={
            user ? <AnimalDetail user={user} onLogout={handleLogout} updateUser={updateUser} /> : <Navigate to="/login" />
          } />
          <Route path="/quiz/:animalId" element={
            user ? <Quiz user={user} onLogout={handleLogout} updateUser={updateUser} /> : <Navigate to="/login" />
          } />
          <Route path="/custom-quiz/:quizId" element={
              user ? <CustomQuiz user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route path="/profile" element={
            user ? <Profile user={user} onLogout={handleLogout} updateUser={updateUser} /> : <Navigate to="/login" />
          } />
          <Route path="/settings" element={
            user ? <Settings user={user} onLogout={handleLogout} updateUser={updateUser} /> : <Navigate to="/login" />
          } />
          <Route path="/teacher/classes" element={
              user ? (
                user.role === 'teacher'
                  ? <TeacherClasses user={user} onLogout={handleLogout} />
                  : <Navigate to="/dashboard" />
              ) : <Navigate to="/login" />
            }
          />
          <Route path="/teacher/classes/:classId" element={
            user ? <TeacherClassDetail user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/classes" element={
              user ? (
                user.role === 'teacher'
                  ? <Navigate to="/teacher/classes" />
                  : <StudentClasses user={user} onLogout={handleLogout} />
              ) : <Navigate to="/login" />
            }
          />
          <Route path="/teacher/custom-quizzes" element={
              user ? (
                user.role === 'teacher' ? (
                  <TeacherQuizBuilder user={user} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/dashboard" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route path="/classes/:classId" element={
            user ? <StudentClassDetail user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/inbox" element={
            user ? <Inbox user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/bioquiz" element={
            user
              ? user.role === 'teacher'
                ? <BioQuizHost user={user} onLogout={handleLogout} />
                : <BioQuizJoin user={user} onLogout={handleLogout} />
              : <Navigate to="/login" />
          } />
          <Route path="/bioquiz/join" element={user ? <BioQuizJoin user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;