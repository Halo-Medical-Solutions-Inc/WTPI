from typing import Any, Dict, List, Optional

DEFAULT_PROVIDER_NAMES: List[str] = [
    "Dr. Raul Lopez",
    "Ilyana Yee, NP",
    "Monica Ogaz, NP",
    "Lucia Fisher, NP",
    "Amanda Lopez, PA",
    "Other",
    "Not Provided",
]

PROVIDER_STAFF_DIRECTORY: List[Dict[str, Any]] = []

DEPARTMENT_STAFF_DIRECTORY: List[Dict[str, Any]] = []

_TEAMS_OTHER_LABEL = "Other"

_PROVIDER_TO_CALL_TEAMS_MAP = (
    "Map provider_name to call_teams using the provider's personal team when one exists "
    "(e.g. Dr. Lopez -> Dr. Lopez team). When the call is about a procedure that "
    "Dr. Lopez performs (epidural injections, RFA, spinal cord stimulator, kyphoplasty, "
    "nerve blocks, regenerative medicine), assign to Dr. Lopez's team even if the "
    "patient mentions seeing one of the NPs/PA for follow-up."
)

_TEAMS_FIELD_SUFFIX = (
    f"{_PROVIDER_TO_CALL_TEAMS_MAP} "
    f"Use '{_TEAMS_OTHER_LABEL}' when the call does not belong to any listed team "
    "(billing-only, general info, unknown provider, spam, workers' comp / LOP intake "
    "without a clear provider assignment)."
)


def _call_teams_field_description(team_names_str: str) -> str:
    return (
        "All teams this call is associated with. "
        "A call can belong to multiple teams. "
        "Select all that apply based on the call content, provider, and context. "
        "Infer the best match from available teams even when transcript has errors. "
        f"Available teams: {team_names_str}. "
        + _TEAMS_FIELD_SUFFIX
    )


def build_staff_extension_map(
    provider_directory: List[Dict[str, Any]],
    department_directory: List[Dict[str, Any]],
) -> str:
    lines: List[str] = [
        "Staff extension directory — if the caller mentions a staff member "
        "by name or requests a specific extension number, use this lookup "
        "to resolve the correct provider:",
    ]
    for entry in provider_directory:
        provider = entry["provider"]
        parts = [f"Ext {entry['provider_ext']}: {provider}"]
        for s in entry["staff"]:
            parts.append(f"{s['name']} ({s['role']}, ext {s['ext']})")
        lines.append(f"  {' / '.join(parts)} -> {provider}")
    lines.append(
        "Department staff (no assigned provider — use best judgment from call context):"
    )
    for dept in department_directory:
        lines.append(f"  Ext {dept['ext']}: {dept['contact']} ({dept['department']})")
    if provider_directory or department_directory:
        lines.append(
            "If a caller mentions a staff member by name or extension, "
            "match to the most relevant provider based on call context."
        )
    return "\n".join(lines)


DEFAULT_PRIORITY_LOW = (
    "Routine appointment scheduling, follow-up appointments, billing questions, "
    "medical records requests, general inquiries about services or insurance, "
    "telehealth questions, refill requests with no urgency, workers' comp / LOP intake."
)
DEFAULT_PRIORITY_MEDIUM = (
    "Non-urgent symptom reports (e.g. mild pain flare, ongoing chronic pain question), "
    "medication questions without acute concerns, prior authorization status, "
    "appointment reschedules, pre-procedure prep questions, telehealth setup issues."
)
DEFAULT_PRIORITY_HIGH = (
    "Signs of infection at an injection or implant site (redness, warmth, drainage, fever), "
    "severe new weakness or numbness, loss of bladder or bowel control, severe headache "
    "after a spinal injection, post-procedure complications, calls from outside practices, "
    "hospitals, or pharmacies about a patient, severely escalated callers, "
    "or anything requiring same-day or immediate attention."
)


def _build_priority_description(custom: Optional[Dict[str, str]] = None) -> str:
    low = (custom or {}).get("low") or DEFAULT_PRIORITY_LOW
    medium = (custom or {}).get("medium") or DEFAULT_PRIORITY_MEDIUM
    high = (custom or {}).get("high") or DEFAULT_PRIORITY_HIGH
    return f"Urgency level of the call. Low: {low} Medium: {medium} High: {high}"


def build_extraction_schema(
    provider_names: List[str],
    team_names: Optional[List[str]] = None,
    staff_extension_map: Optional[str] = None,
    priority_descriptions: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    provider_enum = (
        provider_names
        if "Not Provided" in provider_names
        else provider_names + ["Not Provided"]
    )
    provider_names_str = ", ".join(provider_names)

    provider_description = (
        "Provider the caller is asking for. "
        "Match to the closest option in the enum even when the transcript has "
        "typos or misheard names (e.g. 'Doctor Lopes' or 'Doctor Lopaz' -> Dr. Raul Lopez; "
        "'Iliana' or 'Yi' -> Ilyana Yee, NP; 'Ogas' -> Monica Ogaz, NP; "
        "'Fischer' -> Lucia Fisher, NP)."
    )
    if staff_extension_map:
        provider_description += f" {staff_extension_map}"

    fields: List[Dict[str, Any]] = [
        {
            "name": "caller_name",
            "type": "string",
            "description": "Name of the person calling",
        },
        {
            "name": "caller_affiliation",
            "type": "string",
            "description": "Relationship of caller to the patient",
            "enum": [
                "Patient",
                "Family Member",
                "Caregiver",
                "Pharmacy",
                "Other Provider",
                "Hospital",
                "Insurance",
                "Workers Comp / Attorney",
                "Other",
                "Not Provided",
            ],
        },
        {
            "name": "patient_dob",
            "type": "string",
            "description": "Date of birth of the patient",
        },
        {
            "name": "patient_name",
            "type": "string",
            "description": "Name of the patient the call is about",
        },
        {
            "name": "provider_name",
            "type": "string",
            "description": provider_description,
            "enum": provider_enum,
        },
        {
            "name": "primary_intent",
            "type": "string",
            "description": "Main reason for the call",
            "enum": [
                "Appointment (New/Reschedule/Cancel)",
                "Prescription Refill",
                "Procedure Inquiry",
                "Pre-Procedure Question",
                "Post-Procedure Concern",
                "Test Results",
                "Referral Request",
                "Medical Records",
                "Billing/Insurance Question",
                "Prior Authorization",
                "Workers Comp / LOP",
                "Telehealth",
                "Speak to Staff",
                "Report Symptoms",
                "Spam/Wrong Number",
                "Other",
                "Not Provided",
            ],
        },
        {
            "name": "priority",
            "type": "string",
            "description": _build_priority_description(priority_descriptions),
            "enum": [
                "Low",
                "Medium",
                "High",
                "Not Provided",
            ],
        },
        {
            "name": "summary",
            "type": "string",
            "description": (
                "Direct, concise summary of the call. "
                "The practice name is West Texas Pain Institute — always use this exact name, "
                "never a transcription variant like 'West Texas Pain Center' or 'WTP Institute.' "
                "Use the correct provider name from the schema (not transcript typos). "
                f"Available providers: {provider_names_str}."
            ),
        },
        {
            "name": "auto_review",
            "type": "boolean",
            "description": (
                "Whether this call can be automatically marked as reviewed without human review. "
                "Set to true ONLY for spam, wrong numbers, robocalls, abandoned calls with no "
                "meaningful content, or calls where no human follow-up action is needed. "
                "Also set to true if the call was transferred to a live person, since staff "
                "already handled it during the transfer. "
                "Set to false for ANY call that requires staff action such as scheduling, "
                "callbacks, prescription refills, procedure scheduling, prior authorizations, "
                "medical records requests, workers' comp intake, or any legitimate patient "
                "call that was NOT transferred. When in doubt, set to false."
            ),
        },
    ]

    if team_names:
        team_names_str = ", ".join(team_names)
        teams_description = _call_teams_field_description(team_names_str)
        if staff_extension_map:
            teams_description += (
                " When the caller mentions a staff name or extension number, "
                "use the staff extension directory (from the provider_name field) "
                "to identify the associated provider(s) and assign the call to "
                "their team(s)."
            )
        fields.append(
            {
                "name": "call_teams",
                "type": "array",
                "items": {"type": "string", "enum": team_names},
                "description": teams_description,
            }
        )

    return {"fields": fields}


DEFAULT_EXTRACTION_SCHEMA: Dict[str, Any] = build_extraction_schema(
    DEFAULT_PROVIDER_NAMES
)
