import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

function CustomQuiz({ user, onLogout }) {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const classId = searchParams.get('classId');
  const isAnimal = searchParams.get('type') === 'animal';
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [passed, setPassed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuizData();
  }, [quizId]);

  const fetchQuizData = async () => {
    try {
      if (isAnimal) {
        const [animalRes, questionsRes] = await Promise.all([
          axios.get(`/api/animals/${quizId}`),
          axios.get(`/api/questions/animal/${quizId}`),
        ]);
        setQuiz({ title: `${animalRes.data.commonName} Quiz`, description: '' });
        setQuestions(questionsRes.data[0] || []);
      } else {
        const res = await axios.get(`/api/custom-quizzes/${quizId}`);
        setQuiz(res.data);
        setQuestions(res.data.questions || []);
      }
    } catch (error) {
      console.error('Error fetching quiz:', error);
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
    if (correct) setScore(prev => prev + 1);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsCorrect(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const finalScore = isCorrect ? score : score; // score already updated via setState
    const perfect = finalScore === questions.length;
    setPassed(perfect);

    try {
      if (assignmentId && perfect) {
        await axios.post('/api/assignments/complete', {
          assignment_id: Number(assignmentId),
          student_username: user.username,
          score: finalScore,
        });
      }
    } catch (error) {
      console.error('Error marking assignment complete:', error);
    } finally {
      setQuizComplete(true);
    }
  };

  const handleTryAgain = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setScore(0);
    setQuizComplete(false);
    setPassed(false);
  };

  const handleBackToClass = () => {
    if (classId) {
      navigate(`/classes/${classId}`);
    } else {
      navigate('/classes');
    }
  };

  const getScorePercentage = () => {
    if (questions.length === 0) return 0;
    return Math.round((score / questions.length) * 100);
  };

  if (loading) return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="loading-screen">
        <div className="safari-loader"></div>
        <p>Loading quiz...</p>
      </div>
    </div>
  );

  if (!quiz || questions.length === 0) return (
    <div>
      <Navigation user={user} onLogout={onLogout} />
      <div className="quiz-container">
        <h1>Quiz not available</h1>
        <button onClick={handleBackToClass} className="btn-back">Back to Class</button>
      </div>
    </div>
  );

  if (quizComplete) {
    return (
      <div>
        <Navigation user={user} onLogout={onLogout} />
        <div className="quiz-container">
          <div className="quiz-results">
            <div className="results-icon">{passed ? '🏆' : '📚'}</div>
            <h2>{passed ? 'Perfect Score!' : 'Quiz Complete'}</h2>
            <div className="results-score">{score} / {questions.length}</div>
            <div className="results-message">
              {passed
                ? '🎉 You got 100%! Assignment marked as complete.'
                : `You scored ${getScorePercentage()}%. You need 100% to complete this assignment.`}
            </div>
            <div className="results-actions">
              {!passed && (
                <button onClick={handleTryAgain} className="btn-action">
                  Try Again
                </button>
              )}
              <button onClick={handleBackToClass} className="btn-primary">
                Back to Class
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
      <div className="quiz-container">
        <div className="quiz-header">
          <h1>{quiz.title}</h1>
          {assignmentId && <p className="quiz-assignment-label">📝 Class Assignment</p>}
        </div>

        <div className="quiz-progress">
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
          <div className="progress-bar-container">
            <div className="progress-bar"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <span>Score: {score}</span>
        </div>

        <div className="quiz-card">
          {currentQuestion.animal_name && (
            <p className="scientific-name" style={{ marginBottom: '12px' }}>
              {currentQuestion.animal_name}
            </p>
          )}
          <h2 className="question-text">{currentQuestion.question}</h2>

          <div className="options-grid">
            {currentQuestion.options.map((option, index) => {
              let className = 'option-button';
              if (showFeedback) {
                if (index === currentQuestion.answer) className += ' correct';
                else if (index === selectedAnswer && !isCorrect) className += ' incorrect';
              } else if (selectedAnswer === index) {
                className += ' selected';
              }
              return (
                <button key={index} className={className}
                  onClick={() => handleAnswerSelect(index)} disabled={showFeedback}>
                  {option}
                </button>
              );
            })}
          </div>

          {showFeedback && (
            <div className={`feedback-message ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? '✅ Correct! Well done!' : '❌ Incorrect.'}
            </div>
          )}

          <div className="quiz-actions">
            {!showFeedback ? (
              <button onClick={handleSubmitAnswer} className="btn-next" disabled={selectedAnswer === null}>
                Submit Answer
              </button>
            ) : (
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

export default CustomQuiz;