# BioTrack Backend — Database and Server
# CS 442 Group 7

# Features:
#   - Server setup (FastAPI)
#   - User registration & login
#   - Browse animals and view animal information
#   - All data stored in MySQL via SQLAlchemy

import json
import hashlib
import os
import random
import time
import string
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from passlib.context import CryptContext
from dotenv import load_dotenv

from sqlalchemy import create_engine, Column, Integer, String, JSON, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.orm.attributes import flag_modified

load_dotenv()

# ──────────────────────────────────────────────
# Database configuration
# ──────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Check your .env file.")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ──────────────────────────────────────────────
# SQLAlchemy ORM Models
# ──────────────────────────────────────────────
class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="student", index=True)
    favorites = Column(JSON, nullable=False, default=list)
    discovered = Column(JSON, nullable=False, default=list)
    badges = Column(JSON, nullable=False, default=list)
    quiz_scores = Column(JSON, nullable=False, default=dict)
    points = Column(Integer, nullable=False, default=0)


class AnimalModel(Base):
    __tablename__ = "animals"
    id = Column(Integer, primary_key=True, autoincrement=False)
    data = Column(JSON, nullable=False)


class QuestionModel(Base):
    __tablename__ = "questions"
    animal_id = Column(Integer, primary_key=True, autoincrement=False)
    data = Column(JSON, nullable=False)


class BadgeModel(Base):
    __tablename__ = "badges"
    id = Column(Integer, primary_key=True, index=True)
    badge_id = Column(String(100), unique=True, nullable=False)
    data = Column(JSON, nullable=False)


class FlashcardSetModel(Base):
    __tablename__ = "flashcard_sets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(100), unique=True, nullable=False, index=True)


class FlashcardModel(Base):
    __tablename__ = "flashcards"
    id = Column(Integer, primary_key=True, autoincrement=True)
    set_id = Column(Integer, nullable=False, index=True)
    term = Column(String(255), nullable=False)
    definition = Column(Text, nullable=False)


class MatchLeaderboardModel(Base):
    __tablename__ = "match_leaderboard"
    id = Column(Integer, primary_key=True, autoincrement=True)
    set_id = Column(Integer, nullable=False, index=True)
    username = Column(String(150), nullable=False, index=True)
    best_time = Column(Integer, nullable=False)  # milliseconds


class FlashcardProgressModel(Base):
    __tablename__ = "flashcard_progress"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(150), nullable=False, index=True)
    set_id = Column(Integer, nullable=False, index=True)
    # JSON: { card_id: { starred: bool, status: "mastered"|"learning"|"struggling"|null } }
    progress = Column(JSON, nullable=False, default=dict)



class ClassModel(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    code = Column(String(6), unique=True, nullable=False, index=True)
    teacher_username = Column(String(150), nullable=False, index=True)
    
class ClassMemberModel(Base):
    __tablename__ = "class_members"
    id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(Integer, nullable=False, index=True)
    student_username = Column(String(150), nullable=False, index=True)

class AwardPointsRequest(BaseModel):
    username: str
    points: int
    source: str = ""  # e.g. "animal_quiz", "custom_quiz", "flashcard", "match", "bioquiz"

class AssignmentCompletionRequest(BaseModel):
    assignment_id: int
    student_username: str
    score: int

class AssignmentModel(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(Integer, nullable=False, index=True)
    assignment_type = Column(String(50), nullable=False, default="animal_quiz", index=True)
    animal_id = Column(Integer, nullable=True, index=True)
    custom_quiz_id = Column(Integer, nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(150), nullable=False, index=True)

class AssignmentSubmissionModel(Base):
    __tablename__ = "assignment_submissions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    assignment_id = Column(Integer, nullable=False, index=True)
    student_username = Column(String(150), nullable=False, index=True)
    score = Column(Integer, nullable=True)
    completed = Column(Integer, nullable=False, default=0)

class CreateAssignmentRequest(BaseModel):
    class_id: int
    teacher_username: str
    assignment_type: str = "animal_quiz"
    animal_id: int | None = None
    custom_quiz_id: int | None = None
    title: str | None = None
    description: str | None = None

class CustomQuizModel(Base):
    __tablename__ = "custom_quizzes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    teacher_username = Column(String(150), nullable=False, index=True)
    class_id = Column(Integer, nullable=True, index=True)  # optional if tied to a class

class CustomQuizQuestionModel(Base):
    __tablename__ = "custom_quiz_questions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    custom_quiz_id = Column(Integer, nullable=False, index=True)
    animal_id = Column(Integer, nullable=False, index=True)
    question_index = Column(Integer, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

class CustomQuizQuestionRef(BaseModel):
    animal_id: int | None = None
    question_index: int
    order_index: int
    flashcard_id: int | None = None
    is_flashcard: bool = False

class CreateCustomQuizRequest(BaseModel):
    title: str
    description: str | None = None
    teacher_username: str
    class_id: int | None = None
    questions: list[CustomQuizQuestionRef]
    


# ── In-memory game store ─────────────────────────────────────────────────────
_games_store: dict = {}

Base.metadata.create_all(bind=engine)


# ──────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────
app = FastAPI(title="BioTrack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/images", StaticFiles(directory=STATIC_DIR), name="images")

DATA_DIR = Path(__file__).parent / "data"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ──────────────────────────────────────────────
# DB session dependency
# ──────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ──────────────────────────────────────────────
# Seed MySQL from JSON on startup
# ──────────────────────────────────────────────
def seed_from_json():
    db = SessionLocal()
    try:
        animals_path = DATA_DIR / "animals.json"
        if animals_path.exists():
            animals = json.loads(animals_path.read_text(encoding="utf-8"))
            for animal_id, animal_data in animals.items():
                if not db.query(AnimalModel).filter(AnimalModel.id == int(animal_id)).first():
                    db.add(AnimalModel(id=int(animal_id), data=animal_data))
            db.commit()

        questions_path = DATA_DIR / "questions.json"
        if questions_path.exists():
            questions = json.loads(questions_path.read_text(encoding="utf-8"))
            for animal_id, question_data in questions.items():
                if not db.query(QuestionModel).filter(QuestionModel.animal_id == int(animal_id)).first():
                    db.add(QuestionModel(animal_id=int(animal_id), data=question_data))
            db.commit()

        badges_path = DATA_DIR / "badges.json"
        if badges_path.exists():
            badges = json.loads(badges_path.read_text(encoding="utf-8"))
            for badge_id, badge_data in badges.items():
                if not db.query(BadgeModel).filter(BadgeModel.badge_id == badge_id).first():
                    db.add(BadgeModel(badge_id=badge_id, data=badge_data))
            db.commit()

        flashcards_path = DATA_DIR / "flashcards.json"
        if flashcards_path.exists():
            flashcards = json.loads(flashcards_path.read_text(encoding="utf-8"))
            for category, cards in flashcards.items():
                existing_set = db.query(FlashcardSetModel).filter(FlashcardSetModel.category == category).first()
                if not existing_set:
                    new_set = FlashcardSetModel(category=category)
                    db.add(new_set)
                    db.flush()  # get new_set.id
                    for card in cards:
                        db.add(FlashcardModel(set_id=new_set.id, term=card["term"], definition=card["definition"]))
            db.commit()

    finally:
        db.close()

seed_from_json()


# ──────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────
class User(BaseModel):
    username: str
    password: str
    role: str = "student"
    favorites: List[int] = []
    discovered: List[int] = []
    badges: List[str] = []
    quiz_scores: dict = {}

class LoginRequest(BaseModel):
    username: str
    password: str

class FavoriteRequest(BaseModel):
    animal_id: int

class CreateClassRequest(BaseModel):
    teacher_username: str
    class_name: str


class JoinClassRequest(BaseModel):
    student_username: str
    class_code: str


class GameCreate(BaseModel):
    host_username: str
    classroom_id: str = ""
    custom_quiz_id: int

class GameJoin(BaseModel):
    code: str
    username: str

class GameAction(BaseModel):
    code: str
    host_username: str

class GameAnswer(BaseModel):
    code: str
    username: str
    question_index: int
    answer_index: int
    time_left: int

# ──────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────
def user_to_dict(user: UserModel) -> dict:
    return {
        "username": user.username,
        "role": user.role,
        "favorites": user.favorites or [],
        "discovered": user.discovered or [],
        "badges": user.badges or [],
        "quiz_scores": user.quiz_scores or {},
        "points": user.points or 0,
    }

# ──────────────────────────────────────────────
# Badge helper — call after any state change
# ──────────────────────────────────────────────
def _check_and_award_badges(user, extra: dict = None) -> list:
    """Check all badge conditions and award any newly earned badges.
    Returns list of newly awarded badge IDs."""
    extra = extra or {}
    badges = list(user.badges or [])
    new_badges = []

    def _earn(badge_id: str):
        if badge_id not in badges:
            badges.append(badge_id)
            new_badges.append(badge_id)

    points = user.points or 0
    discovered = user.discovered or []
    quiz_scores = user.quiz_scores or {}
    favorites = user.favorites or []

    # Perfect quiz score
    if extra.get("perfect_quiz"):
        _earn("PERFECT_QUIZ")

    # Discover all 10 animals
    if len(discovered) >= 10:
        _earn("EXPLORER_10")

    # Flashcard set completed
    if extra.get("source") == "flashcard":
        _earn("FLASHCARD_SET")

    # Match game completed / perfect
    if extra.get("source") in ("match", "match_perfect"):
        _earn("MATCH_COMPLETE")
    if extra.get("source") == "match_perfect":
        _earn("MATCH_PERFECT")

    # BioQuiz participant / winner
    if extra.get("source") in ("bioquiz", "bioquiz_winner"):
        _earn("BIOQUIZ_PARTICIPANT")
    if extra.get("source") == "bioquiz_winner":
        _earn("BIOQUIZ_WINNER")

    # Points milestones
    for threshold, badge_id in [(1000, "POINTS_1K"), (5000, "POINTS_5K"),
                                  (10000, "POINTS_10K"), (50000, "POINTS_50K")]:
        if points >= threshold:
            _earn(badge_id)

    # Class assignment completed
    if extra.get("assignment_complete"):
        _earn("ASSIGNMENT_COMPLETE")

    # Favorited an animal
    if len(favorites) >= 1:
        _earn("FIRST_FAVORITE")

    user.badges = badges
    return new_badges

def generate_class_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=6))
        existing = db.query(ClassModel).filter(ClassModel.code == code).first()
        if not existing:
            return code

def require_teacher(username: str, db: Session) -> UserModel:
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    return user

# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "BioTrack API is running"}


# ──────────────────────────────────────────────
# Animals
# ──────────────────────────────────────────────
@app.get("/api/animals")
def get_animals(db: Session = Depends(get_db)):
    animals = db.query(AnimalModel).all()
    return {str(a.id): a.data for a in animals}

@app.get("/api/animals/{animal_id}")
def get_animal(animal_id: int, db: Session = Depends(get_db)):
    animal = db.query(AnimalModel).filter(AnimalModel.id == animal_id).first()
    if not animal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")
    return animal.data


# ──────────────────────────────────────────────
# Questions
# ──────────────────────────────────────────────
@app.get("/api/questions")
def get_questions(db: Session = Depends(get_db)):
    questions = db.query(QuestionModel).all()
    return {str(q.animal_id): q.data for q in questions}

@app.get("/api/questions/animal/{animal_id}")
def get_animal_questions(animal_id: int, db: Session = Depends(get_db)):
    question = db.query(QuestionModel).filter(QuestionModel.animal_id == animal_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Questions not found for this animal")
    return [question.data]


# ──────────────────────────────────────────────
# Badges
# ──────────────────────────────────────────────
@app.get("/api/badges")
def get_badges(db: Session = Depends(get_db)):
    badges = db.query(BadgeModel).all()
    return {b.badge_id: b.data for b in badges}


# ──────────────────────────────────────────────
# Flashcards
# ──────────────────────────────────────────────
@app.get("/api/flashcard-sets")
def get_flashcard_sets(db: Session = Depends(get_db)):
    sets = db.query(FlashcardSetModel).all()
    result = []
    for s in sets:
        count = db.query(FlashcardModel).filter(FlashcardModel.set_id == s.id).count()
        result.append({"id": s.id, "category": s.category, "count": count})
    return result

@app.get("/api/flashcard-sets/{set_id}")
def get_flashcard_set(set_id: int, db: Session = Depends(get_db)):
    s = db.query(FlashcardSetModel).filter(FlashcardSetModel.id == set_id).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard set not found")
    cards = db.query(FlashcardModel).filter(FlashcardModel.set_id == set_id).all()
    return {
        "id": s.id,
        "category": s.category,
        "cards": [{"id": c.id, "term": c.term, "definition": c.definition} for c in cards],
    }


# ──────────────────────────────────────────────
# Match Leaderboard
# ──────────────────────────────────────────────
class MatchScoreRequest(BaseModel):
    username: str
    set_id: int
    time_ms: int

@app.post("/api/match-leaderboard")
def submit_match_score(payload: MatchScoreRequest, db: Session = Depends(get_db)):
    existing = db.query(MatchLeaderboardModel).filter(
        MatchLeaderboardModel.set_id == payload.set_id,
        MatchLeaderboardModel.username == payload.username,
    ).first()
    if existing:
        if payload.time_ms < existing.best_time:
            existing.best_time = payload.time_ms
            db.commit()
    else:
        db.add(MatchLeaderboardModel(set_id=payload.set_id, username=payload.username, best_time=payload.time_ms))
        db.commit()
    return {"message": "Score saved"}

@app.get("/api/match-leaderboard/{set_id}")
def get_match_leaderboard(set_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(MatchLeaderboardModel)
        .filter(MatchLeaderboardModel.set_id == set_id)
        .order_by(MatchLeaderboardModel.best_time.asc())
        .limit(10)
        .all()
    )
    return [{"username": r.username, "best_time_ms": r.best_time} for r in rows]


# ──────────────────────────────────────────────
# Flashcard Progress (starred + status)
# ──────────────────────────────────────────────
class FlashcardProgressRequest(BaseModel):
    username: str
    set_id: int
    card_id: int
    starred: Optional[bool] = None
    status: Optional[str] = None  # "mastered" | "learning" | "struggling" | null

@app.get("/api/flashcard-progress/{username}/{set_id}")
def get_flashcard_progress(username: str, set_id: int, db: Session = Depends(get_db)):
    row = db.query(FlashcardProgressModel).filter(
        FlashcardProgressModel.username == username,
        FlashcardProgressModel.set_id == set_id,
    ).first()
    return row.progress if row else {}

@app.post("/api/flashcard-progress")
def update_flashcard_progress(payload: FlashcardProgressRequest, db: Session = Depends(get_db)):
    row = db.query(FlashcardProgressModel).filter(
        FlashcardProgressModel.username == payload.username,
        FlashcardProgressModel.set_id == payload.set_id,
    ).first()
    if not row:
        row = FlashcardProgressModel(
            username=payload.username,
            set_id=payload.set_id,
            progress={},
        )
        db.add(row)

    progress = dict(row.progress or {})
    card_key = str(payload.card_id)
    card_data = dict(progress.get(card_key, {}))

    if payload.starred is not None:
        card_data["starred"] = payload.starred
    if payload.status is not None:
        card_data["status"] = payload.status if payload.status != "none" else None

    progress[card_key] = card_data
    row.progress = progress
    flag_modified(row, "progress")
    db.commit()
    return {"message": "Progress saved", "progress": progress}


# ──────────────────────────────────────────────
# AUTH: Register & Login
# ──────────────────────────────────────────────
@app.post("/api/register")
def register(user: User, db: Session = Depends(get_db)):
    if db.query(UserModel).filter(UserModel.username == user.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    allowed_roles = {"student", "teacher"}
    role = user.role.lower()

    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )

    new_user = UserModel(
        username=user.username,
        password=hash_password(user.password),
        role=role,
        favorites=[],
        discovered=[],
        badges=[],
        quiz_scores={},
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user": user_to_dict(new_user)}


@app.post("/api/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"message": "Login successful", "user": user_to_dict(user)}


# ──────────────────────────────────────────────
# Quiz Submit
# ──────────────────────────────────────────────
@app.post("/api/quiz/submit")
def submit_quiz(username: str, animal_id: int, score: int, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    quiz_scores = dict(user.quiz_scores or {})
    old_score = quiz_scores.get(str(animal_id), 0)
    quiz_scores[str(animal_id)] = score
    user.quiz_scores = quiz_scores
    # Award 100 pts per correct answer (net of previous best for this animal)
    pts_gained = max(0, (score - old_score) * 100)
    user.points = (user.points or 0) + pts_gained

    discovered = list(user.discovered or [])
    if animal_id not in discovered:
        discovered.append(animal_id)
    user.discovered = discovered

    badges = list(user.badges or [])
    new_badges = []
    if "FIRST_QUIZ" not in badges:
        badges.append("FIRST_QUIZ")
        new_badges.append("FIRST_QUIZ")
        user.badges = badges

    # Check other badges (perfect score, all 10 discovered, points milestones)
    total_questions = len(db.query(QuestionModel).all())  # rough upper bound not needed; use score vs questions
    new_badges += _check_and_award_badges(user, {"perfect_quiz": score == questions_count} if False else {})
    # We don't have questions_count here — use the separate perfect_quiz param passed from frontend
    # Instead, check via score: if caller passes score == num_questions we detect it
    # The frontend always passes raw correct count; perfect = all correct detected below
    # Re-check: quiz/submit receives score (number correct). We need total questions for that animal.
    question_row = db.query(QuestionModel).filter(QuestionModel.animal_id == animal_id).first()
    total_qs = len(question_row.data) if question_row and question_row.data else 0
    new_badges += _check_and_award_badges(user, {"perfect_quiz": total_qs > 0 and score == total_qs})

    db.commit()
    db.refresh(user)
    return {"message": "Quiz submitted successfully", "score": score, "new_badges": new_badges, "user": user_to_dict(user)}


# ──────────────────────────────────────────────
# Favorites
# ──────────────────────────────────────────────
@app.post("/api/favorites/add")
def add_favorite(username: str, favorite: FavoriteRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    favorites = list(user.favorites or [])
    new_badges = []
    if favorite.animal_id not in favorites:
        favorites.append(favorite.animal_id)
        user.favorites = favorites
        new_badges = _check_and_award_badges(user, {})
        db.commit()
        db.refresh(user)
    return {"message": "Added to favorites", "favorites": user.favorites, "new_badges": new_badges}


@app.post("/api/favorites/remove")
def remove_favorite(username: str, favorite: FavoriteRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    favorites = list(user.favorites or [])
    if favorite.animal_id in favorites:
        favorites.remove(favorite.animal_id)
        user.favorites = favorites
        db.commit()
        db.refresh(user)
    return {"message": "Removed from favorites", "favorites": user.favorites}


# ──────────────────────────────────────────────
# User Profile
# ──────────────────────────────────────────────
@app.get("/api/user/{username}")
def get_user_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user_to_dict(user)


# ──────────────────────────────────────────────
# Leaderboard
# ──────────────────────────────────────────────
@app.get("/api/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    users = db.query(UserModel).filter(UserModel.role == "student").all()
    leaderboard = [
        {
            "username": u.username,
            "total_score": u.points or 0,
            "discoveries": len(u.discovered or []),
            "badges": len(u.badges or []),
        }
        for u in users
    ]
    leaderboard.sort(key=lambda x: x["total_score"], reverse=True)
    return leaderboard


@app.post("/api/points/award")
def award_points(payload: AwardPointsRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.points = (user.points or 0) + payload.points
    new_badges = _check_and_award_badges(user, {"source": payload.source})
    db.commit()
    return {"message": "Points awarded", "total_points": user.points, "new_badges": new_badges}


@app.get("/api/classes/{class_id}/leaderboard")
def get_class_leaderboard(class_id: int, db: Session = Depends(get_db)):
    members = db.query(ClassMemberModel).filter(ClassMemberModel.class_id == class_id).all()
    usernames = [m.student_username for m in members]
    if not usernames:
        return []
    users = db.query(UserModel).filter(UserModel.username.in_(usernames)).all()
    leaderboard = [
        {
            "username": u.username,
            "points": u.points or 0,
            "discoveries": len(u.discovered or []),
            "badges": len(u.badges or []),
        }
        for u in users
    ]
    leaderboard.sort(key=lambda x: x["points"], reverse=True)
    return leaderboard
    
# ──────────────────────────────────────────────
# Classroom setup
# ──────────────────────────────────────────────
@app.post("/api/classes/create")
def create_class(payload: CreateClassRequest, db: Session = Depends(get_db)):
    require_teacher(payload.teacher_username, db)

    code = generate_class_code(db)

    new_class = ClassModel(
        name=payload.class_name,
        code=code,
        teacher_username=payload.teacher_username,
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    return {
        "message": "Class created successfully",
        "class": {
            "id": new_class.id,
            "name": new_class.name,
            "code": new_class.code,
            "teacher_username": new_class.teacher_username,
        }
    }

@app.post("/api/classes/join")
def join_class(payload: JoinClassRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == payload.student_username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can join classes")

    classroom = db.query(ClassModel).filter(ClassModel.code == payload.class_code.upper()).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid class code")

    existing_membership = db.query(ClassMemberModel).filter(
        ClassMemberModel.class_id == classroom.id,
        ClassMemberModel.student_username == payload.student_username
    ).first()

    if existing_membership:
        return {"message": "Student already joined this class"}

    db.add(ClassMemberModel(
        class_id=classroom.id,
        student_username=payload.student_username
    ))
    db.commit()

    return {
        "message": "Joined class successfully",
        "class": {
            "id": classroom.id,
            "name": classroom.name,
            "code": classroom.code,
            "teacher_username": classroom.teacher_username,
        }
    }


# ──────────────────────────────────────────────
# Classroom view
# ──────────────────────────────────────────────
@app.get("/api/classes/teacher/{username}")
def get_teacher_classes(username: str, db: Session = Depends(get_db)):
    require_teacher(username, db)

    rows = db.query(ClassModel).filter(ClassModel.teacher_username == username).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "teacher_username": c.teacher_username,
            "member_count": db.query(ClassMemberModel).filter(ClassMemberModel.class_id == c.id).count(),
        }
        for c in rows
    ]

@app.get("/api/classes/student/{username}")
def get_student_classes(username: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    memberships = db.query(ClassMemberModel).filter(ClassMemberModel.student_username == username).all()
    class_ids = [m.class_id for m in memberships]

    if not class_ids:
        return []

    rows = db.query(ClassModel).filter(ClassModel.id.in_(class_ids)).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "teacher_username": c.teacher_username,
        }
        for c in rows
    ]



# ──────────────────────────────────────────────
# Class detail + student management
# ──────────────────────────────────────────────
@app.get("/api/classes/{class_id}")
def get_class(class_id: int, db: Session = Depends(get_db)):
    classroom = db.query(ClassModel).filter(ClassModel.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    member_count = db.query(ClassMemberModel).filter(ClassMemberModel.class_id == class_id).count()
    return {
        "id": classroom.id,
        "name": classroom.name,
        "code": classroom.code,
        "teacher_username": classroom.teacher_username,
        "member_count": member_count,
    }

@app.get("/api/classes/{class_id}/students")
def get_class_students(class_id: int, db: Session = Depends(get_db)):
    classroom = db.query(ClassModel).filter(ClassModel.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    members = db.query(ClassMemberModel).filter(ClassMemberModel.class_id == class_id).all()
    result = []
    for m in members:
        user = db.query(UserModel).filter(UserModel.username == m.student_username).first()
        result.append({
            "username": m.student_username,
            "discoveries": len(user.discovered or []) if user else 0,
            "badges": len(user.badges or []) if user else 0,
            "quiz_scores": len(user.quiz_scores or {}) if user else 0,
        })
    return result

@app.delete("/api/classes/{class_id}/students/{username}")
def remove_student_from_class(class_id: int, username: str, db: Session = Depends(get_db)):
    membership = db.query(ClassMemberModel).filter(
        ClassMemberModel.class_id == class_id,
        ClassMemberModel.student_username == username,
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not in this class")
    db.delete(membership)
    db.commit()
    return {"message": f"{username} removed from class"}


@app.delete("/api/classes/{class_id}/leave/{username}")
def leave_class(class_id: int, username: str, db: Session = Depends(get_db)):
    membership = db.query(ClassMemberModel).filter(
        ClassMemberModel.class_id == class_id,
        ClassMemberModel.student_username == username,
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You are not in this class")
    db.delete(membership)
    db.commit()
    return {"message": "Left class successfully"}

# ──────────────────────────────────────────────
# Teacher Assignment Managment
# ──────────────────────────────────────────────

@app.post("/api/assignments")
def create_assignment(payload: CreateAssignmentRequest, db: Session = Depends(get_db)):
    teacher = db.query(UserModel).filter(UserModel.username == payload.teacher_username).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if teacher.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")

    classroom = db.query(ClassModel).filter(ClassModel.id == payload.class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    if classroom.teacher_username != payload.teacher_username:
        raise HTTPException(status_code=403, detail="You do not own this class")

    assignment_type = payload.assignment_type.strip().lower()

    if assignment_type not in {"animal_quiz", "custom_quiz"}:
        raise HTTPException(status_code=400, detail="Invalid assignment type")

    animal_id = None
    custom_quiz_id = None

    if assignment_type == "animal_quiz":
        if payload.animal_id is None:
            raise HTTPException(status_code=400, detail="animal_id is required for animal_quiz assignments")

        animal = db.query(AnimalModel).filter(AnimalModel.id == payload.animal_id).first()
        if not animal:
            raise HTTPException(status_code=404, detail="Animal not found")

        question_set = db.query(QuestionModel).filter(QuestionModel.animal_id == payload.animal_id).first()
        if not question_set:
            raise HTTPException(status_code=404, detail="No questions exist for this animal")

        animal_id = payload.animal_id

    elif assignment_type == "custom_quiz":
        if payload.custom_quiz_id is None:
            raise HTTPException(status_code=400, detail="custom_quiz_id is required for custom_quiz assignments")

        custom_quiz = db.query(CustomQuizModel).filter(CustomQuizModel.id == payload.custom_quiz_id).first()
        if not custom_quiz:
            raise HTTPException(status_code=404, detail="Custom quiz not found")

        if custom_quiz.teacher_username != payload.teacher_username:
            raise HTTPException(status_code=403, detail="You do not own this custom quiz")

        custom_quiz_id = payload.custom_quiz_id

    # Duplicate check
    existing = db.query(AssignmentModel).filter(
        AssignmentModel.class_id == payload.class_id,
        AssignmentModel.assignment_type == assignment_type,
        AssignmentModel.animal_id == animal_id,
        AssignmentModel.custom_quiz_id == custom_quiz_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This quiz is already assigned to this class")

    assignment = AssignmentModel(
        class_id=payload.class_id,
        assignment_type=assignment_type,
        animal_id=animal_id,
        custom_quiz_id=custom_quiz_id,
        title=(payload.title.strip() if payload.title else ""),
        description=(payload.description or "").strip(),
        created_by=payload.teacher_username,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return {
        "message": "Assignment created successfully",
        "assignment": {
            "id": assignment.id,
            "class_id": assignment.class_id,
            "assignment_type": assignment.assignment_type,
            "animal_id": assignment.animal_id,
            "custom_quiz_id": assignment.custom_quiz_id,
            "title": assignment.title,
            "description": assignment.description,
            "created_by": assignment.created_by,
        }
    }

@app.delete("/api/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    teacher_username: str,
    db: Session = Depends(get_db)
):
    teacher = db.query(UserModel).filter(UserModel.username == teacher_username).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if teacher.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")

    assignment = db.query(AssignmentModel).filter(AssignmentModel.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    classroom = db.query(ClassModel).filter(ClassModel.id == assignment.class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    if classroom.teacher_username != teacher_username:
        raise HTTPException(status_code=403, detail="You do not own this assignment")

    db.query(AssignmentSubmissionModel).filter(
        AssignmentSubmissionModel.assignment_id == assignment_id
    ).delete()

    db.delete(assignment)
    db.commit()

    return {"message": "Assignment removed successfully"}

@app.get("/api/classes/{class_id}/assignments")
def get_class_assignments(class_id: int, db: Session = Depends(get_db)):
    assignments = db.query(AssignmentModel).filter(AssignmentModel.class_id == class_id).all()

    result = []
    for a in assignments:
        submissions = db.query(AssignmentSubmissionModel).filter(
            AssignmentSubmissionModel.assignment_id == a.id,
            AssignmentSubmissionModel.completed == 1
        ).count()

        source_name = "Unknown"
        if a.assignment_type == "animal_quiz" and a.animal_id is not None:
            animal = db.query(AnimalModel).filter(AnimalModel.id == a.animal_id).first()
            source_name = animal.data.get("commonName") if animal and animal.data else f"Animal {a.animal_id}"

        elif a.assignment_type == "custom_quiz" and a.custom_quiz_id is not None:
            custom_quiz = db.query(CustomQuizModel).filter(CustomQuizModel.id == a.custom_quiz_id).first()
            source_name = custom_quiz.title if custom_quiz else f"Custom Quiz {a.custom_quiz_id}"

        result.append({
            "id": a.id,
            "class_id": a.class_id,
            "assignment_type": a.assignment_type,
            "animal_id": a.animal_id,
            "custom_quiz_id": a.custom_quiz_id,
            "source_name": source_name,
            "title": a.title,
            "description": a.description,
            "created_by": a.created_by,
            "completed_count": submissions,
        })

    return result

@app.get("/api/students/{username}/assignments")
def get_student_assignments(username: str, db: Session = Depends(get_db)):
    memberships = db.query(ClassMemberModel).filter(ClassMemberModel.student_username == username).all()
    class_ids = [m.class_id for m in memberships]

    if not class_ids:
        return []

    assignments = db.query(AssignmentModel).filter(AssignmentModel.class_id.in_(class_ids)).all()

    result = []
    for a in assignments:
        classroom = db.query(ClassModel).filter(ClassModel.id == a.class_id).first()
        submission = db.query(AssignmentSubmissionModel).filter(
            AssignmentSubmissionModel.assignment_id == a.id,
            AssignmentSubmissionModel.student_username == username
        ).first()

        source_name = "Unknown"
        if a.assignment_type == "animal_quiz" and a.animal_id is not None:
            animal = db.query(AnimalModel).filter(AnimalModel.id == a.animal_id).first()
            source_name = animal.data.get("commonName") if animal and animal.data else f"Animal {a.animal_id}"

        elif a.assignment_type == "custom_quiz" and a.custom_quiz_id is not None:
            custom_quiz = db.query(CustomQuizModel).filter(CustomQuizModel.id == a.custom_quiz_id).first()
            source_name = custom_quiz.title if custom_quiz else f"Custom Quiz {a.custom_quiz_id}"

        result.append({
            "id": a.id,
            "class_id": a.class_id,
            "class_name": classroom.name if classroom else "Unknown Class",
            "assignment_type": a.assignment_type,
            "animal_id": a.animal_id,
            "custom_quiz_id": a.custom_quiz_id,
            "source_name": source_name,
            "title": a.title,
            "description": a.description,
            "completed": bool(submission.completed) if submission else False,
            "score": submission.score if submission else None,
        })

    return result

# ──────────────────────────────────────────────
# Student Assignment Managment
# ──────────────────────────────────────────────


@app.post("/api/assignments/complete")
def complete_assignment(payload: AssignmentCompletionRequest, db: Session = Depends(get_db)):
    assignment = db.query(AssignmentModel).filter(AssignmentModel.id == payload.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    submission = db.query(AssignmentSubmissionModel).filter(
        AssignmentSubmissionModel.assignment_id == payload.assignment_id,
        AssignmentSubmissionModel.student_username == payload.student_username
    ).first()

    already_completed = submission and submission.completed == 1
    if not submission:
        submission = AssignmentSubmissionModel(
            assignment_id=payload.assignment_id,
            student_username=payload.student_username,
            score=payload.score,
            completed=1,
        )
        db.add(submission)
    else:
        submission.score = payload.score
        submission.completed = 1

    # Award 100 pts per correct answer, only the first time this assignment is completed
    new_badges = []
    if not already_completed:
        student = db.query(UserModel).filter(UserModel.username == payload.student_username).first()
        if student:
            student.points = (student.points or 0) + (payload.score * 100)
            new_badges = _check_and_award_badges(student, {"assignment_complete": True})

    db.commit()
    return {"message": "Assignment marked completed", "new_badges": new_badges}

# ──────────────────────────────────────────────
# Custom Quiz 
# ──────────────────────────────────────────────

@app.get("/api/question-bank")
def get_question_bank(db: Session = Depends(get_db)):
    # Load all animals into a lookup dict first (same source as AnimalExplorer)
    animals_map = {a.id: a.data for a in db.query(AnimalModel).all() if a.data}

    rows = db.query(QuestionModel).all()
    result = []

    for row in rows:
        animal_data = animals_map.get(row.animal_id, {})
        animal_name = animal_data.get("commonName") or animal_data.get("name") or f"Animal {row.animal_id}"
        category = animal_data.get("category", "Unknown")
        conservation_status = animal_data.get("conservationStatus", "")
        region = animal_data.get("region", "")

        question_list = row.data or []
        for idx, q in enumerate(question_list):
            result.append({
                "animal_id": row.animal_id,
                "animal_name": animal_name,
                "category": category,
                "conservation_status": conservation_status,
                "region": region,
                "image_key": animal_data.get("imageKey", ""),
                "question_index": idx,
                "question": q.get("question"),
                "options": q.get("options", []),
                "answer": q.get("answer"),
            })

    return result

@app.post("/api/custom-quizzes")
def create_custom_quiz(payload: CreateCustomQuizRequest, db: Session = Depends(get_db)):
    teacher = db.query(UserModel).filter(UserModel.username == payload.teacher_username).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if teacher.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")

    if not payload.questions:
        raise HTTPException(status_code=400, detail="Custom quiz must contain at least one question")

    quiz = CustomQuizModel(
        title=payload.title.strip(),
        description=(payload.description or "").strip(),
        teacher_username=payload.teacher_username,
        class_id=payload.class_id,
    )
    db.add(quiz)
    db.flush()

    for qref in payload.questions:
        if qref.is_flashcard or qref.animal_id is None:
            # Flashcard question — store with animal_id=None and flashcard_id
            db.add(CustomQuizQuestionModel(
                custom_quiz_id=quiz.id,
                animal_id=None,
                question_index=qref.flashcard_id or 0,
                order_index=qref.order_index,
            ))
        else:
            question_row = db.query(QuestionModel).filter(QuestionModel.animal_id == qref.animal_id).first()
            if not question_row:
                raise HTTPException(status_code=404, detail=f"No question set found for animal {qref.animal_id}")

            question_list = question_row.data or []
            if qref.question_index < 0 or qref.question_index >= len(question_list):
                raise HTTPException(status_code=400, detail=f"Invalid question index for animal {qref.animal_id}")

            db.add(CustomQuizQuestionModel(
                custom_quiz_id=quiz.id,
                animal_id=qref.animal_id,
                question_index=qref.question_index,
                order_index=qref.order_index,
            ))

    db.commit()
    db.refresh(quiz)

    return {
        "message": "Custom quiz created successfully",
        "custom_quiz": {
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "teacher_username": quiz.teacher_username,
            "class_id": quiz.class_id,
        }
    }

@app.get("/api/custom-quizzes/{quiz_id}")
def get_custom_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(CustomQuizModel).filter(CustomQuizModel.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Custom quiz not found")

    refs = (
        db.query(CustomQuizQuestionModel)
        .filter(CustomQuizQuestionModel.custom_quiz_id == quiz_id)
        .order_by(CustomQuizQuestionModel.order_index.asc(), CustomQuizQuestionModel.id.asc())
        .all()
    )

    animals_map = {a.id: a.data for a in db.query(AnimalModel).all() if a.data}

    questions = []
    for ref in refs:
        if ref.animal_id is None:
            # Flashcard question — look up from flashcard table
            from sqlalchemy import text
            flashcard = db.execute(
                text("SELECT term, definition, set_id FROM flashcards WHERE id = :id"),
                {"id": ref.question_index}
            ).fetchone()
            if flashcard:
                term, correct_def, set_id = flashcard[0], flashcard[1], flashcard[2]
                # Fetch up to 3 other definitions from the same set as distractors
                siblings = db.execute(
                    text("SELECT definition FROM flashcards WHERE set_id = :sid AND id != :id"),
                    {"sid": set_id, "id": ref.question_index}
                ).fetchall()
                distractor_pool = [row[0] for row in siblings]
                # Seed with the flashcard id so distractors are always the same
                rng = random.Random(ref.question_index)
                rng.shuffle(distractor_pool)
                distractors = distractor_pool[:3]
                # Pad with generic fallbacks if the set has fewer than 3 other cards
                while len(distractors) < 3:
                    distractors.append("—")
                # Shuffle correct answer into a fixed position
                options = distractors + [correct_def]
                rng.shuffle(options)
                answer_idx = options.index(correct_def)
                questions.append({
                    "animal_id": None,
                    "animal_name": "Flashcard",
                    "question_index": ref.question_index,
                    "question": term,
                    "options": options,
                    "answer": answer_idx,
                    "is_flashcard": True,
                })
            continue

        animal_data = animals_map.get(ref.animal_id, {})
        animal_name = animal_data.get("commonName") or f"Animal {ref.animal_id}"

        row = db.query(QuestionModel).filter(QuestionModel.animal_id == ref.animal_id).first()
        if not row:
            continue

        question_list = row.data or []
        if ref.question_index < 0 or ref.question_index >= len(question_list):
            continue
        q = question_list[ref.question_index]

        questions.append({
            "animal_id": ref.animal_id,
            "animal_name": animal_name,
            "question_index": ref.question_index,
            "question": q.get("question"),
            "options": q.get("options", []),
            "answer": q.get("answer"),
        })

    return {
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "teacher_username": quiz.teacher_username,
        "class_id": quiz.class_id,
        "questions": questions,
    }

@app.get("/api/custom-quizzes/teacher/{username}")
def get_teacher_custom_quizzes(username: str, db: Session = Depends(get_db)):
    teacher = db.query(UserModel).filter(UserModel.username == username).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if teacher.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")

    quizzes = db.query(CustomQuizModel).filter(CustomQuizModel.teacher_username == username).all()

    result = []
    for quiz in quizzes:
        question_count = db.query(CustomQuizQuestionModel).filter(
            CustomQuizQuestionModel.custom_quiz_id == quiz.id
        ).count()

        result.append({
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "question_count": question_count,
        })

    return result


@app.delete("/api/custom-quizzes/{quiz_id}")
def delete_custom_quiz(quiz_id: int, teacher_username: str, db: Session = Depends(get_db)):
    quiz = db.query(CustomQuizModel).filter(CustomQuizModel.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Custom quiz not found")
    if quiz.teacher_username != teacher_username:
        raise HTTPException(status_code=403, detail="You do not own this quiz")
    # Delete questions first (no cascade configured)
    db.query(CustomQuizQuestionModel).filter(
        CustomQuizQuestionModel.custom_quiz_id == quiz_id
    ).delete()
    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted"}


# ──────────────────────────────────────────────
# BioQuiz Live Game
# ──────────────────────────────────────────────
import random as _random

def _questions_from_custom_quiz(quiz_id: int, db: Session):
    refs = (
        db.query(CustomQuizQuestionModel)
        .filter(CustomQuizQuestionModel.custom_quiz_id == quiz_id)
        .order_by(CustomQuizQuestionModel.order_index.asc(), CustomQuizQuestionModel.id.asc())
        .all()
    )
    animals_map = {a.id: a.data for a in db.query(AnimalModel).all() if a.data}
    questions = []
    for ref in refs:
        if ref.animal_id is None:
            # Flashcard question
            from sqlalchemy import text as _text
            flashcard = db.execute(
                _text("SELECT term, definition, set_id FROM flashcards WHERE id = :id"),
                {"id": ref.question_index}
            ).fetchone()
            if flashcard:
                term, correct_def, set_id = flashcard[0], flashcard[1], flashcard[2]
                siblings = db.execute(
                    _text("SELECT definition FROM flashcards WHERE set_id = :sid AND id != :id"),
                    {"sid": set_id, "id": ref.question_index}
                ).fetchall()
                distractor_pool = [row[0] for row in siblings]
                rng = _random.Random(ref.question_index)
                rng.shuffle(distractor_pool)
                distractors = distractor_pool[:3]
                while len(distractors) < 3:
                    distractors.append("—")
                options = distractors + [correct_def]
                rng.shuffle(options)
                questions.append({
                    "question": term,
                    "options": options,
                    "answer": options.index(correct_def),
                })
            continue
        animal_data = animals_map.get(ref.animal_id, {})
        row = db.query(QuestionModel).filter(QuestionModel.animal_id == ref.animal_id).first()
        if not row:
            continue
        question_list = row.data or []
        if ref.question_index < 0 or ref.question_index >= len(question_list):
            continue
        q = question_list[ref.question_index]
        questions.append({
            "question": q.get("question"),
            "options": q.get("options", []),
            "answer": q.get("answer"),
        })
    return questions

@app.post("/api/game/create")
def create_game(data: GameCreate, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == data.host_username).first()
    if not user or user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can host games")
    # Validate and load questions from the chosen custom quiz
    quiz = db.query(CustomQuizModel).filter(CustomQuizModel.id == data.custom_quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Custom quiz not found")
    if quiz.teacher_username != data.host_username:
        raise HTTPException(status_code=403, detail="You do not own this quiz")
    questions = _questions_from_custom_quiz(data.custom_quiz_id, db)
    if not questions:
        raise HTTPException(status_code=400, detail="Selected quiz has no questions")
    import string
    while True:
        code = "".join(_random.choices(string.digits, k=6))
        if code not in _games_store:
            break
    game = {
        "code": code, "host_username": data.host_username,
        "classroom_id": data.classroom_id, "status": "lobby",
        "current_q": 0, "questions": questions,
        "quiz_title": quiz.title,
        "players": {}, "scores": {},
    }
    _games_store[code] = game
    return game

@app.post("/api/game/join")
def join_game(data: GameJoin):
    game = _games_store.get(data.code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["status"] == "ended":
        raise HTTPException(status_code=400, detail="Game has ended")
    game["players"][data.username] = {"name": data.username, "joined": True}
    if data.username not in game["scores"]:
        game["scores"][data.username] = {"total": 0, "answers": []}
    return game

@app.get("/api/game/{code}")
def get_game(code: str):
    game = _games_store.get(code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@app.post("/api/game/start")
def start_game(data: GameAction):
    game = _games_store.get(data.code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["host_username"] != data.host_username:
        raise HTTPException(status_code=403, detail="Only the host can start the game")
    game["status"] = "question"
    game["current_q"] = 0
    game["question_started_at"] = time.time()
    return game

@app.post("/api/game/next")
def next_question(data: GameAction):
    game = _games_store.get(data.code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["host_username"] != data.host_username:
        raise HTTPException(status_code=403, detail="Only the host can advance questions")
    if game["current_q"] + 1 >= len(game["questions"]):
        game["status"] = "ended"
    else:
        game["current_q"] += 1
        game["status"] = "question"
        game["question_started_at"] = time.time()
    return game

@app.post("/api/game/answer")
def submit_game_answer(data: GameAnswer):
    game = _games_store.get(data.code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    q = game["questions"][data.question_index]
    correct = data.answer_index == q["answer"]
    pts = max(100, round((data.time_left / 20) * 1000)) if correct else 0
    if data.username not in game["scores"]:
        game["scores"][data.username] = {"total": 0, "answers": []}
    already = any(a["q"] == data.question_index for a in game["scores"][data.username]["answers"])
    if not already:
        game["scores"][data.username]["total"] += pts
        game["scores"][data.username]["answers"].append({"q": data.question_index, "correct": correct, "pts": pts})
    return {"correct": correct, "pts": pts, "score": game["scores"][data.username]}

@app.post("/api/game/end")
def end_game(data: GameAction):
    game = _games_store.get(data.code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    game["status"] = "ended"
    return game

# ──────────────────────────────────────────────
# Active game check for a class
# ──────────────────────────────────────────────
@app.get("/api/game/active/{class_id}")
def get_active_game_for_class(class_id: str):
    for game in _games_store.values():
        if game.get("classroom_id") == str(class_id) and game.get("status") in ("lobby", "question"):
            return {"active": True, "code": game["code"], "status": game["status"]}
    return {"active": False}

# ──────────────────────────────────────────────
# Password helpers
# ──────────────────────────────────────────────
def normalize_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def hash_password(password: str) -> str:
    return pwd_context.hash(normalize_password(password))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(normalize_password(plain_password), hashed_password)


# ──────────────────────────────────────────────
# Run server
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)