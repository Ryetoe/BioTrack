import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';
const biotrackLogo = '/BioTrack_logo.svg';

const QUESTION_DURATION = 20; // seconds

// Derive seconds remaining from the server-stamped start time
function calcTimeLeft(questionStartedAt) {
  if (!questionStartedAt) return QUESTION_DURATION;
  const elapsed = (Date.now() / 1000) - questionStartedAt;
  return Math.max(0, Math.floor(QUESTION_DURATION - elapsed));
}

// How many players have answered question qIdx
function countAnswered(scores, qIdx) {
  return Object.values(scores || {}).filter(s =>
    (s.answers || []).some(a => a.q === qIdx)
  ).length;
}

// ── Teacher: Host page ────────────────────────────────────────────────────────
export function BioQuizHost({ user, onLogout }) {
  const [searchParams] = useSearchParams();
  const classroomId = searchParams.get('classroom') || '';
  const quizId = searchParams.get('quizId') || '';
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  // Host timer is purely derived from server timestamp — no local reset needed
  const [hostTimeLeft, setHostTimeLeft] = useState(QUESTION_DURATION);
  const hostTickRef = useRef(null);

  const pollGame = useCallback(async (code) => {
    try {
      const res = await axios.get(`/api/game/${code}`);
      setGame(res.data);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (game?.code) {
      pollRef.current = setInterval(() => pollGame(game.code), 1500);
      return () => clearInterval(pollRef.current);
    }
  }, [game?.code, pollGame]);

  // Drive host timer from server timestamp — tick every second to update display
  useEffect(() => {
    clearInterval(hostTickRef.current);
    if (!game || game.status !== 'question') return;

    const playerCount = Object.keys(game.players || {}).length;
    const answeredCount = countAnswered(game.scores, game.current_q);
    const allAnswered = playerCount > 0 && answeredCount >= playerCount;
    if (allAnswered) { setHostTimeLeft(0); return; }

    // Sync immediately, then tick every second
    setHostTimeLeft(calcTimeLeft(game.question_started_at));
    hostTickRef.current = setInterval(() => {
      setHostTimeLeft(calcTimeLeft(game.question_started_at));
    }, 500); // 500ms for snappier display
    return () => clearInterval(hostTickRef.current);
  }, [game?.current_q, game?.status, game?.question_started_at, game?.scores]);

  const createGame = async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.post('/api/game/create', {
        host_username: user.username,
        classroom_id: classroomId,
        custom_quiz_id: parseInt(quizId),
      });
      setGame(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create game');
    } finally { setLoading(false); }
  };

  const startGame = async () => {
    try {
      const res = await axios.post('/api/game/start', { code: game.code, host_username: user.username });
      setGame(res.data);
    } catch (err) { setError(err.response?.data?.detail || 'Failed to start'); }
  };

  const nextQuestion = async () => {
    try {
      const res = await axios.post('/api/game/next', { code: game.code, host_username: user.username });
      setGame(res.data);
    } catch (err) { setError(err.response?.data?.detail || 'Error'); }
  };

  const endGame = async () => {
    try {
      await axios.post('/api/game/end', { code: game.code, host_username: user.username });
      clearInterval(pollRef.current);
      navigate('/dashboard');
    } catch (err) { setError('Failed to end game'); }
  };

  // ── Pre-game ──
  if (!game) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="dashboard">
          <button className="btn-back"
            onClick={() => navigate(classroomId ? `/teacher/classes/${classroomId}` : '/dashboard')}
            style={{ marginBottom: '20px' }}>← Back</button>
          <div className="welcome-section">
            <h1>🎮 Host BioQuiz</h1>
            <p>Launch a live quiz for your class using random animal questions.</p>
          </div>
          <div className="bq-pregame-center">
            <div className="quiz-card bq-pregame-card">
              <div className="bq-logo-circle">
                <img src={biotrackLogo} alt="BioTrack" className="bq-logo-circle-img" />
              </div>
              <h2 style={{ marginBottom: '12px' }}>Ready to Host?</h2>
              {!quizId ? (
                <div className="error-message">No quiz selected. Go back and choose a custom quiz to launch.</div>
              ) : (
                <>
                  <p className="bq-pregame-desc">
                    Once the game is created, students will see a <strong>Join BioQuiz</strong> button on their class page.
                  </p>
                  {error && <div className="error-message">{error}</div>}
                  <button className="btn-primary" style={{ padding: '14px 40px', fontSize: '1.1rem' }}
                    onClick={createGame} disabled={loading}>
                    {loading ? 'Creating...' : 'Create Game'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const playerCount = Object.keys(game.players || {}).length;
  const scores = Object.entries(game.scores || {})
    .map(([uname, s]) => ({ username: uname, total: s.total }))
    .sort((a, b) => b.total - a.total);
  const q = game.questions?.[game.current_q];

  // ── Lobby ──
  if (game.status === 'lobby') {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="game-fullscreen">
          <div className="bq-lobby-inner">
            <div className="quiz-card bq-lobby-card">
              <div className="bq-lobby-icon">🎮</div>
              <h2 className="bq-lobby-title">Waiting for Players</h2>
              {game.quiz_title && <p className="bq-lobby-quiz-title">{game.quiz_title}</p>}
              <p className="bq-lobby-subtitle">Students can join from the class page.</p>
              <div className="bq-player-count">{playerCount} player{playerCount !== 1 ? 's' : ''} in lobby</div>
              <div className="player-chips">
                {Object.keys(game.players).map(name => (
                  <span key={name} className="player-chip">{name}</span>
                ))}
              </div>
            </div>
            <div className="bq-lobby-actions">
              <button className="btn-primary" style={{ padding: '14px 36px', fontSize: '1.1rem' }} onClick={startGame}>
                ▶ Start Game ({game.questions?.length} questions)
              </button>
              <button className="btn-back" onClick={endGame}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Ended ──
  if (game.status === 'ended') {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="game-fullscreen">
          <div className="bq-results-inner">
            <div className="welcome-section bq-results-header">
              <div className="bq-results-icon">🏆</div>
              <h1 className="bq-results-title">Final Results</h1>
              <p style={{ opacity: 0.85 }}>{scores.length} player{scores.length !== 1 ? 's' : ''} completed</p>
            </div>
            <div className="bq-scoreboard">
              {scores.length === 0
                ? <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No scores recorded.</p>
                : scores.map((s, i) => (
                  <div key={s.username} className={`bq-score-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                    <span className="bq-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <div className="bq-avatar">{s.username[0].toUpperCase()}</div>
                    <span className="bq-name">{s.username}</span>
                    <span className="bq-pts">{s.total.toLocaleString()} pts</span>
                  </div>
                ))
              }
            </div>
            <div className="bq-results-center">
              <button className="btn-primary" style={{ padding: '12px 36px' }} onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active question ──
  const answeredCount = countAnswered(game.scores, game.current_q);
  const allAnswered = playerCount > 0 && answeredCount >= playerCount;
  const canAdvance = hostTimeLeft <= 0 || allAnswered;
  const timerColor = hostTimeLeft <= 5 ? '#d32f2f' : hostTimeLeft <= 10 ? '#f57c00' : '#4caf50';

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="game-fullscreen">
        <div className="bq-host-inner">

          <div className="bq-host-progress">
            <span className="bq-student-q-label">
              {game.quiz_title && <span className="bq-quiz-title-inline">{game.quiz_title} ·</span>}Q {game.current_q + 1} / {game.questions?.length}
            </span>
            <span className="bq-host-progress-count">{answeredCount} / {playerCount} answered</span>
          </div>

          {/* Timer card */}
          <div className="quiz-card bq-timer-card">
            {allAnswered ? (
              <div className="bq-all-answered">
                <span className="bq-all-answered-icon">✅</span>
                <span className="bq-all-answered-text">All students have answered!</span>
              </div>
            ) : (
              <>
                <div className="bq-timer-row">
                  <span className="bq-timer-label">Time Remaining</span>
                  <span style={{ fontWeight: '800', fontSize: '1.4rem', color: timerColor, fontFamily: 'monospace' }}>
                    {hostTimeLeft}s
                  </span>
                </div>
                <div className="bq-timer-bar-track">
                  <div style={{ height: '100%', width: `${(hostTimeLeft / QUESTION_DURATION) * 100}%`, background: timerColor, borderRadius: '4px', transition: 'width 0.5s linear, background 0.3s' }} />
                </div>
              </>
            )}
          </div>

          {/* Question + answers */}
          <div className="quiz-card bq-question-card">
            <p className="bq-host-hint">
              Correct answer shown to host only
            </p>
            <h2 className="bq-question-text">
              {q?.question}
            </h2>
          </div>
          <div className="game-options host-view">
            {q?.options.map((opt, i) => (
              <div key={i} className={`game-option ${i === q.answer ? 'correct' : 'dim'}`}>{opt}</div>
            ))}
          </div>

          {/* Live leaderboard */}
          {scores.length > 0 && (
            <div className="quiz-card bq-leaderboard-card">
              <h3 className="bq-leaderboard-title">🏅 Live Leaderboard</h3>
              <div className="bq-scoreboard">
                {scores.slice(0, 5).map((s, i) => (
                  <div key={s.username} className={`bq-score-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                    <span className="bq-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <div className="bq-avatar">{s.username[0].toUpperCase()}</div>
                    <span className="bq-name">{s.username}</span>
                    <span className="bq-pts">{s.total.toLocaleString()} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bq-controls">
            <button className="btn-primary"
              style={{ padding: '14px 36px', fontSize: '1rem', opacity: canAdvance ? 1 : 0.45, cursor: canAdvance ? 'pointer' : 'not-allowed' }}
              onClick={nextQuestion} disabled={!canAdvance}>
              {game.current_q + 1 >= game.questions?.length ? '🏁 Show Final Results' : 'Next Question →'}
            </button>
            <button className="btn-back" onClick={endGame}>End Game</button>
          </div>
          
        </div>
      </div>
    </div>
  );
}

// ── Student: Join page ────────────────────────────────────────────────────────
export function BioQuizJoin({ user, onLogout }) {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId');
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [game, setGame] = useState(null);
  // answered: { [questionIndex]: { idx, correct, pts } }
  const [answered, setAnswered] = useState({});

  // Timer derived from server timestamp — no local reset on refresh
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION);
  const tickRef = useRef(null);
  const pollRef = useRef(null);
  const pointsAwardedRef = useRef(false);

  // Auto-join via classId on mount
  useEffect(() => {
    if (!classId) return;
    setJoining(true);
    axios.get(`/api/game/active/${classId}`)
      .then(res => {
        if (res.data.active && res.data.code) {
          return axios.post('/api/game/join', { code: res.data.code, username: user.username });
        }
        throw new Error('No active game found. Ask your teacher to start one.');
      })
      .then(res => { setGame(res.data); setJoining(false); })
      .catch(err => {
        setError(err.message || err.response?.data?.detail || 'Could not join game');
        setJoining(false);
      });
  }, [classId]);

  // Poll game state — restore server-recorded answers on refresh
  useEffect(() => {
    if (!game?.code) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/api/game/${game.code}`);
        const newGame = res.data;
        setGame(newGame);
        // Restore answers that exist server-side but not locally (after refresh)
        const serverAnswers = newGame.scores?.[user.username]?.answers || [];
        if (serverAnswers.length > 0) {
          setAnswered(prev => {
            const next = { ...prev };
            let changed = false;
            serverAnswers.forEach(a => {
              if (next[a.q] === undefined) {
                next[a.q] = { idx: null, correct: a.correct, pts: a.pts };
                changed = true;
              }
            });
            return changed ? next : prev;
          });
        }
        // Award BioQuiz points once when game ends
        if (newGame.status === 'ended' && !pointsAwardedRef.current) {
          pointsAwardedRef.current = true;
          const myTotal = newGame.scores?.[user.username]?.total || 0;
          // Determine if this player placed #1
          const sortedScores = Object.entries(newGame.scores || {})
            .sort(([, a], [, b]) => (b.total || 0) - (a.total || 0));
          const isWinner = sortedScores.length > 0 && sortedScores[0][0] === user.username;
          axios.post('/api/points/award', {
            username: user.username,
            points: myTotal,
            source: isWinner ? 'bioquiz_winner' : 'bioquiz',
          }).catch(() => {});
        }
      } catch (e) { /* ignore */ }
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [game?.code, user.username]);

  // Drive timer from server timestamp — ticks every 500ms for smooth display.
  // This effect re-runs on every game update so a refreshed/late-joining student
  // always gets the real elapsed time instead of starting at 20.
  useEffect(() => {
    clearInterval(tickRef.current);
    if (!game || game.status !== 'question') return;

    // If this student already answered, we still need timeLeft to compute roundOver
    const syncTime = () => {
      const pCount = Object.keys(game.players || {}).length;
      const aCount = countAnswered(game.scores, game.current_q);
      const allAnswered = pCount > 0 && aCount >= pCount;
      if (allAnswered) {
        setTimeLeft(0);
        clearInterval(tickRef.current);
        return;
      }
      setTimeLeft(calcTimeLeft(game.question_started_at));
    };

    syncTime();
    tickRef.current = setInterval(syncTime, 500);
    return () => clearInterval(tickRef.current);
  }, [game]); // intentionally depends on full game object

  const submitAnswer = async (optionIndex) => {
    if (answered[game.current_q] !== undefined) return;
    try {
      const res = await axios.post('/api/game/answer', {
        code: game.code,
        username: user.username,
        question_index: game.current_q,
        answer_index: optionIndex,
        time_left: timeLeft,
      });
      setAnswered(prev => ({
        ...prev,
        [game.current_q]: { idx: optionIndex, correct: res.data.correct, pts: res.data.pts },
      }));
    } catch (e) { console.error(e); }
  };

  // ── Auto-joining / error state ──
  if (!game) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="game-fullscreen">
          {joining ? (
            <div className="bq-join-center">
              <div className="safari-loader bq-join-loader" />
              <p className="bq-join-loading-text">Joining game...</p>
            </div>
          ) : (
            <div className="quiz-card bq-join-card">
              <div className="bq-join-icon">{error ? '😕' : '🎮'}</div>
              <h2 className="bq-join-title">
                {error ? "Couldn't Join" : 'Join BioQuiz'}
              </h2>
              <p className="bq-join-subtitle">
                {error || 'Go to your class page and tap Join BioQuiz when your teacher starts a game.'}
              </p>
              {classId
                ? <button className="btn-primary" onClick={() => navigate(`/classes/${classId}`)}>← Back to Class</button>
                : <button className="btn-primary" onClick={() => navigate('/classes')}>← My Classes</button>
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  const playerCount = Object.keys(game.players || {}).length;
  const scores = Object.entries(game.scores || {})
    .map(([uname, s]) => ({ username: uname, total: s.total }))
    .sort((a, b) => b.total - a.total);
  const myScore = game.scores?.[user.username]?.total || 0;
  const myRank = scores.findIndex(s => s.username === user.username) + 1;
  const q = game.questions?.[game.current_q];
  const myAnswer = answered[game.current_q];

  // ── Lobby ──
  if (game.status === 'lobby') {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="game-fullscreen">
          <div className="quiz-card bq-student-lobby-card">
            <div className="bq-student-lobby-icon">🎉</div>
            <h1 className="bq-student-lobby-title">You're In!</h1>
            <p className="bq-student-lobby-subtitle">Waiting for your teacher to start...</p>
            <div className="player-chips">
              {Object.keys(game.players).map(name => (
                <span key={name} className={`player-chip ${name === user.username ? 'mine' : ''}`}>
                  {name}{name === user.username ? ' (you)' : ''}
                </span>
              ))}
            </div>
            <p className="bq-student-lobby-count">
              {playerCount} player{playerCount !== 1 ? 's' : ''} in lobby
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Game ended ──
  if (game.status === 'ended') {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="game-fullscreen">
          <div className="bq-gameover-inner">
            <div className="welcome-section bq-gameover-header">
              <div className="bq-gameover-icon">🎊</div>
              <h1 className="bq-gameover-title">Game Over!</h1>
              <div className="bq-gameover-score">
                {myScore.toLocaleString()} pts
              </div>
              <p style={{ opacity: 0.85 }}>Rank #{myRank || '?'} of {scores.length}</p>
            </div>
            <div className="bq-scoreboard">
              {scores.map((s, i) => (
                <div key={s.username}
                  className={`bq-score-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''} ${s.username === user.username ? 'mine' : ''}`}>
                  <span className="bq-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                  <div className="bq-avatar">{s.username[0].toUpperCase()}</div>
                  <span className="bq-name" style={{ fontWeight: s.username === user.username ? 700 : 500 }}>
                    {s.username}{s.username === user.username ? ' (you)' : ''}
                  </span>
                  <span className="bq-pts">{s.total.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
            <div className="bq-gameover-center">
              <button className="btn-primary" style={{ padding: '12px 36px' }} onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active question ──
  const answeredCount = countAnswered(game.scores, game.current_q);
  const allAnswered = playerCount > 0 && answeredCount >= playerCount;
  const roundOver = timeLeft <= 0 || allAnswered;
  const showFeedback = !!myAnswer && roundOver;

  const timerPct = (timeLeft / QUESTION_DURATION) * 100;
  const timerColor = timeLeft <= 5 ? '#d32f2f' : timeLeft <= 10 ? '#f57c00' : '#4caf50';

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="game-fullscreen">
        <div className="bq-student-inner">

          <div className="bq-student-header">
            <span className="bq-student-q-label">
              Q {game.current_q + 1} / {game.questions?.length}
            </span>
            <span className="bq-student-score">
              ⭐ {myScore.toLocaleString()} pts
            </span>
          </div>

          {/* Timer bar — hidden once round is over */}
          {!roundOver && (
            <>
              <div className="bq-student-timer-track">
                <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, borderRadius: '4px', transition: 'width 0.5s linear, background 0.3s' }} />
              </div>
              <div style={{ textAlign: 'center', fontSize: '2rem', fontWeight: '800', color: timerColor, marginBottom: '16px' }}>
                {timeLeft}s
              </div>
            </>
          )}

          <div className="quiz-card bq-student-question-card">
            <h2 className="bq-student-question-text">
              {q?.question}
            </h2>
          </div>

          <div className="game-options">
            {q?.options.map((opt, i) => {
              let cls = 'game-option';
              if (showFeedback) {
                if (i === q.answer) cls += ' correct';
                else if (myAnswer.idx !== null && i === myAnswer.idx && !myAnswer.correct) cls += ' wrong';
                else cls += ' dim';
              } else if (myAnswer && !roundOver) {
                cls += ' pending';
              }
              return (
                <button key={i} className={cls}
                  onClick={() => submitAnswer(i)}
                  disabled={!!myAnswer || roundOver}>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Locked in, waiting for round to end */}
          {myAnswer && !roundOver && (
            <div className="bq-locked-banner">
              <div className="bq-locked-title">🔒 Answer locked in!</div>
              <div className="bq-locked-subtitle">Waiting for other players...</div>
            </div>
          )}

          {/* Feedback — only after round ends */}
          {showFeedback && (
            <div className={myAnswer.correct ? "bq-feedback-correct" : "bq-feedback-wrong"}>
              <div className={myAnswer.correct ? "bq-feedback-correct-text" : "bq-feedback-wrong-text"}>
                {myAnswer.correct ? `✅ Correct! +${myAnswer.pts} pts` : '❌ Incorrect'}
              </div>
              {myAnswer.correct && <div className="bq-feedback-speed">Speed bonus included</div>}
              <div className="bq-feedback-waiting">Waiting for next question...</div>
            </div>
          )}

          {/* Didn't answer before round ended */}
          {!myAnswer && roundOver && (
            <div className={allAnswered ? "bq-timesup-all" : "bq-timesup-none"}>
              <div className={allAnswered ? "bq-timesup-text-all" : "bq-timesup-text-none"}>
                {allAnswered ? '✅ Everyone answered!' : "⏱ Time's up!"}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}