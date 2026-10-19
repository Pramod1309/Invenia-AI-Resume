import base64
import hashlib
import json
import mimetypes
import os
import re
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests

from workflow_utils import extract_resume_text, normalize_text, score_resume_sections

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
REQUEST_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))
ROLE_MATCH_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "our",
    "the",
    "to",
    "with",
    "you",
    "your",
    "using",
    "work",
    "role",
    "team",
    "candidate",
    "experience",
    "knowledge",
    "ability",
    "skills",
    "skill",
    "strong",
    "excellent",
    "good",
    "preferred",
    "required",
    "must",
    "plus",
    "years",
    "year",
    "manage",
    "managing",
    "implement",
    "implementation",
    "support",
    "supporting",
    "ensure",
    "develop",
    "maintain",
    "provide",
    "collaborate",
    "responsible",
    "responsibilities",
    "including",
    "business",
    "solution",
    "solutions",
    "environment",
}

JOB_ATS_WEIGHTS = {
    "requirement_evidence": 50,
    "skill_tool_coverage": 20,
    "experience_alignment": 20,
    "responsibility_readiness": 10,
}
EVIDENCE_STATUS_VALUE = {"matched": 1.0, "partial": 0.45, "missing": 0.0}
JOB_ATS_CACHE_TTL_SECONDS = int(os.getenv("JOB_ATS_CACHE_TTL_SECONDS", "900"))
_JOB_ATS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_JOB_ATS_CACHE_LOCK = threading.Lock()


def _first_env_value(*names: str, default: str = "") -> str:
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value:
            return value
    return default


def get_gemini_api_key() -> Optional[str]:
    return _first_env_value("GEMINI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY", "GOOGLE_GEMINI_API_KEY") or None


def get_gemini_model() -> str:
    return _first_env_value("GEMINI_MODEL", default=DEFAULT_GEMINI_MODEL) or DEFAULT_GEMINI_MODEL


def _iter_gemini_models() -> list[str]:
    models = [get_gemini_model(), "gemini-2.5-flash", "gemini-3.5-flash"]
    ordered: list[str] = []
    for model in models:
        if model and model not in ordered:
            ordered.append(model)
    return ordered


def guess_resume_mime_type(path: Optional[Path]) -> str:
    if path is None:
        return "application/octet-stream"

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "application/pdf"
    if suffix == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if suffix == ".doc":
        return "application/msword"

    guessed = mimetypes.guess_type(path.name)[0]
    return guessed or "application/octet-stream"


def can_send_inline_to_gemini(path: Optional[Path]) -> bool:
    if path is None:
        return False
    return guess_resume_mime_type(path) in {
        "application/pdf",
        "text/plain",
        "text/rtf",
        "image/bmp",
        "image/jpeg",
        "image/png",
        "image/webp",
    }


def build_candidate_ats_signature(profile_snapshot: dict[str, Any], resume_path: Optional[Path]) -> str:
    resume_hash = ""
    resume_excerpt_hash = ""
    resume_name = ""

    if resume_path and resume_path.exists():
        resume_name = resume_path.name
        try:
            raw_bytes = resume_path.read_bytes()
        except Exception:
            raw_bytes = b""

        if raw_bytes:
            resume_hash = hashlib.sha256(raw_bytes).hexdigest()

        try:
            resume_text = normalize_text(extract_resume_text(resume_path))[:20000]
        except Exception:
            resume_text = ""

        if resume_text:
            resume_excerpt_hash = hashlib.sha256(resume_text.encode("utf-8", errors="ignore")).hexdigest()

    signature_payload = {
        "profile": profile_snapshot,
        "resume_hash": resume_hash,
        "resume_excerpt_hash": resume_excerpt_hash,
        "resume_name": resume_name,
    }
    signature_raw = json.dumps(signature_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(signature_raw).hexdigest()


def build_job_ats_signature(
    profile_snapshot: dict[str, Any],
    job_snapshot: dict[str, Any],
    resume_path: Optional[Path],
) -> str:
    signature_payload = {
        "candidate_signature": build_candidate_ats_signature(profile_snapshot, resume_path),
        "job": job_snapshot,
    }
    signature_raw = json.dumps(signature_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(signature_raw).hexdigest()


def _normalize_list(values: Any, limit: int = 6) -> list[str]:
    if not isinstance(values, list):
        return []
    items: list[str] = []
    for value in values:
        text = normalize_text(str(value))
        if text and text not in items:
            items.append(text)
        if len(items) >= limit:
            break
    return items


def _normalize_breakdown(items: Any) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if not isinstance(items, list):
        return normalized

    for item in items:
        if not isinstance(item, dict):
            continue
        label = normalize_text(str(item.get("label", "")))
        note = normalize_text(str(item.get("note", "")))
        if not label:
            continue
        try:
            score = int(round(float(item.get("score", 0) or 0)))
        except (TypeError, ValueError):
            score = 0
        try:
            max_score = int(round(float(item.get("maxScore", 0) or 0)))
        except (TypeError, ValueError):
            max_score = 0
        max_score = max(max_score, 1)
        normalized.append(
            {
                "label": label,
                "score": max(0, min(score, max_score)),
                "maxScore": max_score,
                "note": note or "AI generated feedback not available.",
            }
        )
    return normalized


def _safe_int_score(value: Any, default: int = 0) -> int:
    try:
        score = int(round(float(value if value is not None else default)))
    except (TypeError, ValueError):
        score = default
    return max(0, min(score, 100))


def _normalize_requirement_match(value: Any, fallback_total: int = 0) -> dict[str, int]:
    if not isinstance(value, dict):
        value = {}
    matched = max(0, int(value.get("matched") or 0))
    partial = max(0, int(value.get("partial") or 0))
    missing = max(0, int(value.get("missing") or 0))
    total = max(0, int(value.get("total") or fallback_total or matched + partial + missing))
    percentage = _safe_int_score(value.get("percentage"), 0)
    if total and not percentage:
        percentage = round(((matched + (partial * 0.5)) / max(1, total)) * 100)
    return {
        "matched": matched,
        "partial": partial,
        "missing": missing,
        "total": total,
        "percentage": max(0, min(percentage, 100)),
    }


def _normalize_alignment(items: Any, fallback: Optional[list[dict[str, Any]]] = None) -> list[dict[str, Any]]:
    source = items if isinstance(items, list) else (fallback or [])
    normalized: list[dict[str, Any]] = []
    for item in source:
        if not isinstance(item, dict):
            continue
        label = normalize_text(str(item.get("label", "")))
        if not label:
            continue
        normalized.append(
            {
                "label": label,
                "score": _safe_int_score(item.get("score"), 0),
                "note": normalize_text(str(item.get("note", ""))) or "Evidence level not available.",
            }
        )
        if len(normalized) >= 6:
            break
    return normalized


def _job_text(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(normalize_text(str(item)) for item in value if normalize_text(str(item)))
    return normalize_text(str(value or ""))


def _extract_job_requirements(job_snapshot: dict[str, Any]) -> list[str]:
    requirements: list[str] = []
    raw_requirements = job_snapshot.get("requirements") or []
    if isinstance(raw_requirements, list):
        requirements.extend(normalize_text(str(item)) for item in raw_requirements if normalize_text(str(item)))
    elif raw_requirements:
        requirements.extend(
            normalize_text(item)
            for item in re.split(r"[,;\n]+", str(raw_requirements))
            if normalize_text(item)
        )

    if not requirements:
        description = normalize_text(str(job_snapshot.get("description") or ""))
        candidates = re.split(r"(?<=[.!?])\s+|[\n;]+", description)
        requirements.extend(normalize_text(item) for item in candidates[:8] if normalize_text(item))

    deduped: list[str] = []
    for requirement in requirements:
        if requirement and requirement.lower() not in {item.lower() for item in deduped}:
            deduped.append(requirement[:180])
        if len(deduped) >= 14:
            break
    return deduped


def _extract_job_responsibilities(job_snapshot: dict[str, Any]) -> list[str]:
    raw = job_snapshot.get("responsibilities") or []
    if isinstance(raw, list):
        items = [normalize_text(str(item)) for item in raw if normalize_text(str(item))]
    else:
        items = [normalize_text(item) for item in re.split(r"[\n;]+", str(raw)) if normalize_text(item)]
    deduped: list[str] = []
    for item in items:
        if item.lower() not in {existing.lower() for existing in deduped}:
            deduped.append(item[:220])
        if len(deduped) >= 12:
            break
    return deduped


def _requirement_weight(requirement: str) -> float:
    lowered = requirement.lower()
    if re.search(r"\b(must|required|mandatory|essential|minimum)\b", lowered):
        return 1.35
    if re.search(r"\b(preferred|desirable|nice to have|plus)\b", lowered):
        return 0.7
    return 1.0


def _best_evidence_sentence(item: str, evidence_text: str) -> tuple[str, float]:
    terms = set(_requirement_terms(item))
    if not terms:
        return "", 0.0
    sentences = [
        normalize_text(part)
        for part in re.split(r"(?<=[.!?])\s+|[\n\r]+", evidence_text or "")
        if normalize_text(part)
    ]
    best_sentence = ""
    best_coverage = 0.0
    for sentence in sentences:
        sentence_terms = set(_requirement_terms(sentence))
        coverage = len(terms & sentence_terms) / max(1, len(terms))
        if coverage > best_coverage:
            best_sentence = sentence
            best_coverage = coverage
    return best_sentence[:280], best_coverage


def _local_evidence_assessment(item: str, item_type: str, evidence_text: str) -> dict[str, Any]:
    quote, coverage = _best_evidence_sentence(item, evidence_text)
    item_normalized = normalize_text(item).lower()
    evidence_normalized = normalize_text(evidence_text).lower()
    exact = bool(item_normalized and item_normalized in evidence_normalized)
    if exact or coverage >= 0.68:
        status = "matched"
    elif coverage >= 0.28:
        status = "partial"
    else:
        status = "missing"
        quote = ""
    return {
        "item": item,
        "item_type": item_type,
        "status": status,
        "evidence_quote": quote,
        "rationale": f"Local evidence term coverage: {round(coverage * 100)}%.",
        "confidence": round(min(1.0, 0.45 + coverage * 0.5), 2),
        "evidence_validated": bool(quote),
        "term_coverage": round(coverage, 3),
        "exact_match": exact,
    }


def _quote_is_grounded(quote: str, evidence_text: str) -> bool:
    normalized_quote = normalize_text(quote).lower()
    normalized_evidence = normalize_text(evidence_text).lower()
    if not normalized_quote:
        return False
    if normalized_quote in normalized_evidence:
        return True
    quote_terms = set(_requirement_terms(normalized_quote))
    if not quote_terms:
        return False
    evidence_terms = set(_requirement_terms(normalized_evidence))
    return len(quote_terms & evidence_terms) / max(1, len(quote_terms)) >= 0.85


def _find_ai_assessment(item: str, item_type: str, assessments: Any) -> Optional[dict[str, Any]]:
    if not isinstance(assessments, list):
        return None
    item_terms = set(_requirement_terms(item))
    best: Optional[dict[str, Any]] = None
    best_similarity = 0.0
    for assessment in assessments:
        if not isinstance(assessment, dict):
            continue
        candidate_type = normalize_text(str(assessment.get("item_type", ""))).lower()
        if candidate_type and candidate_type != item_type:
            continue
        candidate_terms = set(_requirement_terms(str(assessment.get("item", ""))))
        similarity = len(item_terms & candidate_terms) / max(1, len(item_terms | candidate_terms))
        if similarity > best_similarity:
            best = assessment
            best_similarity = similarity
    return best if best_similarity >= 0.45 else None


def _required_experience_years(job_snapshot: dict[str, Any]) -> int:
    source = " ".join(
        [
            _job_text(job_snapshot.get("experience_level")),
            _job_text(job_snapshot.get("requirements")),
            _job_text(job_snapshot.get("description")),
        ]
    )
    range_matches = re.findall(
        r"(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years|year|yrs|yr)",
        source,
        re.IGNORECASE,
    )
    if range_matches:
        return max(int(lower) for lower, _upper in range_matches)
    minimum_matches = re.findall(
        r"(?:minimum(?:\s+of)?|at\s+least)\s*(\d{1,2})\s*(?:years|year|yrs|yr)",
        source,
        re.IGNORECASE,
    )
    if minimum_matches:
        return max(int(value) for value in minimum_matches)
    plus_matches = re.findall(r"(\d{1,2})\s*(?:\+|plus)\s*(?:years|year|yrs|yr)", source, re.IGNORECASE)
    if plus_matches:
        return max(int(value) for value in plus_matches)
    matches = re.findall(r"(\d{1,2})\s*(?:years|year|yrs|yr)", source, re.IGNORECASE)
    if matches:
        return min(int(value) for value in matches)
    lowered = source.lower()
    if "principal" in lowered or "lead" in lowered:
        return 7
    if "senior" in lowered:
        return 5
    if "mid" in lowered or "intermediate" in lowered:
        return 2
    return 0


def _requirement_terms(requirement: str) -> list[str]:
    terms = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,}", requirement.lower())
    return [term for term in terms if term not in ROLE_MATCH_STOPWORDS and len(term) > 1][:12]


def _safe_parse_json(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    if not isinstance(payload, str):
        return {}

    cleaned = payload.strip()
    if not cleaned:
        return {}

    candidates = [
        cleaned,
        re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE),
    ]
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if match:
        candidates.append(match.group(0))

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
    return {}


def _extract_generated_text(api_response: dict[str, Any]) -> str:
    candidates = api_response.get("candidates") or []
    for candidate in candidates:
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        texts = []
        for part in parts:
            if isinstance(part, dict) and part.get("text"):
                texts.append(str(part["text"]))
        if texts:
            return "".join(texts)
    return ""


def _fallback_ats_result(profile_snapshot: dict[str, Any], resume_text: str, signature: str) -> dict[str, Any]:
    text = normalize_text(resume_text).lower()
    skills = profile_snapshot.get("skills") or []
    resume_score, resume_breakdown, resume_suggestions = score_resume_sections(resume_text)

    profile_checks = [
        ("Contact & Header", bool(profile_snapshot.get("full_name") and profile_snapshot.get("email")), 20, "Name and email should be easy to find."),
        ("Experience Impact", bool(profile_snapshot.get("experience_years")) or "experience" in text or "managed" in text or "led" in text, 20, "Show real achievements with measurable outcomes."),
        ("Skills & Keywords", bool(skills) and any(skill.lower() in text for skill in skills), 20, "Mirror the role's key skills in the resume."),
        ("ATS Formatting", "experience" in text or "skills" in text or "education" in text or resume_score >= 6, 20, "Use simple sections and a clean, ATS-friendly layout."),
        ("Projects & Education", "project" in text or "education" in text or "certification" in text, 20, "Add projects, education, or certifications that prove readiness."),
    ]

    breakdown: list[dict[str, Any]] = []
    total = 0
    for label, is_present, max_score, note in profile_checks:
        score = max_score if is_present else max(0, max_score // 4)
        total += score
        breakdown.append(
            {
                "label": label,
                "score": score,
                "maxScore": max_score,
                "note": note if is_present else note,
            }
        )

    if resume_breakdown:
        breakdown.extend(
            {
                "label": item.get("label", "Resume Section"),
                "score": int(item.get("score", 0) or 0),
                "maxScore": int(item.get("maxScore", 1) or 1),
                "note": item.get("note", ""),
            }
            for item in resume_breakdown[:5]
            if isinstance(item, dict)
        )
        total += min(20, int(round(resume_score * 1.2)))

    score = max(35, min(99, int(round(total))))
    if score >= 85:
        summary = "Your resume is ATS-ready and communicates strong recruiter signals."
    elif score >= 70:
        summary = "Your ATS readiness is solid, with a few sections that can still be sharpened."
    else:
        summary = "Your resume can benefit from stronger structure, sharper keywords, and clearer impact."

    strengths = []
    if profile_snapshot.get("full_name") and profile_snapshot.get("email"):
        strengths.append("Contact details are easy to identify.")
    if skills:
        strengths.append("You have a defined skills section to align against roles.")
    if "experience" in text or profile_snapshot.get("experience_years"):
        strengths.append("The resume includes experience signals recruiters can review quickly.")

    suggestions = resume_suggestions[:6]
    if not suggestions:
        suggestions = [
            "Add a clear experience section with quantified achievements.",
            "Mirror the job's core skills in your resume wording.",
            "Keep section headings simple and ATS-friendly.",
        ]

    keywords_found = [skill for skill in skills[:6] if skill.lower() in text]
    keywords_missing = [skill for skill in skills[:6] if skill.lower() not in text]

    return {
        "score": score,
        "summary": summary,
        "strengths": strengths[:5],
        "gaps": suggestions[:5],
        "keywords_found": keywords_found,
        "keywords_missing": keywords_missing,
        "breakdown": breakdown[:8],
        "suggestions": suggestions[:5],
        "optimization_tips": suggestions[:5],
        "optimized_resume_headline": "ATS scan completed with local fallback logic.",
        "source": "local-fallback",
        "model": "heuristic",
        "scanned_at": datetime.utcnow().isoformat(),
        "input_signature": signature,
    }


def _fallback_job_ats_result(
    profile_snapshot: dict[str, Any],
    resume_text: str,
    job_snapshot: dict[str, Any],
    signature: str,
) -> dict[str, Any]:
    resume_evidence = " ".join(
        [
            normalize_text(resume_text),
            _job_text(profile_snapshot.get("bio")),
            _job_text(profile_snapshot.get("current_job_title")),
            _job_text(profile_snapshot.get("skills")),
        ]
    ).lower()
    requirements = _extract_job_requirements(job_snapshot)

    matched_requirements: list[str] = []
    partial_requirements: list[str] = []
    missing_requirements: list[str] = []

    for requirement in requirements:
        requirement_lower = requirement.lower()
        terms = _requirement_terms(requirement)
        if requirement_lower and requirement_lower in resume_evidence:
            matched_requirements.append(requirement)
            continue
        hits = sum(1 for term in terms if term in resume_evidence)
        ratio = hits / max(1, len(terms))
        if ratio >= 0.55 or hits >= 3:
            matched_requirements.append(requirement)
        elif ratio >= 0.25 or hits >= 1:
            partial_requirements.append(requirement)
        else:
            missing_requirements.append(requirement)

    total_requirements = len(requirements)
    coverage_score = round(
        ((len(matched_requirements) + (len(partial_requirements) * 0.5)) / max(1, total_requirements)) * 100
    ) if total_requirements else 60

    candidate_skills = [str(skill).lower() for skill in (profile_snapshot.get("skills") or [])]
    job_terms = []
    for requirement in requirements:
        job_terms.extend(_requirement_terms(requirement))
    job_terms = list(dict.fromkeys(job_terms))[:24]
    skill_hits = sum(1 for term in job_terms if any(term in skill or skill in term for skill in candidate_skills) or term in resume_evidence)
    skill_score = round((skill_hits / max(1, len(job_terms))) * 100) if job_terms else coverage_score

    title_terms = _requirement_terms(str(job_snapshot.get("title") or ""))
    title_hits = sum(1 for term in title_terms if term in resume_evidence)
    experience_score = round((title_hits / max(1, len(title_terms))) * 100) if title_terms else coverage_score
    if profile_snapshot.get("experience_years"):
        experience_score = min(100, max(experience_score, 55 + min(int(profile_snapshot.get("experience_years") or 0) * 5, 35)))

    responsibility_requirements = _extract_job_requirements({"requirements": job_snapshot.get("responsibilities") or []})
    responsibility_hits = 0
    responsibility_terms = []
    for item in responsibility_requirements:
        responsibility_terms.extend(_requirement_terms(item))
    responsibility_terms = list(dict.fromkeys(responsibility_terms))
    if responsibility_terms:
        responsibility_hits = sum(1 for term in responsibility_terms if term in resume_evidence)
    responsibility_score = round((responsibility_hits / max(1, len(responsibility_terms))) * 100) if responsibility_terms else coverage_score

    score = round((coverage_score * 0.5) + (skill_score * 0.25) + (experience_score * 0.15) + (responsibility_score * 0.1))
    score = max(25, min(score, 98))

    if score >= 85:
        summary = "Strong role fit: the resume shows clear evidence for most job requirements."
        recommendation = "Prioritize this candidate for the next assessment stage."
    elif score >= 70:
        summary = "Good role fit: several requirements match, with a few areas needing recruiter review."
        recommendation = "Keep this candidate in the active review pool."
    elif score >= 55:
        summary = "Moderate role fit: the resume has partial overlap, but important requirements need validation."
        recommendation = "Review missing requirements before shortlisting."
    else:
        summary = "Low role fit: the resume does not show enough evidence against the current job requirements."
        recommendation = "Consider only if the recruiter is open to adjacent experience."

    strengths = []
    if matched_requirements:
        strengths.append(f"Direct evidence found for {len(matched_requirements)} job requirement(s).")
    if candidate_skills:
        strengths.append("Candidate profile includes declared skills that can be compared with the role.")
    if profile_snapshot.get("experience_years"):
        strengths.append(f"Candidate reports {profile_snapshot.get('experience_years')} years of experience.")

    gaps = []
    if missing_requirements:
        gaps.append(f"{len(missing_requirements)} requirement(s) need stronger resume evidence.")
    if partial_requirements:
        gaps.append(f"{len(partial_requirements)} requirement(s) are partially visible and need validation.")
    if not requirements:
        gaps.append("The job has limited structured requirements, so the match confidence is lower.")

    return {
        "score": score,
        "summary": summary,
        "recommendation": recommendation,
        "requirement_match": {
            "matched": len(matched_requirements),
            "partial": len(partial_requirements),
            "missing": len(missing_requirements),
            "total": total_requirements,
            "percentage": coverage_score,
        },
        "matched_requirements": matched_requirements[:8],
        "partial_requirements": partial_requirements[:8],
        "missing_requirements": missing_requirements[:8],
        "strengths": strengths[:5],
        "gaps": gaps[:5],
        "category_scores": [
            {
                "label": "Must-have requirement evidence",
                "score": coverage_score,
                "maxScore": 100,
                "note": "Measures visible resume evidence against the posted requirements.",
            },
            {
                "label": "Skill and tool coverage",
                "score": skill_score,
                "maxScore": 100,
                "note": "Compares job terms with resume/profile skills.",
            },
            {
                "label": "Experience alignment",
                "score": experience_score,
                "maxScore": 100,
                "note": "Checks role/title and years-of-experience signals.",
            },
            {
                "label": "Responsibility readiness",
                "score": responsibility_score,
                "maxScore": 100,
                "note": "Looks for evidence related to expected responsibilities.",
            },
        ],
        "role_alignment": [
            {"label": "Requirement coverage", "score": coverage_score, "note": "How many role requirements have visible evidence."},
            {"label": "Skill proximity", "score": skill_score, "note": "How closely candidate skills map to job terms."},
            {"label": "Role readiness", "score": score, "note": "Overall role-fit score for recruiter filtering."},
        ],
        "recruiter_notes": [
            "This score compares job requirements with resume/profile evidence only.",
            "Grammar, layout, formatting, and resume style were not used in this role-fit score.",
        ],
        "confidence": "medium" if total_requirements else "low",
        "source": "local-fallback",
        "model": "heuristic",
        "scanned_at": datetime.utcnow().isoformat(),
        "input_signature": signature,
    }


def _grounded_job_ats_result(
    profile_snapshot: dict[str, Any],
    resume_text: str,
    job_snapshot: dict[str, Any],
    signature: str,
    ai_result: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    requirements = _extract_job_requirements(job_snapshot)
    responsibilities = _extract_job_responsibilities(job_snapshot)
    candidate_skills = _normalize_list(profile_snapshot.get("skills"), limit=24)
    evidence_text = "\n".join(
        part
        for part in [
            normalize_text(resume_text),
            _job_text(profile_snapshot.get("bio")),
            _job_text(profile_snapshot.get("current_job_title")),
            _job_text(profile_snapshot.get("current_company")),
            _job_text(candidate_skills),
        ]
        if part
    )
    ai_assessments = (ai_result or {}).get("evidence_assessments") or []
    assessments: list[dict[str, Any]] = []
    for item_type, items in (("requirement", requirements), ("responsibility", responsibilities)):
        for item in items:
            local = _local_evidence_assessment(item, item_type, evidence_text)
            ai_assessment = _find_ai_assessment(item, item_type, ai_assessments)
            selected = local
            if ai_assessment:
                ai_status = normalize_text(str(ai_assessment.get("status", ""))).lower()
                ai_quote = normalize_text(str(ai_assessment.get("evidence_quote", "")))
                if ai_status in EVIDENCE_STATUS_VALUE and (
                    ai_status == "missing" or _quote_is_grounded(ai_quote, evidence_text)
                ):
                    ai_candidate = {
                        "item": item,
                        "item_type": item_type,
                        "status": ai_status,
                        "evidence_quote": ai_quote if ai_status != "missing" else "",
                        "rationale": normalize_text(str(ai_assessment.get("rationale", ""))) or "System evidence classification.",
                        "confidence": max(0.0, min(1.0, float(ai_assessment.get("confidence", 0.7) or 0.7))),
                        "evidence_validated": ai_status == "missing" or bool(ai_quote),
                    }
                    # Preserve undeniable exact evidence; otherwise use the grounded semantic classification.
                    direct_local_evidence = bool(local.get("exact_match")) or float(local.get("term_coverage") or 0) >= 0.85
                    selected = local if direct_local_evidence and local["status"] == "matched" else ai_candidate
            assessments.append(selected)

    requirement_assessments = [item for item in assessments if item["item_type"] == "requirement"]
    responsibility_assessments = [item for item in assessments if item["item_type"] == "responsibility"]

    weighted_requirement_total = sum(_requirement_weight(item["item"]) for item in requirement_assessments)
    weighted_requirement_value = sum(
        _requirement_weight(item["item"]) * EVIDENCE_STATUS_VALUE[item["status"]]
        for item in requirement_assessments
    )
    requirement_score = round((weighted_requirement_value / weighted_requirement_total) * 100) if weighted_requirement_total else 0

    job_terms: list[str] = []
    for value in [job_snapshot.get("title"), *requirements, *responsibilities]:
        job_terms.extend(_requirement_terms(_job_text(value)))
    job_terms = list(dict.fromkeys(job_terms))[:40]
    evidence_terms = set(_requirement_terms(evidence_text))
    matched_job_terms = [term for term in job_terms if term in evidence_terms]
    lexical_skill_score = round((len(matched_job_terms) / len(job_terms)) * 100) if job_terms else requirement_score
    # Semantic requirement validation is the primary signal. Broad job prose often
    # contains non-skill terms, so raw token coverage is only a supporting signal.
    skill_score = round((requirement_score * 0.7) + (lexical_skill_score * 0.3))

    required_years = _required_experience_years(job_snapshot)
    candidate_years = 0
    try:
        candidate_years = max(0, int(round(float(profile_snapshot.get("experience_years") or 0))))
    except (TypeError, ValueError):
        candidate_years = 0
    title_terms = set(_requirement_terms(_job_text(job_snapshot.get("title"))))
    role_alignment_score = round((len(title_terms & evidence_terms) / max(1, len(title_terms))) * 100) if title_terms else 0
    responsibility_evidence_score = round(
        sum(EVIDENCE_STATUS_VALUE[item["status"]] for item in responsibility_assessments)
        / len(responsibility_assessments)
        * 100
    ) if responsibility_assessments else requirement_score
    role_evidence_score = round((requirement_score * 0.75) + (responsibility_evidence_score * 0.25))
    if required_years:
        years_score = min(100, round((candidate_years / required_years) * 100))
        # Validated role evidence prevents a title wording difference from unfairly
        # suppressing an otherwise well-supported candidate.
        experience_score = round((years_score * 0.4) + (role_alignment_score * 0.2) + (role_evidence_score * 0.4))
    else:
        experience_score = round((role_alignment_score * 0.35) + (role_evidence_score * 0.65))

    if responsibility_assessments:
        responsibility_score = responsibility_evidence_score
    else:
        responsibility_score = requirement_score

    raw_components = {
        "requirement_evidence": requirement_score,
        "skill_tool_coverage": skill_score,
        "experience_alignment": experience_score,
        "responsibility_readiness": responsibility_score,
    }
    calculation_components = []
    score = 0.0
    for key, weight in JOB_ATS_WEIGHTS.items():
        raw_score = raw_components[key]
        contribution = raw_score * (weight / 100)
        score += contribution
        calculation_components.append(
            {
                "key": key,
                "label": key.replace("_", " ").title(),
                "score": raw_score,
                "weight": weight,
                "contribution": round(contribution, 2),
            }
        )
    score = max(0, min(100, round(score)))

    matched_requirements = [item["item"] for item in requirement_assessments if item["status"] == "matched"]
    partial_requirements = [item["item"] for item in requirement_assessments if item["status"] == "partial"]
    missing_requirements = [item["item"] for item in requirement_assessments if item["status"] == "missing"]
    validated_assessments = [item for item in assessments if item.get("evidence_validated")]
    validated_evidence = [item for item in validated_assessments if item.get("evidence_quote")]
    evidence_confidence = (
        sum(float(item.get("confidence") or 0) for item in validated_assessments) / len(validated_assessments)
        if validated_assessments
        else 0.0
    )
    structured_input_ratio = min(1.0, (len(requirements) / 5) if requirements else 0.0)
    confidence_value = round(((evidence_confidence * 0.7) + (structured_input_ratio * 0.3)) * 100)
    confidence = "high" if confidence_value >= 78 else "medium" if confidence_value >= 52 else "low"

    positive_factors: list[str] = []
    limiting_factors: list[str] = []
    if matched_requirements:
        positive_factors.append(
            f"{len(matched_requirements)} of {len(requirement_assessments)} job requirements have validated candidate evidence."
        )
    if responsibility_assessments:
        matched_responsibilities = sum(1 for item in responsibility_assessments if item["status"] == "matched")
        positive_factors.append(
            f"{matched_responsibilities} of {len(responsibility_assessments)} responsibilities are directly supported."
        )
    if candidate_years:
        positive_factors.append(
            f"The profile records {candidate_years} years of experience"
            + (f" against a {required_years}-year minimum." if required_years else ".")
        )
    if partial_requirements:
        limiting_factors.append(
            f"{len(partial_requirements)} requirement(s) have related evidence but still need recruiter validation."
        )
    if missing_requirements:
        limiting_factors.append(
            f"{len(missing_requirements)} requirement(s) have no supporting evidence in the submitted CV or profile."
        )
    for component in calculation_components:
        if component["score"] < 65:
            limiting_factors.append(
                f"{component['label']} contributes only {component['contribution']} of {component['weight']} available points."
            )
    if not limiting_factors:
        limiting_factors.append("No material requirement gap was detected; remaining score variance comes from weighted evidence depth.")

    if score >= 85:
        summary = "Strong job fit with validated evidence across most requirements and role responsibilities."
        recommendation = "Prioritize for recruiter review, while confirming any listed gaps."
    elif score >= 70:
        summary = "Good job fit with substantial evidence, although some requirements need validation."
        recommendation = "Proceed to recruiter review and validate partial requirements."
    elif score >= 50:
        summary = "Moderate job fit with mixed evidence across the posted requirements."
        recommendation = "Review evidence and missing must-haves before approval."
    else:
        summary = "Low current job fit because the CV does not prove enough of this role's requirements."
        recommendation = "Do not shortlist solely on this score; manually verify adjacent or unlisted experience."

    return {
        "score": score,
        "summary": summary,
        "recommendation": recommendation,
        "requirement_match": {
            "matched": len(matched_requirements),
            "partial": len(partial_requirements),
            "missing": len(missing_requirements),
            "total": len(requirement_assessments),
            "percentage": requirement_score,
        },
        "matched_requirements": matched_requirements[:12],
        "partial_requirements": partial_requirements[:12],
        "missing_requirements": missing_requirements[:12],
        "strengths": [
            f"Validated CV evidence was found for: {item['item']}"
            for item in validated_evidence[:5]
        ],
        "gaps": limiting_factors[:6],
        "category_scores": [
            {"label": component["label"], "score": component["score"], "maxScore": 100, "note": f"Weight {component['weight']}%; contribution {component['contribution']} points."}
            for component in calculation_components
        ],
        "role_alignment": [
            {"label": "Requirement coverage", "score": requirement_score, "note": "Weighted matched, partial, and missing requirement evidence."},
            {"label": "Skill proximity", "score": skill_score, "note": f"Validated requirement evidence is blended with {len(matched_job_terms)} of {len(job_terms)} explicit role terms."},
            {"label": "Experience fit", "score": experience_score, "note": f"Candidate experience {candidate_years} years; job minimum {required_years or 'not specified'}."},
        ],
        "evidence_assessments": assessments,
        "recruiter_notes": [
            "Only CV/profile evidence was scored; grammar, layout, and resume styling were excluded.",
            "Model classifications are evidence-validated and the numeric score is calculated deterministically by the backend.",
            "A low-confidence report should always be manually reviewed.",
        ],
        "confidence": confidence,
        "confidence_score": confidence_value,
        "score_context": {
            "explanation": "The score is calculated from validated CV/profile evidence for this job. It is not reduced for grammar, formatting, or resume design.",
            "positive_factors": positive_factors,
            "limiting_factors": limiting_factors,
            "no_missing_requirements": bool(requirement_assessments) and not missing_requirements,
            "lexical_skill_score": lexical_skill_score,
            "role_evidence_score": role_evidence_score,
        },
        "calculation": {
            "version": "invenia-job-ats-v3",
            "formula": "50% requirement evidence + 20% skill/tool coverage + 20% experience alignment + 10% responsibility readiness",
            "components": calculation_components,
            "score": score,
        },
        "source": "system-grounded" if ai_result else "deterministic-fallback",
        "model": (ai_result or {}).get("model", "invenia-grounded-fit-v2"),
        "scanned_at": (ai_result or {}).get("scanned_at", datetime.utcnow().isoformat()),
        "input_signature": signature,
    }


def _build_job_ats_prompt(
    profile_snapshot: dict[str, Any],
    resume_text: str,
    job_snapshot: dict[str, Any],
) -> str:
    profile_json = json.dumps(profile_snapshot, ensure_ascii=False, indent=2)
    job_json = json.dumps(job_snapshot, ensure_ascii=False, indent=2)
    resume_excerpt = normalize_text(resume_text)
    if len(resume_excerpt) > 14000:
        resume_excerpt = resume_excerpt[:14000]

    return f"""
You are Invenia AI's evidence classifier for job-specific screening.
Do not calculate the final ATS percentage. The backend calculates it deterministically.

For every requirement and responsibility in the supplied job, classify CV/profile evidence as:
- matched: direct, specific evidence proves the item.
- partial: related evidence exists but does not fully prove the item.
- missing: no evidence exists.

Evidence rules:
- Copy a short exact evidence quote from the CV/profile for every matched or partial item.
- Use an empty quote for missing items.
- Never infer a skill from job title alone and never invent projects, tools, certifications, dates, or experience.
- Grammar, spelling, formatting, visual structure, and resume style are irrelevant.
- Assess this exact job only. Similar job titles must still be evaluated from their own requirements.
- Return one evidence_assessments entry for every supplied requirement and responsibility.
- Return JSON only.

Output shape:
{{
  "evidence_assessments": [
    {{
      "item": "exact requirement or responsibility text",
      "item_type": "requirement or responsibility",
      "status": "matched, partial, or missing",
      "evidence_quote": "exact candidate evidence or empty string",
      "rationale": "brief evidence-grounded reason",
      "confidence": 0.0
    }}
  ]
}}

Job details:
{job_json}

Candidate profile:
{profile_json}

Resume text:
{resume_excerpt or "No extracted text was available."}
""".strip()


def _call_gemini_job_ats_scan(
    profile_snapshot: dict[str, Any],
    resume_text: str,
    job_snapshot: dict[str, Any],
    resume_path: Optional[Path],
) -> dict[str, Any]:
    api_key = get_gemini_api_key()
    if not api_key:
        return {}

    prompt = _build_job_ats_prompt(profile_snapshot, resume_text, job_snapshot)
    parts: list[dict[str, Any]] = [{"text": prompt}]
    if resume_path and resume_path.exists() and can_send_inline_to_gemini(resume_path):
        try:
            raw_bytes = resume_path.read_bytes()
            parts.append(
                {
                    "inline_data": {
                        "mime_type": guess_resume_mime_type(resume_path),
                        "data": base64.b64encode(raw_bytes).decode("ascii"),
                    }
                }
            )
        except Exception:
            pass

    response_schema = {
        "type": "object",
        "properties": {
            "evidence_assessments": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "item": {"type": "string"},
                        "item_type": {"type": "string", "enum": ["requirement", "responsibility"]},
                        "status": {"type": "string", "enum": ["matched", "partial", "missing"]},
                        "evidence_quote": {"type": "string"},
                        "rationale": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["item", "item_type", "status", "evidence_quote", "rationale", "confidence"],
                },
            }
        },
        "required": ["evidence_assessments"],
    }
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": parts,
            }
        ],
        "generationConfig": {
            "temperature": 0.15,
            "maxOutputTokens": 3200,
            "thinkingConfig": {
                "thinkingBudget": 0,
            },
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        },
    }

    for model in _iter_gemini_models():
        try:
            response = requests.post(
                GEMINI_API_URL.format(model=model),
                params={"key": api_key},
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            response_json = response.json()
            generated_text = _extract_generated_text(response_json)
            parsed = _safe_parse_json(generated_text)
            if not parsed:
                continue

            parsed["source"] = "gemini"
            parsed["model"] = model
            parsed["scanned_at"] = datetime.utcnow().isoformat()
            return parsed
        except Exception:
            continue

    return {}


def _build_gemini_prompt(profile_snapshot: dict[str, Any], resume_text: str) -> str:
    profile_json = json.dumps(profile_snapshot, ensure_ascii=False, indent=2)
    resume_excerpt = normalize_text(resume_text)
    if len(resume_excerpt) > 12000:
        resume_excerpt = resume_excerpt[:12000]

    return f"""
You are Invenia AI's ATS resume scanner.
Evaluate the uploaded resume like a real ATS and recruiter would.

Score rubric:
- Contact & Header: 20 points
- Experience Impact: 20 points
- Skills & Keywords: 20 points
- ATS Formatting: 20 points
- Projects & Education: 20 points

Rules:
- Use only evidence present in the profile snapshot and resume content.
- Do not invent work history, education, or certifications.
- Prefer practical recruiter language and concrete feedback.
- Return JSON only. No markdown. No code fences.
- The JSON object must contain:
  score, summary, strengths, gaps, keywords_found, keywords_missing,
  breakdown, suggestions, optimization_tips, optimized_resume_headline.
- breakdown must be an array with these exact labels:
  Contact & Header, Experience Impact, Skills & Keywords, ATS Formatting, Projects & Education.
- Each breakdown item must include label, score, maxScore, and note.
- Use short, specific bullets for strengths, gaps, suggestions, and optimization_tips.

Candidate profile snapshot:
{profile_json}

Resume text:
{resume_excerpt or "No extracted text was available."}
""".strip()


def _call_gemini_ats_scan(profile_snapshot: dict[str, Any], resume_text: str, resume_path: Optional[Path]) -> dict[str, Any]:
    api_key = get_gemini_api_key()
    if not api_key:
        return {}

    prompt = _build_gemini_prompt(profile_snapshot, resume_text)
    parts: list[dict[str, Any]] = [{"text": prompt}]
    if resume_path and resume_path.exists():
        try:
            raw_bytes = resume_path.read_bytes()
            parts.append(
                {
                    "inline_data": {
                        "mime_type": guess_resume_mime_type(resume_path),
                        "data": base64.b64encode(raw_bytes).decode("ascii"),
                    }
                }
            )
        except Exception:
            pass

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": parts,
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "max_output_tokens": 1200,
            "thinkingConfig": {
                "thinkingBudget": 0,
            },
            "response_mime_type": "application/json",
        },
    }

    for model in _iter_gemini_models():
        try:
            response = requests.post(
                GEMINI_API_URL.format(model=model),
                params={"key": api_key},
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            response_json = response.json()
            generated_text = _extract_generated_text(response_json)
            parsed = _safe_parse_json(generated_text)
            if not parsed:
                continue

            parsed["source"] = "gemini"
            parsed["model"] = model
            parsed["scanned_at"] = datetime.utcnow().isoformat()
            return parsed
        except Exception:
            continue

    return {}


def calculate_ats_score(
    profile_snapshot: dict[str, Any],
    resume_text: str,
    resume_path: Optional[Path] = None,
) -> dict[str, Any]:
    normalized_profile = dict(profile_snapshot or {})
    normalized_profile["skills"] = _normalize_list(normalized_profile.get("skills"), limit=12)
    resume_text = resume_text or (extract_resume_text(resume_path) if resume_path else "")
    signature = build_candidate_ats_signature(normalized_profile, resume_path)

    try:
        gemini_result = _call_gemini_ats_scan(normalized_profile, resume_text, resume_path)
    except Exception:
        gemini_result = {}

    if gemini_result:
        score = gemini_result.get("score", 0)
        try:
            score = int(round(float(score or 0)))
        except (TypeError, ValueError):
            score = 0
        score = max(0, min(score, 100))

        breakdown = _normalize_breakdown(gemini_result.get("breakdown"))
        if not breakdown:
            breakdown = _fallback_ats_result(normalized_profile, resume_text, signature)["breakdown"]

        suggestions = _normalize_list(gemini_result.get("suggestions"), limit=6)
        optimization_tips = _normalize_list(gemini_result.get("optimization_tips"), limit=6) or suggestions
        strengths = _normalize_list(gemini_result.get("strengths"), limit=6)
        gaps = _normalize_list(gemini_result.get("gaps"), limit=6)
        keywords_found = _normalize_list(gemini_result.get("keywords_found"), limit=8)
        keywords_missing = _normalize_list(gemini_result.get("keywords_missing"), limit=8)
        summary = normalize_text(str(gemini_result.get("summary", "")))
        if not summary:
            summary = _fallback_ats_result(normalized_profile, resume_text, signature)["summary"]

        optimized_resume_headline = normalize_text(str(gemini_result.get("optimized_resume_headline", "")))

        return {
            "score": score,
            "summary": summary,
            "strengths": strengths,
            "gaps": gaps or suggestions[:4],
            "keywords_found": keywords_found,
            "keywords_missing": keywords_missing,
            "breakdown": breakdown,
            "suggestions": suggestions or optimization_tips,
            "optimization_tips": optimization_tips,
            "optimized_resume_headline": optimized_resume_headline,
            "source": gemini_result.get("source", "gemini"),
            "model": gemini_result.get("model", get_gemini_model()),
            "scanned_at": gemini_result.get("scanned_at", datetime.utcnow().isoformat()),
            "input_signature": signature,
        }

    return _fallback_ats_result(normalized_profile, resume_text, signature)


def calculate_job_ats_score(
    profile_snapshot: dict[str, Any],
    resume_text: str,
    job_snapshot: dict[str, Any],
    resume_path: Optional[Path] = None,
) -> dict[str, Any]:
    normalized_profile = dict(profile_snapshot or {})
    normalized_profile["skills"] = _normalize_list(normalized_profile.get("skills"), limit=16)
    normalized_job = dict(job_snapshot or {})
    normalized_job["requirements"] = _normalize_list(normalized_job.get("requirements"), limit=24)
    if isinstance(normalized_job.get("responsibilities"), list):
        normalized_job["responsibilities"] = _normalize_list(normalized_job.get("responsibilities"), limit=16)
    resume_text = resume_text or (extract_resume_text(resume_path) if resume_path else "")
    signature = build_job_ats_signature(normalized_profile, normalized_job, resume_path)
    with _JOB_ATS_CACHE_LOCK:
        cached = _JOB_ATS_CACHE.get(signature)
        if cached and time.time() - cached[0] <= JOB_ATS_CACHE_TTL_SECONDS:
            return dict(cached[1])
    try:
        gemini_result = _call_gemini_job_ats_scan(normalized_profile, resume_text, normalized_job, resume_path)
    except Exception:
        gemini_result = {}
    result = _grounded_job_ats_result(
        normalized_profile,
        resume_text,
        normalized_job,
        signature,
        gemini_result or None,
    )
    with _JOB_ATS_CACHE_LOCK:
        _JOB_ATS_CACHE[signature] = (time.time(), result)
        if len(_JOB_ATS_CACHE) > 256:
            oldest = min(_JOB_ATS_CACHE, key=lambda key: _JOB_ATS_CACHE[key][0])
            _JOB_ATS_CACHE.pop(oldest, None)
    return dict(result)


def calculate_deterministic_job_ats_score(
    profile_snapshot: dict[str, Any],
    resume_text: str,
    job_snapshot: dict[str, Any],
    resume_path: Optional[Path] = None,
    previous_result: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    normalized_profile = dict(profile_snapshot or {})
    normalized_profile["skills"] = _normalize_list(normalized_profile.get("skills"), limit=24)
    normalized_job = dict(job_snapshot or {})
    normalized_job["requirements"] = _normalize_list(normalized_job.get("requirements"), limit=24)
    normalized_job["responsibilities"] = _normalize_list(normalized_job.get("responsibilities"), limit=16)
    resume_text = resume_text or (extract_resume_text(resume_path) if resume_path else "")
    signature = build_job_ats_signature(normalized_profile, normalized_job, resume_path)
    preserved_evidence = None
    if isinstance(previous_result, dict) and previous_result.get("evidence_assessments"):
        preserved_evidence = {
            "evidence_assessments": previous_result.get("evidence_assessments"),
            "model": previous_result.get("model", "invenia-grounded-fit-v3"),
            "scanned_at": previous_result.get("scanned_at", datetime.utcnow().isoformat()),
        }
    return _grounded_job_ats_result(
        normalized_profile,
        resume_text,
        normalized_job,
        signature,
        preserved_evidence,
    )
