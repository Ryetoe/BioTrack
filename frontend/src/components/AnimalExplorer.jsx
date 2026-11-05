import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

// Simple fuzzy match: checks if all characters of the query appear in order in the target
function fuzzyMatch(target, query) {
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  // First check simple includes (exact substring)
  if (t.includes(q)) return { match: true, score: 2 };

  // Fuzzy: characters appear in order
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  if (qi === q.length) return { match: true, score: 1 };

  // Levenshtein-based tolerance for short queries (typo handling)
  if (q.length >= 3) {
    // Check if any word in the target starts similarly
    const words = t.split(/\s+/);
    for (const word of words) {
      if (levenshtein(word.slice(0, q.length + 1), q) <= Math.floor(q.length / 3)) {
        return { match: true, score: 0.5 };
      }
    }
  }

  return { match: false, score: 0 };
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
    }
  }
  return dp[m][n];
}

const CONSERVATION_STATUSES = [
  'All',
  'Critically Endangered',
  'Endangered',
  'Vulnerable',
  'Least Concern'
];

function AnimalExplorer({ user, onLogout }) {
  const [animals, setAnimals] = useState([]);
  const [filteredAnimals, setFilteredAnimals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnimals();
  }, []);

  // Read URL query param for pre-filtering (from Dashboard "Go" button)
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'endangered') {
      setSelectedStatus('Endangered');
    }
  }, [searchParams]);

  useEffect(() => {
    filterAnimals();
  }, [searchTerm, selectedCategory, selectedStatus, animals]);

  const fetchAnimals = async () => {
    try {
      const response = await axios.get('/api/animals');
      const animalsArray = Object.values(response.data);
      setAnimals(animalsArray);
      setFilteredAnimals(animalsArray);
    } catch (error) {
      console.error('Error fetching animals:', error);
    }
  };

  const filterAnimals = () => {
    let filtered = animals;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(animal => animal.category === selectedCategory);
    }

    // Filter by conservation status
    if (selectedStatus !== 'All') {
      if (selectedStatus === 'Endangered') {
        // "Endangered" filter shows both Endangered and Critically Endangered
        filtered = filtered.filter(animal =>
          animal.conservationStatus === 'Endangered' ||
          animal.conservationStatus === 'Critically Endangered'
        );
      } else {
        filtered = filtered.filter(animal => animal.conservationStatus === selectedStatus);
      }
    }

    // Fuzzy search
    if (searchTerm) {
      filtered = filtered
        .map(animal => {
          const nameMatch = fuzzyMatch(animal.commonName, searchTerm);
          const sciMatch = fuzzyMatch(animal.scientificName, searchTerm);
          const bestScore = Math.max(nameMatch.score, sciMatch.score);
          const isMatch = nameMatch.match || sciMatch.match;
          return { animal, score: bestScore, isMatch };
        })
        .filter(item => item.isMatch)
        .sort((a, b) => b.score - a.score)
        .map(item => item.animal);
    }

    setFilteredAnimals([...filtered].sort((a, b) => a.commonName.localeCompare(b.commonName)));
  };

  const categories = ['All', ...new Set(animals.map(a => a.category))];

  const getConservationBadgeClass = (status) => {
    const statusMap = {
      'Critically Endangered': 'badge-critically-endangered',
      'Endangered': 'badge-endangered',
      'Vulnerable': 'badge-vulnerable',
      'Least Concern': 'badge-least-concern'
    };
    return statusMap[status] || 'badge-least-concern';
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

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      
      <div className="explorer-container">
        <div className="explorer-header">
          <h1>🌍 Explore Wildlife</h1>
          <p>Discover amazing animals from around the world</p>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="🔍 Search by name or scientific name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <div className="filter-tabs">
          {categories.map(category => (
            <button
              key={category}
              className={`filter-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Conservation status filter */}
        <div className="filter-tabs filter-tabs-secondary">
          {CONSERVATION_STATUSES.map(status => (
            <button
              key={status}
              className={`filter-tab ${selectedStatus === status ? 'active' : ''}`}
              onClick={() => setSelectedStatus(status)}
              style={
                selectedStatus === status
                  ? {}
                  : status === 'Critically Endangered'
                    ? { borderColor: '#b71c1c', color: '#b71c1c' }
                    : status === 'Endangered'
                      ? { borderColor: '#d32f2f', color: '#d32f2f' }
                      : status === 'Vulnerable'
                        ? { borderColor: '#f57c00', color: '#f57c00' }
                        : {}
              }
            >
              {status}
            </button>
          ))}
        </div>

        <div className="animals-grid">
          {filteredAnimals.map(animal => (
            <div
              key={animal.id}
              className="animal-card"
              onClick={() => navigate(`/animal/${animal.id}`)}
            >
              <div className="animal-card-image" style={{ position: 'relative', overflow: 'hidden' }}>
                {animal.imageKey ? (
                  <img
                    src={`/images/${animal.imageKey}`}
                    alt={animal.commonName}
                    className="animal-card-image-photo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="animal-card-image-emoji-fallback" style={{ display: animal.imageKey ? 'none' : 'flex' }}>
                  {getAnimalEmoji(animal.category)}
                </div>
                <span className={`conservation-badge ${getConservationBadgeClass(animal.conservationStatus)}`}>
                  {animal.conservationStatus}
                </span>
              </div>
              <div className="animal-card-content">
                <h3>{animal.commonName}</h3>
                <p className="scientific-name">{animal.scientificName}</p>
                <div className="animal-info">
                  <div className="info-item">
                    <span className="info-icon">🌍</span>
                    <span>{animal.region}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">🏞️</span>
                    <span>{animal.habitat}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">🍽️</span>
                    <span>{animal.diet}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAnimals.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>No animals found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnimalExplorer;