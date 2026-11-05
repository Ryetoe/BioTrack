import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function Dashboard({ user, onLogout, updateUser }) {
  const [animals, setAnimals] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [animalsRes, userRes] = await Promise.all([
        axios.get('/api/animals'),
        axios.get(`/api/user/${user.username}`),
      ]);
      setAnimals(Object.values(animalsRes.data));
      updateUser(userRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getEndangeredCount = () => {
    return animals.filter(a => 
      a.conservationStatus === 'Endangered' || 
      a.conservationStatus === 'Critically Endangered'
    ).length;
  };

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      
      <div className="dashboard">
        <div className="welcome-section">
          <h1>Welcome back, {user.username}! 🌍</h1>
          <p>Ready to continue your wildlife adventure?</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{user.points.toLocaleString()}</div>
            <div className="stat-label">Total Points</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🔍</div>
            <div className="stat-value">{user.discovered?.length || 0}</div>
            <div className="stat-label">Animals Discovered</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">❤️</div>
            <div className="stat-value">{user.favorites?.length || 0}</div>
            <div className="stat-label">Favorites</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏅</div>
            <div className="stat-value">{user.badges?.length || 0}</div>
            <div className="stat-label">Badges Unlocked</div>
          </div>
        </div>

        {getEndangeredCount() > 0 && (
          <div className="alert-section">
            <div>
              <h3>⚠️ Conservation Alert</h3>
              <p>
                {getEndangeredCount()} species in our database are endangered.
                Learn about them and help raise awareness!
              </p>
            </div>
            <Link to="/explore?status=endangered" className="text-decoration-none flex-shrink-0">
              <button className="btn-alert">Go →</button>
            </Link>
          </div>
        )}

          <div className="action-cards">
            <Link to="/explore" className="text-decoration-none">
              <div className="action-card">
                <div className="action-card-header action-card-header-green">
                  🦒 Explore Animals
                </div>
                <div className="action-card-body">
                  <p>Discover amazing wildlife from around the world. Browse by group or search for specific animals.</p>
                  <button className="btn-action">Start Exploring</button>
                </div>
              </div>
            </Link>

            <Link to="/classes" className="text-decoration-none">
              <div className="action-card">
                <div className="action-card-header action-card-header-orange">
                  🏫 Classes
                </div>
                <div className="action-card-body">
                  <p>Enroll in new courses or open your current classes to view leaderboards, assignments, and classmates.</p>
                  <button className="btn-action">View Classes</button>
                </div>
              </div>
            </Link>

            <Link to="/profile" className="text-decoration-none">
              <div className="action-card">
                <div className="action-card-header action-card-header-brown">
                  👤 My Profile
                </div>
                <div className="action-card-body">
                  <p>View your discoveries, favorite animals, quiz scores, and badges.             </p>
                  <button className="btn-action">View Profile</button>
                </div>
              </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;