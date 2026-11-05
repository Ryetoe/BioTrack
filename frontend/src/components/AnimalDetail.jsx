import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function AnimalDetail({ user, onLogout, updateUser }) {
  const { id } = useParams();
  const [animal, setAnimal] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnimal();
  }, [id]);

  useEffect(() => {
    if (user && animal) {
      setIsFavorite(user.favorites?.includes(animal.id) || false);
    }
  }, [user, animal]);

  const fetchAnimal = async () => {
    try {
      const response = await axios.get(`/api/animals/${id}`);
      setAnimal(response.data);
    } catch (error) {
      console.error('Error fetching animal:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      const endpoint = isFavorite ? '/api/favorites/remove' : '/api/favorites/add';
      const response = await axios.post(`${endpoint}?username=${user.username}`, {
        animal_id: animal.id
      });

      const updatedUser = { ...user, favorites: response.data.favorites };
      updateUser(updatedUser);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
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

  const getConservationColor = (status) => {
    const colorMap = {
      'Critically Endangered': '#b71c1c',
      'Endangered': '#d32f2f',
      'Vulnerable': '#f57c00',
      'Least Concern': '#7a9b54'
    };
    return colorMap[status] || '#7a9b54';
  };

  if (loading) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="loading-screen">
          <div className="safari-loader"></div>
          <p>Loading animal details...</p>
        </div>
      </div>
    );
  }

  if (!animal) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="animal-detail">
          <h1>Animal not found</h1>
          <button onClick={() => navigate('/explore')} className="btn-back">
            Back to Explorer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      
      <div className="animal-detail">
        <div className="detail-card">
          <div className="detail-header" style={{ position: 'relative', overflow: 'hidden' }}>
            {animal.imageKey ? (
              <img
                src={`/images/${animal.imageKey}`}
                alt={animal.commonName}
                className="detail-header-photo"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div className="detail-header-emoji-fallback" style={{ display: animal.imageKey ? 'none' : 'flex' }}>
              {getAnimalEmoji(animal.category)}
            </div>
          </div>

          <div className="detail-content">
            <div className="detail-title">
              <div>
                <h1>{animal.commonName}</h1>
                <p className="scientific-name">{animal.scientificName}</p>
              </div>
              <button
                onClick={toggleFavorite}
                className={`btn-favorite ${isFavorite ? 'favorited' : ''}`}
              >
                {isFavorite ? '❤️' : '🤍'} {isFavorite ? 'Favorited' : 'Add to Favorites'}
              </button>
            </div>

            <div className="info-grid">
              <div className="info-block">
                <h4>Category</h4>
                <p>{animal.category}</p>
              </div>
              <div className="info-block">
                <h4>Conservation Status</h4>
                <p style={{ color: getConservationColor(animal.conservationStatus) }}>
                  {animal.conservationStatus}
                </p>
              </div>
              <div className="info-block">
                <h4>Habitat</h4>
                <p>{animal.habitat}</p>
              </div>
              <div className="info-block">
                <h4>Region</h4>
                <p>{animal.region}</p>
              </div>
              <div className="info-block">
                <h4>Diet</h4>
                <p>{animal.diet}</p>
              </div>
              <div className="info-block">
                <h4>Lifespan</h4>
                <p>{animal.lifespan}</p>
              </div>
              <div className="info-block">
                <h4>Weight</h4>
                <p>{animal.weight}</p>
              </div>
              <div className="info-block">
                <h4>Height/Size</h4>
                <p>{animal.height}</p>
              </div>
              <div className="info-block">
                <h4>Population</h4>
                <p>{animal.population}</p>
              </div>
            </div>

            <div className="description">
              <h3>About {animal.commonName}</h3>
              <p>{animal.description}</p>
            </div>

            {animal.funFacts && animal.funFacts.length > 0 && (
              <div className="fun-facts">
                <h3>✨ Fun Facts</h3>
                <ul>
                  {animal.funFacts.map((fact, index) => (
                    <li key={index}>
                      <span>🔸</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(animal.conservationStatus === 'Endangered' || 
              animal.conservationStatus === 'Critically Endangered') && (
              <div className="conservation-alert">
                <h3>⚠️ Conservation Alert</h3>
                <p>
                  This species is {animal.conservationStatus.toLowerCase()}. Help raise awareness 
                  by sharing what you've learned and supporting conservation efforts!
                </p>
              </div>
            )}

            <div className="action-buttons">
              <button
                onClick={() => navigate(`/quiz/${animal.id}`)}
                className="btn-quiz"
              >
                📝 Take Quiz on {animal.commonName}
              </button>
              <button onClick={() => navigate('/explore')} className="btn-back">
                ← Back to Explorer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnimalDetail;