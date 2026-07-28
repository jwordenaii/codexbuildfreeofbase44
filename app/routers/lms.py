from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from openai import AsyncOpenAI

from app.database import get_db
from app.models import Course, CourseModule, Lesson, Enrollment, Progress

router = APIRouter(prefix="/lms", tags=["LMS"])

# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class LessonOut(BaseModel):
    id: int
    title: str
    order_index: int
    video_url: Optional[str]
    body_markdown: Optional[str]
    quiz_json: Optional[str]

    class Config:
        from_attributes = True

class ModuleOut(BaseModel):
    id: int
    title: str
    order_index: int
    description: Optional[str]
    lessons: List[LessonOut] = []

    class Config:
        from_attributes = True

class CourseOut(BaseModel):
    id: int
    title: str
    slug: str
    description: str
    category: str
    difficulty: str
    estimated_hours: Optional[float]
    thumbnail_url: Optional[str]
    is_published: bool
    modules: List[ModuleOut] = []

    class Config:
        from_attributes = True


class GenerateCourseRequest(BaseModel):
    topic: str
    category: str
    difficulty: str = "beginner"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/courses", response_model=List[CourseOut])
def get_courses(tenant_id: str = "default", db: Session = Depends(get_db)):
    """Fetch all published courses for a tenant."""
    courses = db.query(Course).filter(
        Course.tenant_id == tenant_id,
        Course.is_published == True
    ).all()
    
    result = []
    for c in courses:
        modules = db.query(CourseModule).filter(CourseModule.course_id == c.id).order_by(CourseModule.order_index).all()
        mods_out = []
        for m in modules:
            lessons = db.query(Lesson).filter(Lesson.module_id == m.id).order_by(Lesson.order_index).all()
            mods_out.append(ModuleOut(
                id=m.id,
                title=m.title,
                order_index=m.order_index,
                description=m.description,
                lessons=[LessonOut.model_validate(l) for l in lessons]
            ))
            
        result.append(CourseOut(
            id=c.id,
            title=c.title,
            slug=c.slug,
            description=c.description,
            category=c.category,
            difficulty=c.difficulty,
            estimated_hours=c.estimated_hours,
            thumbnail_url=c.thumbnail_url,
            is_published=c.is_published,
            modules=mods_out
        ))
    return result


@router.get("/courses/{slug}", response_model=CourseOut)
def get_course(slug: str, tenant_id: str = "default", db: Session = Depends(get_db)):
    c = db.query(Course).filter(Course.slug == slug, Course.tenant_id == tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
        
    modules = db.query(CourseModule).filter(CourseModule.course_id == c.id).order_by(CourseModule.order_index).all()
    mods_out = []
    for m in modules:
        lessons = db.query(Lesson).filter(Lesson.module_id == m.id).order_by(Lesson.order_index).all()
        mods_out.append(ModuleOut(
            id=m.id,
            title=m.title,
            order_index=m.order_index,
            description=m.description,
            lessons=[LessonOut.model_validate(l) for l in lessons]
        ))
        
    return CourseOut(
        id=c.id,
        title=c.title,
        slug=c.slug,
        description=c.description,
        category=c.category,
        difficulty=c.difficulty,
        estimated_hours=c.estimated_hours,
        thumbnail_url=c.thumbnail_url,
        is_published=c.is_published,
        modules=mods_out
    )


# ── AI Generation Background Task ─────────────────────────────────────────────

async def _generate_course_bg(topic: str, category: str, difficulty: str, tenant_id: str, db: Session):
    """Background task to fully generate a course curriculum via OpenAI."""
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return
            
        client = AsyncOpenAI(api_key=api_key)
        
        system_prompt = (
            "You are an elite instructional designer and veteran construction engineer for J. Worden University. "
            "Your task is to generate a full JSON syllabus for a course. "
            "CRITICAL: The content MUST meet and exceed all current industry standards (OSHA, ANSI, ASTM, etc.). "
            "It must represent the absolute 'Gold Standard' in the construction industry, providing real-world, actionable, and highly accurate training. "
            "Output ONLY raw JSON matching this schema exactly: \n"
            "{\n"
            '  "title": "Course Title",\n'
            '  "slug": "course-title-slug",\n'
            '  "description": "2 paragraph summary",\n'
            '  "estimated_hours": 2.5,\n'
            '  "modules": [\n'
            '    {\n'
            '      "title": "Module Title",\n'
            '      "description": "Module summary",\n'
            '      "lessons": [\n'
            '        {\n'
            '          "title": "Lesson Title",\n'
            '          "body_markdown": "Full lesson content in markdown format. Write at least 400 words of detailed, expert training material here."\n'
            '        }\n'
            '      ]\n'
            '    }\n'
            '  ]\n'
            "}"
        )
        
        prompt = f"Create a comprehensive, expert-level course on '{topic}'. The category is {category} and difficulty is {difficulty}. Write detailed lesson markdown bodies."
        
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.4
        )
        
        course_data = json.loads(resp.choices[0].message.content)
        
        # Save to DB
        course = Course(
            title=course_data["title"],
            slug=course_data["slug"],
            description=course_data["description"],
            category=category,
            difficulty=difficulty,
            estimated_hours=course_data.get("estimated_hours", 1.0),
            is_published=True,
            tenant_id=tenant_id
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        
        for m_idx, mod in enumerate(course_data.get("modules", [])):
            module = CourseModule(
                course_id=course.id,
                title=mod["title"],
                order_index=m_idx,
                description=mod.get("description", "")
            )
            db.add(module)
            db.commit()
            db.refresh(module)
            
            for l_idx, less in enumerate(mod.get("lessons", [])):
                lesson = Lesson(
                    module_id=module.id,
                    title=less["title"],
                    order_index=l_idx,
                    body_markdown=less.get("body_markdown", "")
                )
                db.add(lesson)
            db.commit()
            
    except Exception as e:
        print(f"Error generating course {topic}: {str(e)}")


@router.post("/ai-generate")
async def generate_course(
    req: GenerateCourseRequest, 
    background_tasks: BackgroundTasks,
    tenant_id: str = "default", 
    db: Session = Depends(get_db)
):
    """Trigger an AI generation of a new course."""
    background_tasks.add_task(_generate_course_bg, req.topic, req.category, req.difficulty, tenant_id, db)
    return {"status": "generating", "message": f"Course '{req.topic}' is being generated in the background."}
