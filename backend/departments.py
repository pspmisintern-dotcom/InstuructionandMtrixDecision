"""
departments.py

Single source of truth for the canonical department list and the
filename-keyword classifier used to assign a WorkInstruction to a department.
Previously this logic was duplicated (and disagreed) across doc_parser.py,
routes/workinstruction_routes.py, and migrate_departments.py, which caused the
same WI number to end up in different departments depending on which code
path created its row.
"""

DEPARTMENTS = [
    "Grinding",
    "Masking",
    "Spraying",
    "Production",
    "HR",
    "Marketing",
    "Change control",
    "Purchase",
    "Maintenance",
    "Quality",
    "Sales",
    "QMS",
]

# Legacy/alternate department labels (from older seed/migration logic) mapped
# onto the canonical list above, so historical data displays consistently.
LEGACY_DEPARTMENT_MAP = {
    "Spray / Surface Engineering": "Spraying",
    "Surface Engineering": "Spraying",
    "Blasting": "Spraying",
    "Logistics / Stores": "Production",
    "Safety / EHS": "Production",
    "Quality Assurance": "Quality",
    "Inspection": "Quality",
    "Calibration": "Quality",
    "Packing": "Production",
    "Training": "HR",
}


def determine_department_from_filename(filename: str) -> str:
    lower = filename.lower()
    if any(k in lower for k in ["grind", "abrasive", "wheel", "surface finish", "polish", "bainline"]):
        return "Grinding"
    if any(k in lower for k in ["mask", "tape", "cover", "protect", "masking"]):
        return "Masking"
    if any(k in lower for k in ["spray", "blasting", "coating", "paint", "thermal", "hvof", "plasma", "twas", "pta"]):
        return "Spraying"
    if any(k in lower for k in ["training", "hr", "human resource"]):
        return "HR"
    if "marketing" in lower:
        return "Marketing"
    if any(k in lower for k in ["change control", "nc product", "product control", "corrective action"]):
        return "Change control"
    if any(k in lower for k in ["purchase", "purchasing", "procurement"]):
        return "Purchase"
    if any(k in lower for k in ["maintenance", "preventive", "maint"]):
        return "Maintenance"
    if any(k in lower for k in ["internal audit", "internal_audit", "leadership", "continual", "annexure", "operation"]):
        return "QMS"
    if "sales" in lower:
        return "Sales"
    if any(k in lower for k in ["quality", "inspection", "calibration", "hardness", "qms", "test", "checking"]):
        return "Quality"
    return "Production"


def normalize_department(name: str) -> str:
    """Map a legacy/alternate department label onto the canonical list."""
    if not name:
        return "Production"
    return LEGACY_DEPARTMENT_MAP.get(name, name)
