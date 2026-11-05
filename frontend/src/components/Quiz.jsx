import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function Quiz({ user, onLogout, updateUser }) {
  const { animalId } = useParams();
  const [animal, setAnimal] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');

  useEffect(() => {
    fetchQuizData();
  }, [animalId]);

  // Warn user about leaving during an active quiz
  const quizInProgress = !quizComplete && !loading && questions.length > 0 && currentQuestionIndex > 0;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (quizInProgress) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quizInProgress]);

  // Intercept in-app navigation
  const safeNavigate = useCallback((path) => {
    if (quizInProgress) {
      const confirmed = window.confirm(
        'You have a quiz in progress. Your results will not be saved if you leave. Are you sure?'
      );
      if (!confirmed) return;
    }
    navigate(path);
  }, [quizInProgress, navigate]);

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAttempts(0);
    setShowFeedback(false);
    setIsCorrect(false);
    setScore(0);
    setQuizComplete(false);
  };

  const fetchQuizData = async () => {
    try {
      const [animalRes, questionsRes] = await Promise.all([
        axios.get(`/api/animals/${animalId}`),
        axios.get(`/api/questions/animal/${animalId}`)
      ]);
      
      setAnimal(animalRes.data);
      setQuestions(questionsRes.data[0] || []);
    } catch (error) {
      console.error('Error fetching quiz data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    if (showFeedback) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    const currentQuestion = questions[currentQuestionIndex];
    const correct = selectedAnswer === currentQuestion.answer;
    
    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      setScore(score + 1);
    }
  };

  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setAttempts(0);
      setIsCorrect(false);
    } else {
      finishQuiz();
    }
  };

  const handleNext = () => {
    moveToNextQuestion();
  };

  const finishQuiz = async () => {
  try {
    const response = await axios.post(
      `/api/quiz/submit?username=${user.username}&animal_id=${animalId}&score=${score}`
    );

    updateUser(response.data.user);

    if (assignmentId) {
      await axios.post('/api/assignments/complete', {
        assignment_id: Number(assignmentId),
        student_username: user.username,
        score: score,
      });
    }

    setQuizComplete(true);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    setQuizComplete(true);
  }
};

  const getScorePercentage = () => {
    return Math.round((score / questions.length) * 100);
  };

  const getScoreMessage = () => {
    const percentage = getScorePercentage();
    if (percentage >= 90) return "Outstanding! You're a true wildlife expert! 🌟";
    if (percentage >= 70) return "Great job! You know your animals well! 🎉";
    if (percentage >= 50) return "Good effort! Keep learning! 👍";
    return "Keep exploring and learning! Every expert was once a beginner! 💪";
  };

  if (loading) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="loading-screen">
          <div className="safari-loader"></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!animal || questions.length === 0) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="quiz-container">
          <h1>Quiz not available</h1>
          <button onClick={() => navigate('/explore')} className="btn-back">
            Back to Explorer
          </button>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        
        <div className="quiz-container">
          <div className="quiz-results">
            <div className="results-icon">
              {getScorePercentage() >= 70 ? '🏆' : '📚'}
            </div>
            <h2>Quiz Complete!</h2>
            <div className="results-score">
              {score} / {questions.length}
            </div>
            <div className="results-message">{getScoreMessage()}</div>
            
            <div className="results-actions">
              <button onClick={resetQuiz} className="btn-action">
                Try Again!
              </button>
              <button
                onClick={() => navigate(`/animal/${animalId}`)}
                className="btn-primary"
              >
                View Animal Details
              </button>
              <button
                onClick={() => navigate('/explore')}
                className="btn-back"
              >
                Explore More Animals
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div>
      <Navigation user={user} onLogout={onLogout} />


      {/* Quiz in-progress warning banner */}
      {quizInProgress && (
        <div className="quiz-warning-banner">
          ⚠️ Quiz in progress — leaving this page will lose your progress.
        </div>
      )}

      {/* Quiz assignment warning banner */}
      {assignmentId && (
        <div className="quiz-assignment-banner">
          📝 This quiz is a class assignment.
        </div>
      )}
      

      <div className="quiz-container">
        <div className="quiz-header">
          <h1>Quiz: {animal.commonName}</h1>
          <p>Test your knowledge about this amazing animal!</p>
        </div>

        <div className="quiz-progress">
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
          <div className="progress-bar-container">
            <div 
              className="progress-bar" 
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span>Score: {score}</span>
        </div>

        <div className="quiz-card">
          <h2 className="question-text">{currentQuestion.question}</h2>

          <div className="options-grid">
            {currentQuestion.options.map((option, index) => {
              let className = 'option-button';
              
              if (showFeedback) {
                if (index === currentQuestion.answer) {
                  className += ' correct';
                } else if (index === selectedAnswer && !isCorrect) {
                  className += ' incorrect';
                }
              } else if (selectedAnswer === index) {
                className += ' selected';
              }

              return (
                <button
                  key={index}
                  className={className}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showFeedback}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {showFeedback && (
            <div className={`feedback-message ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? (
                <>
                  ✅ Correct! Well done!
                </>
              ) : (
                <>
                  ❌ Incorrect.
                  <div className="attempts-info">
                    Better luck next time!
                  </div>
                </>
              )}
            </div>
          )}

          <div className="quiz-actions">
            {!showFeedback && (
              <button
                onClick={handleSubmitAnswer}
                className="btn-next"
                disabled={selectedAnswer === null}
              >
                Submit Answer
              </button>
            )}
            
            {showFeedback && (
              <button onClick={handleNext} className="btn-next">
                {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Finish Quiz'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Quiz;