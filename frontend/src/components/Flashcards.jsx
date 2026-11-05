import '../App.css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORY_META = {
  Mammal:      { emoji: '🦁', color: '#e67e22' },
  Bird:        { emoji: '🦅', color: '#2980b9' },
  Amphibian:   { emoji: '🐸', color: '#27ae60' },
  Reptile:     { emoji: '🦎', color: '#16a085' },
  Fish:        { emoji: '🐠', color: '#8e44ad' },
  Invertebrate:{ emoji: '🦋', color: '#c0392b' },
};
const DEFAULT_META = { emoji: '📚', color: '#4a6fa5' };
const getMeta = (cat) => CATEGORY_META[cat] || DEFAULT_META;
const PENALTY_MS = 2000;
const MATCH_COUNT = 6;
const STATUSES = ['mastered', 'learning', 'struggling'];
const STATUS_META = {
  mastered:   { label: 'Mastered',   emoji: '✅', color: '#27ae60' },
  learning:   { label: 'Learning',   emoji: '📖', color: '#f39c12' },
  struggling: { label: 'Struggling', emoji: '😅', color: '#e74c3c' },
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const dec = Math.floor((ms % 1000) / 100);
  return `${s}.${dec}s`;
}

// ── Progress hook ──────────────────────────────────────────────────────────────
function useProgress(user, setId, cards) {
  const [progress, setProgressState] = useState({});

  useEffect(() => {
    if (!user || !setId || !cards) return;
    axios.get(`/api/flashcard-progress/${user.username}/${setId}`)
      .then(r => setProgressState(r.data || {}))
      .catch(() => {});
  }, [user?.username, setId, !!cards]);

  const updateCard = useCallback((cardId, patch) => {
    if (!user) return;
    setProgressState(prev => ({
      ...prev,
      [cardId]: { ...(prev[cardId] || {}), ...patch },
    }));
    axios.post('/api/flashcard-progress', {
      username: user.username,
      set_id: parseInt(setId),
      card_id: cardId,
      starred: patch.starred !== undefined ? patch.starred : null,
      status: patch.status !== undefined ? (patch.status || 'none') : null,
    }).catch(() => {});
  }, [user, setId]);

  return [progress, updateCard];
}

// ── Star button ────────────────────────────────────────────────────────────────
function StarBtn({ cardId, progress, onUpdate }) {
  const starred = progress[cardId]?.starred;
  return (
    <button
      className="fc-star-btn"
      title={starred ? 'Remove from starred' : 'Star this card'}
      onClick={e => { e.stopPropagation(); onUpdate(cardId, { starred: !starred }); }}
      style={{ color: starred ? '#f1c40f' : '#ccc' }}
    >
      {starred ? '★' : '☆'}
    </button>
  );
}

// ── Finish message logic ───────────────────────────────────────────────────────
function isCloseToPB(finalMs, pbMs) {
  return finalMs > pbMs && (finalMs - pbMs) <= Math.max(3000, pbMs * 0.10);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getFinishMessage({ isFirstTime, isNewBest, closeToNewBest, penaltyCount }) {
  if (isFirstTime) return { emoji: '🎉', heading: "You're on the board!", sub: "That's your first time completing this set. Can you beat it?" };
  if (isNewBest && penaltyCount === 0) return { emoji: '🏆', ...pick([
    { heading: "Clean sweep. New personal best!", sub: "Zero mistakes and a faster time. Impressive." },
    { heading: "Flawless and faster!", sub: "No penalties and a new record. You're on fire." },
  ])};
  if (isNewBest) return { emoji: '🎉', ...pick([
    { heading: "New personal best!", sub: "Even with a few slip-ups, you came out faster." },
    { heading: "New best time!", sub: "A few mistakes, but still your fastest run yet." },
  ])};
  if (closeToNewBest && penaltyCount === 0) return { emoji: '😤', ...pick([
    { heading: "So close! Almost a new best.", sub: "That was a clean run — just a little more speed." },
    { heading: "Right on the edge!", sub: "A clean run that nearly broke your record. Go again!" },
  ])};
  if (closeToNewBest) return { emoji: '😅', ...pick([
    { heading: "So close to your best!", sub: "Cut the penalties and you'll smash your record." },
    { heading: "Almost there!", sub: "You were right on your PB's heels. Try again!" },
  ])};
  if (penaltyCount === 0) return { emoji: '✨', ...pick([
    { heading: "No mistakes! Now go faster.", sub: "Perfect accuracy — work on the speed next." },
    { heading: "Clean run! Beat your record?", sub: "Zero penalties. Can you shave off some time?" },
  ])};
  if (penaltyCount >= 3) return { emoji: '💪', ...pick([
    { heading: "Shake it off. Try again!", sub: "A few too many mismatches — you've got this." },
    { heading: "Rough round. You can do better.", sub: "Don't let the penalties discourage you." },
  ])};
  return { emoji: '🎯', ...pick([
    { heading: "Great start! Now can you do even better?", sub: "You know the material — now beat your time." },
    { heading: "Good effort. Chase that record!", sub: "Cut down the penalties and the time will follow." },
  ])};
}

// ── Set Browser ────────────────────────────────────────────────────────────────
export function FlashcardSets({ user, onLogout }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/flashcard-sets').then(r => setSets(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="fc-page">
      <Navigation user={user} onLogout={onLogout} />
      <div className="fc-container">
        <div className="fc-page-header">
          <h1 className="fc-page-title">Study Sets</h1>
          <p className="fc-page-subtitle">Choose a category to study</p>
        </div>
        {loading ? <div className="fc-loading">Loading…</div> : (
          <div className="fc-sets-grid">
            {sets.map(set => {
              const meta = getMeta(set.category);
              return (
                <div key={set.id} className="fc-set-card" style={{ borderTop: `4px solid ${meta.color}` }}
                  onClick={() => navigate(`/flashcards/${set.id}`)}>
                  <div className="fc-set-emoji">{meta.emoji}</div>
                  <div className="fc-set-info">
                    <h3 className="fc-set-title">{set.category}</h3>
                    <p className="fc-set-count">{set.count} terms</p>
                  </div>
                  <span className="fc-set-arrow" style={{ color: meta.color }}>›</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Set Detail Page ────────────────────────────────────────────────────────────
export function FlashcardSetDetail({ user, onLogout }) {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [setData, setSetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [progress, updateCard] = useProgress(user, setId, setData?.cards);

  useEffect(() => {
    axios.get(`/api/flashcard-sets/${setId}`)
      .then(r => setSetData(r.data))
      .catch(() => navigate('/flashcards'))
      .finally(() => setLoading(false));
  }, [setId]);

  if (loading) return <div className="fc-page"><Navigation user={user} onLogout={onLogout} /><div className="fc-loading">Loading…</div></div>;
  if (!setData) return null;

  const meta = getMeta(setData.category);
  const cards = setData.cards;

  const starredCards = cards.filter(c => progress[c.id]?.starred);
  const statusGroups = Object.fromEntries(STATUSES.map(s => [s, cards.filter(c => progress[c.id]?.status === s)]));
  const filterCounts = { all: cards.length, starred: starredCards.length, ...Object.fromEntries(STATUSES.map(s => [s, statusGroups[s].length])) };

  const filteredCards = activeFilter === 'all' ? cards
    : activeFilter === 'starred' ? starredCards
    : statusGroups[activeFilter] || [];

  const filters = [
    { key: 'all', label: 'All', emoji: '📚' },
    { key: 'starred', label: 'Starred', emoji: '★' },
    ...STATUSES.map(s => ({ key: s, label: STATUS_META[s].label, emoji: STATUS_META[s].emoji })),
  ];

  return (
    <div className="fc-page">
      <Navigation user={user} onLogout={onLogout} />
      <div className="fc-container">

        <Link to="/flashcards" className="fc-back-link">← Study Sets</Link>
        <div className="fc-detail-title-row">
          <span className="fc-detail-emoji">{meta.emoji}</span>
          <div>
            <h1 className="fc-detail-title">{setData.category}</h1>
            <p className="fc-detail-meta">{cards.length} terms</p>
          </div>
        </div>

        {/* Mode buttons */}
        <div className="fc-mode-button-row">
          <button className="fc-mode-button" style={{ background: meta.color, borderColor: meta.color, color: '#fff' }}
            onClick={() => navigate(`/flashcards/${setId}/study`)}>🃏 Flashcards</button>
          <button className="fc-mode-button" style={{ background: meta.color, borderColor: meta.color, color: '#fff' }}
            onClick={() => navigate(`/flashcards/${setId}/match`)}>🔗 Match</button>
        </div>

        {/* Filter bar */}
        <div className="fc-filter-bar">
          {filters.map(f => (
            <button key={f.key}
              className={`fc-filter-btn${activeFilter === f.key ? ' active' : ''}`}
              style={activeFilter === f.key ? { borderColor: meta.color, color: meta.color, background: meta.color + '15' } : {}}
              onClick={() => setActiveFilter(f.key)}>
              {f.emoji} {f.label}
              <span className="fc-filter-count">{filterCounts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* Filtered study action bar */}
        {activeFilter !== 'all' && filteredCards.length > 0 && (
          <div className="fc-filtered-study-bar">
            <span className="fc-filtered-study-label">
              {filteredCards.length} {activeFilter === 'starred' ? 'starred' : STATUS_META[activeFilter]?.label.toLowerCase()} card{filteredCards.length !== 1 ? 's' : ''}
            </span>
            <button className="fc-mode-button"
              style={{ background: meta.color, borderColor: meta.color, color: '#fff', padding: '8px 20px', fontSize: 14 }}
              onClick={() => navigate(`/flashcards/${setId}/study`, { state: { cardIds: filteredCards.map(c => c.id) } })}>
              🃏 Study these cards
            </button>
          </div>
        )}
        {activeFilter !== 'all' && filteredCards.length === 0 && (
          <div className="fc-filter-empty">No cards in this category yet.</div>
        )}

        {/* Terms list */}
        <div className="fc-terms-section">
          <h2 className="fc-terms-section-title">
            {activeFilter === 'all'
              ? `All terms (${cards.length})`
              : `${activeFilter === 'starred' ? 'Starred' : STATUS_META[activeFilter]?.label} (${filteredCards.length})`}
          </h2>
          <div className="fc-terms-list">
            {filteredCards.map(card => {
              const cp = progress[card.id] || {};
              const sm = cp.status ? STATUS_META[cp.status] : null;
              return (
                <div key={card.id} className="fc-term-row">
                  <div className="fc-term-word" style={{ borderRight: `3px solid ${meta.color}` }}>
                    <span className="fc-term-text">{card.term}</span>
                    {sm && <span className="fc-term-status-badge" style={{ background: sm.color + '22', color: sm.color }}>{sm.emoji} {sm.label}</span>}
                  </div>
                  <div className="fc-term-def">{card.definition}</div>
                  <div className="fc-term-actions">
                    <StarBtn cardId={card.id} progress={progress} onUpdate={updateCard} />
                    <div className="fc-term-status-dots">
                      {STATUSES.map(s => {
                        const active = cp.status === s;
                        return (
                          <button key={s}
                            className={`fc-term-status-dot${active ? ' active' : ''}`}
                            title={STATUS_META[s].label}
                            style={active ? { background: STATUS_META[s].color, borderColor: STATUS_META[s].color } : {}}
                            onClick={() => updateCard(card.id, { status: active ? null : s })} />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>



      </div>
    </div>
  );
}

// ── Flashcard Study Page ───────────────────────────────────────────────────────
export function FlashcardStudyPage({ user, onLogout }) {
  const { setId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [setData, setSetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, updateCard] = useProgress(user, setId, setData?.cards);

  const filteredIds = location.state?.cardIds || null;

  useEffect(() => {
    axios.get(`/api/flashcard-sets/${setId}`)
      .then(r => {
        setSetData(r.data);
        const all = r.data.cards;
        const subset = filteredIds ? all.filter(c => filteredIds.includes(c.id)) : all;
        setDeck(shuffle(subset));
      })
      .catch(() => navigate('/flashcards'))
      .finally(() => setLoading(false));
  }, [setId]);

  if (loading) return <div className="fc-page"><Navigation user={user} onLogout={onLogout} /><div className="fc-loading">Loading…</div></div>;
  if (!setData || deck.length === 0) return null;

  const meta = getMeta(setData.category);
  const current = deck[index];
  const progressPct = (index / deck.length) * 100;
  const isLast = index === deck.length - 1;

  const goNext = () => {
    setFlipped(false);
    if (isLast) {
      // Award 50 pts per card studied
      if (user) {
        axios.post('/api/points/award', { username: user.username, points: deck.length * 50, source: 'flashcard' })
          .catch(() => {});
      }
      setTimeout(() => setDone(true), 150);
    } else {
      setTimeout(() => setIndex(i => i + 1), 120);
    }
  };

  const goPrev = () => {
    setFlipped(false);
    setTimeout(() => setIndex(i => Math.max(0, i - 1)), 120);
  };

  const restart = (useFiltered = false) => {
    const base = setData.cards;
    const subset = useFiltered && filteredIds ? base.filter(c => filteredIds.includes(c.id)) : base;
    setDeck(shuffle(subset));
    setIndex(0);
    setFlipped(false);
    setDone(false);
  };

  // ── End screen ──
  if (done) {
    return (
      <div className="fc-page">
        <Navigation user={user} onLogout={onLogout} />
        <div className="fc-container fc-study-container-narrow">
          <div className="fc-end-screen">
            <div className="fc-end-icon">🎓</div>
            <h1 className="fc-end-heading">You've gone through all {deck.length} cards!</h1>
            <p className="fc-end-sub">What would you like to do next?</p>
            <div className="fc-end-actions">
              <button className="fc-end-btn-primary" style={{ background: meta.color }} onClick={() => restart(false)}>
                🔀 Shuffle &amp; restart all
              </button>
              {filteredIds && (
                <button className="fc-end-btn-secondary" onClick={() => restart(true)}>
                  🔁 Restart filtered set
                </button>
              )}
              <button className="fc-end-btn-secondary" onClick={() => navigate(`/flashcards/${setId}`)}>
                ← Back to {setData.category}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cardProgress = progress[current.id] || {};

  return (
    <div className="fc-page">
      <Navigation user={user} onLogout={onLogout} />
      <div className="fc-container">
        <Link to={`/flashcards/${setId}`} className="fc-back-link">← {setData.category}</Link>

        <div className="fc-wrapper">
          <div className="fc-progress-outer">
            <div className="fc-progress-inner" style={{ width: `${progressPct}%`, background: meta.color }} />
          </div>
          <div className="fc-top-row">
            <span className="fc-counter">{index + 1} / {deck.length}</span>
            {filteredIds && <span className="fc-filter-pill" style={{ background: meta.color + '22', color: meta.color }}>Filtered</span>}
          </div>

          <div className="fc-card-scene" onClick={() => setFlipped(f => !f)}>
            <div className={`fc-card-inner${flipped ? ' flipped' : ''}`}>
              <div className="fc-card-face" style={{ borderBottom: `3px solid ${meta.color}` }}>
                <div className="fc-card-top-actions">
                  <StarBtn cardId={current.id} progress={progress} onUpdate={updateCard} />
                </div>
                <span className="fc-card-side-label">Term</span>
                <p className="fc-card-term">{current.term}</p>
                <span className="fc-card-hint">Click to see definition</span>
              </div>
              <div className="fc-card-face fc-card-back" style={{ borderBottom: `3px solid ${meta.color}` }}>
                <div className="fc-card-top-actions">
                  <StarBtn cardId={current.id} progress={progress} onUpdate={updateCard} />
                </div>
                <span className="fc-card-side-label">Definition</span>
                <p className="fc-card-def">{current.definition}</p>
              </div>
            </div>
          </div>

          <div className="fc-controls">
            <button className="fc-nav-btn" onClick={goPrev} disabled={index === 0}>‹</button>
            {flipped ? (
              <div className="fc-after-flip-btns">
                <p className="fc-status-prompt">How well did you know this?</p>
                <div className="fc-status-row">
                  {STATUSES.map(s => {
                    const sm = STATUS_META[s];
                    const active = cardProgress.status === s;
                    return (
                      <button key={s}
                        className={`fc-status-btn${active ? ' active' : ''}`}
                        style={active ? { background: sm.color, borderColor: sm.color, color: '#fff' } : {}}
                        onClick={e => { e.stopPropagation(); updateCard(current.id, { status: s }); goNext(); }}>
                        {sm.emoji} {sm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <button className="fc-shuffle-btn" onClick={() => restart(false)}>🔀 Shuffle &amp; restart</button>
            )}
            <button className="fc-nav-btn" onClick={() => { setFlipped(false); setTimeout(() => setIndex(i => Math.min(deck.length - 1, i + 1)), 120); }} disabled={isLast}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Match Game Page ────────────────────────────────────────────────────────────
export function MatchGamePage({ user, onLogout }) {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [setData, setSetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tiles, setTiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [wrongPair, setWrongPair] = useState(new Set());
  const [finished, setFinished] = useState(false);
  const [finalMs, setFinalMs] = useState(0);
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const wrongFlashRef = useRef(null);
  const penaltyRef = useRef(0);

  const fetchLeaderboard = useCallback(() => {
    axios.get(`/api/match-leaderboard/${setId}`).then(r => setLeaderboard(r.data));
  }, [setId]);

  useEffect(() => {
    axios.get(`/api/flashcard-sets/${setId}`)
      .then(r => setSetData(r.data))
      .catch(() => navigate('/flashcards'))
      .finally(() => setLoading(false));
    fetchLeaderboard();
  }, [setId]);

  const initGame = useCallback((cards) => {
    if (!cards) return;
    clearInterval(timerRef.current);
    clearTimeout(wrongFlashRef.current);
    const subset = shuffle(cards).slice(0, MATCH_COUNT);
    const termTiles = subset.map((c, i) => ({ id: `t-${i}`, pairId: i, type: 'term', text: c.term }));
    const defTiles  = subset.map((c, i) => ({ id: `d-${i}`, pairId: i, type: 'def',  text: c.definition }));
    setTiles(shuffle([...termTiles, ...defTiles]));
    setSelected(null); setMatched(new Set()); setWrongPair(new Set());
    setFinished(false); setFinalMs(0); setElapsedMs(0); setPenaltyMs(0);
    penaltyRef.current = 0;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 100);
  }, []);

  useEffect(() => { if (setData) initGame(setData.cards); }, [setData]);
  useEffect(() => () => { clearInterval(timerRef.current); clearTimeout(wrongFlashRef.current); }, []);

  const handleSelect = (tile) => {
    if (matched.has(tile.id)) return;
    if (selected?.id === tile.id) { setSelected(null); return; }
    if (!selected) { setSelected(tile); return; }
    if (selected.pairId === tile.pairId && selected.type !== tile.type) {
      const newMatched = new Set([...matched, selected.id, tile.id]);
      setMatched(newMatched);
      setSelected(null);
      if (newMatched.size === MATCH_COUNT * 2) {
        clearInterval(timerRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        const total = elapsed + penaltyRef.current;
        setElapsedMs(elapsed); setFinalMs(total); setFinished(true);
        if (user) {
          axios.post('/api/match-leaderboard', { username: user.username, set_id: parseInt(setId), time_ms: total }).then(fetchLeaderboard);
          const isPerfect = total < 30000 && penaltyRef.current === 0;
          axios.post('/api/points/award', {
            username: user.username,
            points: 200,
            source: isPerfect ? 'match_perfect' : 'match',
          }).catch(() => {});
        }
      }
    } else {
      penaltyRef.current += PENALTY_MS;
      setPenaltyMs(p => p + PENALTY_MS);
      setWrongPair(new Set([selected.id, tile.id]));
      setSelected(null);
      clearTimeout(wrongFlashRef.current);
      wrongFlashRef.current = setTimeout(() => setWrongPair(new Set()), 600);
    }
  };

  const meta = setData ? getMeta(setData.category) : DEFAULT_META;
  const displayMs = elapsedMs + penaltyMs;

  const getTileClass = (tile) => {
    if (matched.has(tile.id)) return 'fc-tile matched';
    if (wrongPair.has(tile.id)) return 'fc-tile wrong';
    if (selected?.id === tile.id) return 'fc-tile selected';
    return 'fc-tile';
  };
  const getTileStyle = (tile) => {
    if (matched.has(tile.id)) return { borderColor: meta.color, background: meta.color + '22' };
    if (selected?.id === tile.id) return { borderColor: meta.color, boxShadow: `0 0 0 3px ${meta.color}55`, background: meta.color + '11' };
    return {};
  };

  if (loading) return <div className="fc-page"><Navigation user={user} onLogout={onLogout} /><div className="fc-loading">Loading…</div></div>;
  if (!setData) return null;

  if (finished) {
    const personalBest = leaderboard.find(r => r.username === user?.username);
    const isFirstTime = !personalBest;
    const isNewBest = isFirstTime || finalMs <= personalBest.best_time_ms;
    const closeToNewBest = !isFirstTime && !isNewBest && isCloseToPB(finalMs, personalBest.best_time_ms);
    const msg = getFinishMessage({ isFirstTime, isNewBest, closeToNewBest, penaltyCount: penaltyMs / PENALTY_MS });
    return (
      <div className="fc-page">
        <Navigation user={user} onLogout={onLogout} />
        <div className="fc-container fc-match-container-narrow">
          <div className="fc-finish-screen">
            <div className="fc-finish-confetti">{msg.emoji}</div>
            <h1 className="fc-finish-heading">{msg.heading}</h1>
            <p className="fc-finish-sub">{msg.sub}</p>
            <p className="fc-finish-time">
              You finished in <strong style={{ color: meta.color }}>{fmtTime(finalMs)}</strong>
              {penaltyMs > 0 && <span className="fc-penalty-note"> (+{penaltyMs / 1000}s in penalties)</span>}
            </p>
            {personalBest && !isNewBest && (
              <p className="fc-finish-beat-msg">Now beat <strong>{user?.username}</strong>'s personal best of <strong>{fmtTime(personalBest.best_time_ms)}</strong>!</p>
            )}
            {leaderboard.length > 0 && (
              <div className="fc-finish-lb">
                <p className="fc-finish-lb-title">The top {Math.min(leaderboard.length, 10)}</p>
                <div className="fc-lb-list">
                  {leaderboard.map((row, i) => {
                    const isMe = row.username === user?.username;
                    return (
                      <div key={i} className={`fc-lb-row${isMe ? ' is-me' : ''}`} style={isMe ? { border: `2px solid ${meta.color}` } : {}}>
                        <span className="fc-lb-rank-icon">{i === 0 ? '👑' : <span className="fc-lb-rank-num" style={{ background: i === 1 ? '#f0ad2e' : i === 2 ? '#e67e22' : '#8c8c8c' }}>{i + 1}</span>}</span>
                        <span className={`fc-lb-name${isMe ? ' is-me' : ''}`}>{isMe ? 'You' : row.username}</span>
                        <span className="fc-lb-time">{fmtTime(row.best_time_ms)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="fc-finish-actions">
              <button className="fc-play-again-btn" style={{ background: meta.color }} onClick={() => initGame(setData.cards)}>▶ Play again</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-page">
      <Navigation user={user} onLogout={onLogout} />
      <div className="fc-match-page">
        <div className="fc-match-header">
          <Link to={`/flashcards/${setId}`} className="fc-back-link">← {setData.category}</Link>
          <div className="fc-timer-display">
            {fmtTime(displayMs)}
            {penaltyMs > 0 && <span className="fc-penalty-badge">+{penaltyMs / 1000}s</span>}
          </div>
          <div className="fc-spacer-80" />
        </div>
        <div className="fc-match-grid">
          {tiles.map(tile => (
            <button key={tile.id} className={getTileClass(tile)} style={getTileStyle(tile)}
              onClick={() => handleSelect(tile)} disabled={matched.has(tile.id)}>
              {tile.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}