import React, { useEffect, useMemo, useState } from 'react';
import Navigation from './Navigation';
import axios from 'axios';

// Simple fuzzy match: checks if all characters of the query appear in order in the target
function fuzzyMatch(target, query) {
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  if (t.includes(q)) return { match: true, score: 2 };

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  if (qi === q.length) return { match: true, score: 1 };

  if (q.length >= 3) {
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

function TeacherQuizBuilder({ user, onLogout }) {
  const [questionBank, setQuestionBank] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [expandedAnimalId, setExpandedAnimalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [bankTab, setBankTab] = useState('animals');
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [expandedSetId, setExpandedSetId] = useState(null);
  const [flashcardSetData, setFlashcardSetData] = useState({});
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [savedQuizzesLoading, setSavedQuizzesLoading] = useState(true);
  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [quizDetails, setQuizDetails] = useState({});
  const [confirmDeleteQuizId, setConfirmDeleteQuizId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchQuestionBank();
    fetchFlashcardSets();
    fetchSavedQuizzes();
  }, []);

  const fetchQuestionBank = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/question-bank');
      setQuestionBank(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load question bank');
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashcardSets = async () => {
    try {
      const res = await axios.get('/api/flashcard-sets');
      setFlashcardSets(res.data || []);
    } catch (err) {
      console.error('Failed to load flashcard sets', err);
    }
  };

  const fetchSavedQuizzes = async () => {
    setSavedQuizzesLoading(true);
    try {
      const res = await axios.get(`/api/custom-quizzes/teacher/${user.username}`);
      setSavedQuizzes(res.data || []);
    } catch (err) {
      console.error('Failed to load saved quizzes', err);
    } finally {
      setSavedQuizzesLoading(false);
    }
  };

  const loadQuizDetails = async (quizId) => {
    if (quizDetails[quizId]) return;
    try {
      const res = await axios.get(`/api/custom-quizzes/${quizId}`);
      setQuizDetails(prev => ({ ...prev, [quizId]: res.data.questions || [] }));
    } catch (err) {
      console.error('Failed to load quiz details', err);
    }
  };

  const toggleQuizExpanded = (quizId) => {
    if (expandedQuizId === quizId) {
      setExpandedQuizId(null);
    } else {
      setExpandedQuizId(quizId);
      loadQuizDetails(quizId);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    setDeleting(true);
    try {
      await axios.delete(`/api/custom-quizzes/${quizId}?teacher_username=${user.username}`);
      setSavedQuizzes(prev => prev.filter(q => q.id !== quizId));
      setConfirmDeleteQuizId(null);
      if (expandedQuizId === quizId) setExpandedQuizId(null);
    } catch (err) {
      console.error('Failed to delete quiz', err);
    } finally {
      setDeleting(false);
    }
  };

  const loadFlashcardSet = async (setId) => {
    if (flashcardSetData[setId]) return; // already loaded
    try {
      const res = await axios.get(`/api/flashcard-sets/${setId}`);
      setFlashcardSetData(prev => ({ ...prev, [setId]: res.data.cards }));
    } catch (err) {
      console.error('Failed to load flashcard set', err);
    }
  };

  const toggleSetExpanded = (setId) => {
    if (expandedSetId === setId) {
      setExpandedSetId(null);
    } else {
      setExpandedSetId(setId);
      loadFlashcardSet(setId);
    }
  };

  const makeFlashcardKey = (card) => `fc-${card.id}`;

  const addFlashcard = (card, setName, cards) => {
    const key = makeFlashcardKey(card);
    if (selectedQuestions.some(item => makeQuestionKey(item) === key)) return;

    // Build distractors from other cards in the same set
    const otherDefs = cards.filter(c => c.id !== card.id).map(c => c.definition);
    // Shuffle and take up to 3
    const shuffledOthers = [...otherDefs].sort(() => Math.random() - 0.5).slice(0, 3);
    while (shuffledOthers.length < 3) shuffledOthers.push('—');
    // Shuffle correct answer into a random position among the 4 options
    const options = [...shuffledOthers, card.definition].sort(() => Math.random() - 0.5);
    const answerIdx = options.indexOf(card.definition);

    const q = {
      animal_id: null,
      animal_name: setName,
      category: 'Flashcard',
      question_index: card.id,
      question: card.term,
      options,
      answer: answerIdx,
      isFlashcard: true,
      flashcard_id: card.id,
    };
    setSelectedQuestions(prev => [...prev, { ...q, _key: key }]);
  };

  const isFlashcardSelected = (card) =>
    selectedQuestions.some(item => item._key === makeFlashcardKey(card));

  const FLASHCARD_CATEGORY_META = {
    Mammal: { emoji: '🦁', color: '#e67e22' },
    Bird: { emoji: '🦅', color: '#2980b9' },
    Amphibian: { emoji: '🐸', color: '#27ae60' },
    Reptile: { emoji: '🦎', color: '#16a085' },
    Fish: { emoji: '🐠', color: '#8e44ad' },
    Invertebrate: { emoji: '🦋', color: '#c0392b' },
  };

  const groupedAnimals = useMemo(() => {
    const groups = {};

    for (const q of questionBank) {
      if (!groups[q.animal_id]) {
        groups[q.animal_id] = {
          animal_id: q.animal_id,
          animal_name: q.animal_name,
          category: q.category || 'Unknown',
          conservation_status: q.conservation_status || '',
          region: q.region || '',
          image_key: q.image_key || '',
          questions: [],
        };
      }
      groups[q.animal_id].questions.push(q);
    }

    return Object.values(groups).sort((a, b) =>
      a.animal_name.localeCompare(b.animal_name)
    );
  }, [questionBank]);

  const CONSERVATION_STATUSES = ['All', 'Critically Endangered', 'Endangered', 'Vulnerable', 'Least Concern'];

  const categories = useMemo(
    () => ['All', ...new Set(groupedAnimals.map(a => a.category).filter(Boolean))].sort(),
    [groupedAnimals]
  );

  const filteredAnimals = useMemo(() => {
    let filtered = groupedAnimals;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    if (selectedStatus !== 'All') {
      if (selectedStatus === 'Endangered') {
        filtered = filtered.filter(a =>
          a.conservation_status === 'Endangered' || a.conservation_status === 'Critically Endangered'
        );
      } else {
        filtered = filtered.filter(a => a.conservation_status === selectedStatus);
      }
    }

    if (searchTerm.trim()) {
      filtered = filtered
        .map(animal => {
          const animalMatch = fuzzyMatch(animal.animal_name, searchTerm);
          const bestQuestionScore = animal.questions.reduce((best, q) => {
            const questionMatch = fuzzyMatch(q.question, searchTerm);
            return Math.max(best, questionMatch.score);
          }, 0);
          const bestScore = Math.max(animalMatch.score, bestQuestionScore);
          return { animal, score: bestScore, isMatch: bestScore > 0 };
        })
        .filter(item => item.isMatch)
        .sort((a, b) => b.score - a.score)
        .map(item => item.animal);
    }

    return filtered;
  }, [groupedAnimals, selectedCategory, selectedStatus, searchTerm]);

  const makeQuestionKey = (q) => q._key || `${q.animal_id}-${q.question_index}`;

  const isSelected = (q) =>
    selectedQuestions.some(item => makeQuestionKey(item) === makeQuestionKey(q));

  const addQuestion = (q) => {
    if (isSelected(q)) return;
    setSelectedQuestions(prev => [...prev, q]);
  };

  const removeQuestion = (q) => {
    const key = makeQuestionKey(q);
    setSelectedQuestions(prev => prev.filter(item => makeQuestionKey(item) !== key));
  };

  const moveQuestion = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedQuestions.length) return;

    const updated = [...selectedQuestions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSelectedQuestions(updated);
  };

  const toggleAnimalExpanded = (animalId) => {
    setExpandedAnimalId(prev => (prev === animalId ? null : animalId));
  };

  const getAnimalEmoji = (category) => {
    const emojiMap = {
      Mammal: '🦁',
      Bird: '🦅',
      Amphibian: '🐸',
      Reptile: '🦎',
      Fish: '🐠',
      Invertebrate: '🦋',
      Crustacean: '🦐',
    };

    return emojiMap[category] || '🐾';
  };

  const getConservationBadgeClass = (status) => {
    const map = {
      'Critically Endangered': 'badge-critically-endangered',
      'Endangered': 'badge-endangered',
      'Vulnerable': 'badge-vulnerable',
      'Least Concern': 'badge-least-concern',
    };
    return map[status] || 'badge-least-concern';
  };

  const handleSaveQuiz = async () => {
    setError('');
    setSuccessMessage('');

    if (!quizTitle.trim()) {
      setError('Please enter a quiz title');
      return;
    }

    if (selectedQuestions.length === 0) {
      setError('Please add at least one question');
      return;
    }

    setSaving(true);
    try {
      await axios.post('/api/custom-quizzes', {
        title: quizTitle.trim(),
        description: quizDescription.trim(),
        teacher_username: user.username,
        questions: selectedQuestions.map((q, index) => ({
          animal_id: q.animal_id,
          question_index: q.question_index,
          order_index: index,
          is_flashcard: q.isFlashcard || false,
          flashcard_id: q.flashcard_id || null,
        })),
      });

      setSuccessMessage('Custom quiz created successfully');
      setQuizTitle('');
      setQuizDescription('');
      setSelectedQuestions([]);
      setExpandedAnimalId(null);
      fetchSavedQuizzes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save custom quiz');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="dashboard">
          <p>Loading question bank...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />

      <div className="explorer-container">
        <div className="explorer-header">
          <h1>🧩 Custom Quizzes</h1>
          <p>View saved quizzes, assign them to classes, or build a new one</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        {/* Saved Quizzes */}
        <div className="profile-section tqb-section">
          <h2>🗂️ My Custom Quizzes</h2>
          {savedQuizzesLoading ? (
            <p className="tqb-loading-text">Loading...</p>
          ) : savedQuizzes.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-state-icon">📭</div>
              <p>No custom quizzes yet. Build one below!</p>
            </div>
          ) : (
            <div className="tqb-selected-list" style={{ marginTop: 12 }}>
              {savedQuizzes.map(q => {
                const expanded = expandedQuizId === q.id;
                const questions = quizDetails[q.id] || [];
                return (
                  <div key={q.id} className="tqb-selected-card">
                    <div className="tqb-quiz-header-row">
                      <div className="tqb-quiz-header-info">
                        <div className="tqb-selected-top">
                          <span className="tqb-order-badge">{q.question_count ?? 0} Qs</span>
                        </div>
                        <p className="tqb-question-text tqb-quiz-title"><strong>{q.title}</strong></p>
                        {q.description && <p className="tqb-quiz-desc">{q.description}</p>}
                      </div>
                      <div className="tqb-quiz-actions">
                        <button className="tqb-quiz-view-btn"
                          onClick={() => toggleQuizExpanded(q.id)}>
                          {expanded ? 'Hide ▲' : 'View ▼'}
                        </button>
                        {confirmDeleteQuizId === q.id ? (
                          <>
                            <button className="tqb-quiz-delete-btn"
                              onClick={() => handleDeleteQuiz(q.id)} disabled={deleting}>
                              {deleting ? '...' : 'Confirm'}
                            </button>
                            <button className="tqb-quiz-cancel-btn"
                              onClick={() => setConfirmDeleteQuizId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="tqb-quiz-danger-btn"
                            onClick={() => setConfirmDeleteQuizId(q.id)}>
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                    {expanded && (
                      <div className="tqb-question-list" style={{ marginTop: 12 }}>
                        {questions.length === 0 ? (
                          <p className="tqb-loading-text">Loading questions...</p>
                        ) : questions.map((question, idx) => (
                          <div key={idx} className="tqb-question-card">
                            <p className="tqb-quiz-q-label">{question.animal_name}</p>
                            <p className="tqb-question-text">{question.question}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="profile-section tqb-section">
          <h2>📝 Build a New Quiz</h2>

          <div className="form-group">
            <label>Quiz Title</label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="Example: Savannah + Jungle Review"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={quizDescription}
              onChange={(e) => setQuizDescription(e.target.value)}
              placeholder="Optional instructions or notes for this custom quiz..."
              className="tc-auto-textarea form-textarea"
              rows={3}
            />
          </div>

          <button
            type="button"
            className="btn-primary tqb-save-btn"
            onClick={handleSaveQuiz}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Custom Quiz'}
          </button>
        </div>

        <div className="profile-section tqb-section">
          <h2>📚 Selected Questions ({selectedQuestions.length})</h2>

          {selectedQuestions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No questions selected</h3>
              <p>Choose questions from the bank below to build your quiz.</p>
            </div>
          ) : (
            <div className="tqb-selected-list">
              {selectedQuestions.map((q, index) => (
                <div key={makeQuestionKey(q)} className="tqb-selected-card">
                  <div className="tqb-selected-top">
                    <span className="tqb-order-badge">#{index + 1}</span>
                    <span className="tqb-animal-pill">{q.animal_name}</span>
                  </div>

                  <p className="tqb-question-text">{q.question}</p>

                  <div className="tqb-selected-actions">
                    <button
                      type="button"
                      className="tc-cancel-btn"
                      onClick={() => moveQuestion(index, -1)}
                      disabled={index === 0}
                    >
                      ↑ Up
                    </button>

                    <button
                      type="button"
                      className="tc-cancel-btn"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === selectedQuestions.length - 1}
                    >
                      ↓ Down
                    </button>

                    <button
                      type="button"
                      className="tc-remove-confirm-btn"
                      onClick={() => removeQuestion(q)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="explorer-header tqb-bank-header">
          <h1 className="tqb-bank-h1">🔎 Question Bank</h1>
          <p>Browse animals or flashcard sets and add questions to your quiz</p>
        </div>

        {/* Bank tab switcher */}
        <div className="filter-tabs" style={{ marginBottom: '16px' }}>
          <button className={`filter-tab ${bankTab === 'animals' ? 'active' : ''}`} onClick={() => setBankTab('animals')}>
            🐾 Animal Questions
          </button>
          <button className={`filter-tab ${bankTab === 'flashcards' ? 'active' : ''}`} onClick={() => setBankTab('flashcards')}>
            📚 Flashcard Sets
          </button>
        </div>

        {/* Animal questions tab */}
        {bankTab === 'animals' && (<>
        <div className="search-bar">
          <input
            type="text"
            placeholder="🔍 Search by animal or question..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Category filter */}
        <div className="filter-tabs">
          {categories.map(cat => (
            <button key={cat}
              className={`filter-tab ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>

        {/* Conservation status filter */}
        <div className="filter-tabs filter-tabs-secondary">
          {CONSERVATION_STATUSES.map(status => (
            <button key={status}
              className={`filter-tab ${selectedStatus === status ? 'active' : ''}`}
              onClick={() => setSelectedStatus(status)}
              style={selectedStatus === status ? {} :
                status === 'Critically Endangered' ? { borderColor: '#b71c1c', color: '#b71c1c' } :
                status === 'Endangered' ? { borderColor: '#d32f2f', color: '#d32f2f' } :
                status === 'Vulnerable' ? { borderColor: '#f57c00', color: '#f57c00' } : {}
              }>
              {status}
            </button>
          ))}
        </div>

        <div className="tqb-animal-bank-grid">
          {filteredAnimals.map(animal => {
            const expanded = expandedAnimalId === animal.animal_id;
            return (
              <div key={animal.animal_id} className="animal-card tqb-animal-card tqb-animal-card-default">
                <div className="animal-card-image" onClick={() => toggleAnimalExpanded(animal.animal_id)} style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  {animal.image_key ? (
                    <img
                      src={`/images/${animal.image_key}`}
                      alt={animal.animal_name}
                      className="tqb-animal-img"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className="tqb-animal-img-fallback" style={{ display: animal.image_key ? 'none' : 'flex' }}>
                    {getAnimalEmoji(animal.category)}
                  </div>
                  <span className={`conservation-badge ${getConservationBadgeClass(animal.conservation_status)}`}>
                    {animal.conservation_status || 'Unknown'}
                  </span>
                </div>
                <div className="animal-card-content">
                  <h3>{animal.animal_name}</h3>
                  <p className="scientific-name">{animal.category}{animal.region ? ` · ${animal.region}` : ''}</p>
                  <button type="button" className="btn-action"
                    onClick={() => toggleAnimalExpanded(animal.animal_id)}
                    style={{ marginBottom: expanded ? '16px' : '0' }}>
                    {expanded ? 'Hide Questions' : `View ${animal.questions.length} Question${animal.questions.length !== 1 ? 's' : ''}`}
                  </button>
                  {expanded && (
                    <div className="tqb-question-list">
                      {animal.questions.map((q) => (
                        <div key={makeQuestionKey(q)} className="tqb-question-card">
                          <p className="tqb-question-text">{q.question}</p>
                          <button type="button"
                            className={`btn-action tqb-add-btn ${isSelected(q) ? 'added' : ''}`}
                            onClick={() => addQuestion(q)} disabled={isSelected(q)}>
                            {isSelected(q) ? '✓ Added' : 'Add'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredAnimals.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>No animals found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
        </>)}

        {/* Flashcard sets tab */}
        {bankTab === 'flashcards' && (
          <div className="tqb-animal-bank-grid" style={{ marginTop: '16px' }}>
            {flashcardSets.map(set => {
              const meta = FLASHCARD_CATEGORY_META[set.category] || { emoji: '📚', color: '#4a6fa5' };
              const expanded = expandedSetId === set.id;
              const cards = flashcardSetData[set.id] || [];
              return (
                <div key={set.id} className="animal-card tqb-animal-card" style={{ cursor: 'default' }}>
                  <div className="animal-card-image" style={{ background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color})`, cursor: 'pointer' }}
                    onClick={() => toggleSetExpanded(set.id)}>
                    {meta.emoji}
                    <span className="conservation-badge badge-least-concern">{set.count} cards</span>
                  </div>
                  <div className="animal-card-content">
                    <h3>{set.category}</h3>
                    <p className="scientific-name">Click to {expanded ? 'collapse' : 'expand'} terms</p>
                    <button type="button" className="btn-action" onClick={() => toggleSetExpanded(set.id)}
                      style={{ marginBottom: expanded ? '16px' : '0' }}>
                      {expanded ? 'Hide Terms' : `View ${set.count} Term${set.count !== 1 ? 's' : ''}`}
                    </button>
                    {expanded && (
                      <div className="tqb-question-list">
                        {cards.length === 0 ? (
                          <p className="tqb-loading-text">Loading...</p>
                        ) : cards.map(card => (
                          <div key={card.id} className="tqb-question-card">
                            <p className="tqb-question-text"><strong>{card.term}</strong> — {card.definition}</p>
                            <button type="button"
                              className={`btn-action tqb-add-btn ${isFlashcardSelected(card) ? 'added' : ''}`}
                              onClick={() => addFlashcard(card, set.category, cards)}
                              disabled={isFlashcardSelected(card)}>
                              {isFlashcardSelected(card) ? '✓ Added' : 'Add'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {flashcardSets.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <h3>No flashcard sets found</h3>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default TeacherQuizBuilder;