import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function Profile({ user, onLogout, updateUser }) {
  const [animals, setAnimals] = useState([]);
  const [favoriteAnimals, setFavoriteAnimals] = useState([]);
  const [badgeMeta, setBadgeMeta] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnimals();
    // Refresh user so points/badges earned elsewhere show up
    axios.get(`/api/user/${user.username}`)
      .then(r => updateUser(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (animals.length > 0 && user.favorites) {
      const favs = animals.filter(animal => user.favorites.includes(animal.id));
      setFavoriteAnimals(favs);
    }
  }, [animals, user.favorites]);

  useEffect(() => {
  const fetchBadges = async () => {
    try {
      const res = await axios.get('/api/badges');
      setBadgeMeta(res.data || {});
    } catch (err) {
      console.error('Error fetching badges:', err);
      setBadgeMeta({});
    }
  };
  fetchBadges();
  }, []);

  const fetchAnimals = async () => {
    try {
      const response = await axios.get('/api/animals');
      setAnimals(Object.values(response.data));
    } catch (error) {
      console.error('Error fetching animals:', error);
    }
  };

  const getDiscoveredAnimals = () => {
    if (!user.discovered) return [];
    return animals.filter(animal => user.discovered.includes(animal.id));
  };



  const getAnimalEmoji = (category) => {
    const emojiMap = {
      'Mammal': '🦁',
      'Bird': '🦅',
      'Amphibian': '🐸',
      'Reptile': '🦎',
      'Fish': '🐠',
      'Invertebrate': '🦋'
    };
    return emojiMap[category] || '🐾';
  };

  const discoveredAnimals = getDiscoveredAnimals();

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      
      <div className="profile-container">
        <div className="profile-header">
          <h1>👤 {user.username}'s Profile</h1>
          <p>Your wildlife exploration journey</p>
          
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-value">{(user.points || 0).toLocaleString()}</div>
              <div className="profile-stat-label">Total Points</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{user.discovered?.length || 0}</div>
              <div className="profile-stat-label">Discoveries</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{user.favorites?.length || 0}</div>
              <div className="profile-stat-label">Favorites</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{user.badges?.length || 0}</div>
              <div className="profile-stat-label">Badges</div>
            </div>
          </div>
        </div>

        <div className="profile-sections">
          {/* Favorite Animals */}
          <div className="profile-section">
            <h2>❤️ Favorite Animals</h2>
            {favoriteAnimals.length > 0 ? (
              <div className="favorites-grid">
                {favoriteAnimals.map(animal => (
                  <div
                    key={animal.id}
                    className="favorite-item"
                    onClick={() => navigate(`/animal/${animal.id}`)}
                  >
                    <div className="profile-animal-emoji">{getAnimalEmoji(animal.category)}</div>
                    <h4 className="profile-animal-name">{animal.commonName}</h4>
                    <p className="profile-animal-sci">{animal.scientificName}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">❤️</div>
                <h3>No favorites yet</h3>
                <p>Explore animals and add them to your favorites!</p>
                <button
                  onClick={() => navigate('/explore')}
                  className="btn-action btn-action-inline"
                >
                  Explore Animals
                </button>
              </div>
            )}
          </div>

          {/* Discovered Animals */}
          <div className="profile-section">
            <h2>🔍 Discovered Animals</h2>
            {discoveredAnimals.length > 0 ? (
              <div className="favorites-grid">
                {discoveredAnimals.map(animal => (
                  <div
                    key={animal.id}
                    className="favorite-item"
                    onClick={() => navigate(`/animal/${animal.id}`)}
                  >
                    <div className="profile-animal-emoji">{getAnimalEmoji(animal.category)}</div>
                    <h4 className="profile-animal-name">{animal.commonName}</h4>
                    <p className="profile-animal-sci">{animal.scientificName}</p>
                    {user.quiz_scores && user.quiz_scores[animal.id] !== undefined && (
                      <div className="quiz-score-badge">Quiz: {user.quiz_scores[animal.id] * 100} pts</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <h3>No discoveries yet</h3>
                <p>Take quizzes to discover new animals!</p>
                <button
                  onClick={() => navigate('/explore')}
                  className="btn-action btn-action-inline"
                >
                  Start Exploring
                </button>
              </div>
            )}
          </div>

          {/* Badges (if implemented) */}
          {user.badges && user.badges.length > 0 && (
            <div className="profile-section">
              <h2>🏅 Badges</h2>

              <div className="badges-row">
                {user.badges.map((badgeId) => {
                  const meta = badgeMeta[badgeId];

                  // Fallback if badges.json is empty or missing this badgeId
                  const label = meta?.name || badgeId;
                  const icon = meta?.icon || "🏅";

                  return (
                    <div key={badgeId} className="badge-wrapper">
                      <div
                        className="badge-pill"
                      >
                        {icon} {label}
                      </div>

                      <div className="badge-tooltip">
                        {meta?.description || ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;