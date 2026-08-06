"""
decision_engine.py

Configurable decision matrix rule engine.

Rules are stored in the DecisionRule table and can also be evaluated
in-memory from a Python list. The engine evaluates conditions against
an input context dict and returns applicable actions.

Example rules (from spec):
  IF Humidity > 80%  -> display warning, notify supervisor, disable start
  IF Component Damaged -> take photos, notify customer, await approval, block
  IF Surface Roughness NOT OK -> recommend reblast + repeat inspection
  IF Coating Thickness LOW -> recommend additional spray
  IF Coating Thickness HIGH -> recommend grinding + supervisor approval
  IF Torch Ignition Failed -> check gas/oxygen/fuel/pressure, retry, notify maintenance
"""

import operator
from typing import Any, Dict, List

from backend.models import DecisionRule
from sqlalchemy.orm import Session

import re

# Mapping of operator strings to python operator functions
OPERATORS = {
    ">": operator.gt,
    "<": operator.lt,
    ">=": operator.ge,
    "<=": operator.le,
    "==": operator.eq,
    "!=": operator.ne,
    "contains": lambda a, b: str(b).lower() in str(a).lower(),
    "not_contains": lambda a, b: str(b).lower() not in str(a).lower(),
    "in": lambda a, b: a in b if isinstance(b, (list, tuple, set)) else str(a) in str(b),
    "between": lambda a, b: float(b[0]) <= float(a) <= float(b[1]) if isinstance(b, (list, tuple)) and len(b) == 2 else False,
    "is_empty": lambda a, b: a is None or (isinstance(a, str) and not a.strip()),
    "not_empty": lambda a, b: not (a is None or (isinstance(a, str) and not a.strip())),
    "regex": lambda a, b: bool(re.search(str(b), str(a), re.IGNORECASE)),
}


def _coerce(value: Any) -> Any:
    """Attempt to coerce string numerics to float for comparison."""
    if isinstance(value, str):
        try:
            return float(value)
        except (ValueError, TypeError):
            return value
    return value


def evaluate_condition(field, op, expected, context) -> bool:
    """Evaluate a single condition against the context dict."""
    actual = context.get(field)
    func = OPERATORS.get(op)
    if func is None:
        return False
    # is_empty / not_empty can operate on missing (None) values.
    if op in ("is_empty", "not_empty"):
        try:
            return func(actual, expected)
        except Exception:
            return False
    if actual is None:
        return False
    actual = _coerce(actual)
    expected = _coerce(expected)
    try:
        return func(actual, expected)
    except Exception:
        return False


DEFAULT_RULES = [
    {
        "name": "Humidity High",
        "work": "Blasting",
        "condition_field": "humidity",
        "condition_operator": ">",
        "condition_value": "80",
        "action_type": "display",
        "action_detail": "⚠ Humidity exceeds allowable limit. Do not start blasting. Notify Supervisor. Disable Start Button.",
    },
    {
        "name": "Component Damaged",
        "work": "*",
        "condition_field": "component_damaged",
        "condition_operator": "==",
        "condition_value": "true",
        "action_type": "block",
        "action_detail": "Take photographs. Notify customer. Await approval. Prevent further processing.",
    },
    {
        "name": "Surface Roughness Not OK",
        "work": "Blasting",
        "condition_field": "surface_roughness_ok",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "recommend",
        "action_detail": "Reblast Surface. Repeat Inspection.",
    },
    {
        "name": "Coating Thickness Low",
        "work": "*",
        "condition_field": "coating_thickness_status",
        "condition_operator": "==",
        "condition_value": "low",
        "action_type": "recommend",
        "action_detail": "Additional Spray Required.",
    },
    {
        "name": "Coating Thickness High",
        "work": "*",
        "condition_field": "coating_thickness_status",
        "condition_operator": "==",
        "condition_value": "high",
        "action_type": "recommend",
        "action_detail": "Grinding Required. Supervisor Approval.",
    },
    {
        "name": "Torch Ignition Failed",
        "work": "*",
        "condition_field": "torch_ignition_ok",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "display",
        "action_detail": "Check Gas Supply. Check Oxygen. Check Fuel. Check Pressure. Retry. Notify Maintenance.",
    },
    {
        "name": "Incorrect Pressure",
        "work": "*",
        "condition_field": "pressure_ok",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "notify",
        "action_detail": "⚠ Incorrect Pressure detected. Adjust to specified parameter and notify supervisor.",
    },
    {
        "name": "Moisture in Blasting Gun",
        "work": "Blasting",
        "condition_field": "moisture_present",
        "condition_operator": "==",
        "condition_value": "true",
        "action_type": "notify",
        "action_detail": "Moisture detected in blasting gun. Inform Production/QA/Maintenance. Do not start blasting.",
    },
    {
        "name": "PPE Required",
        "work": "*",
        "condition_field": "ppe_confirmed",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "block",
        "action_detail": "⚠ PPE Required. Operator cannot continue without confirming required PPE.",
    },
{
        "name": "Pre-start Inspection Required",
        "work": "*",
        "condition_field": "pre_start_ok",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "block",
        "action_detail": "⚠ Machine Inspection Pending. Complete pre-start checks before proceeding.",
    },
    # ---- Inward Goods Rules ----
    {
        "name": "Inward - Supplier Not Verified",
        "work": "Inward",
        "condition_field": "supplier_verified",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "block",
        "action_detail": "⚠ Supplier/material not verified. Hold the lot and notify Procurement & QA before acceptance.",
    },
    {
        "name": "Inward - Documents Missing",
        "work": "Inward",
        "condition_field": "documents_verified",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "block",
        "action_detail": "⚠ Challan/Invoice/COA/MTC documents missing. Do not accept until documents are complete.",
    },
    {
        "name": "Inward - Quantity Mismatch",
        "work": "Inward",
        "condition_field": "quantity_mismatch",
        "condition_operator": "==",
        "condition_value": "true",
        "action_type": "notify",
        "action_detail": "⚠ Received quantity does not match challan/invoice. Notify store & supplier for reconciliation.",
    },
    {
        "name": "Inward - Surface Rust / Corrosion",
        "work": "Inward",
        "condition_field": "surface_rust",
        "condition_operator": "==",
        "condition_value": "true",
        "action_type": "recommend",
        "action_detail": "Surface rust/corrosion observed. Recommend cleaning/derusting or reject if beyond tolerance.",
    },
    {
        "name": "Inward - Material Dimension Check",
        "work": "Inward",
        "condition_field": "dimension_ok",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "block",
        "action_detail": "⚠ Incoming material dimensions out of tolerance. Quarantine and inform QA for disposition.",
    },
    {
        "name": "Inward - Packing Damaged",
        "work": "Inward",
        "condition_field": "packing_ok",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "notify",
        "action_detail": "⚠ Packing damaged during transit. Inspect contents thoroughly and record claim.",
    },
    # ---- Challan Rules ----
    {
        "name": "Challan - Number Missing",
        "work": "Challan",
        "condition_field": "challan_number",
        "condition_operator": "is_empty",
        "condition_value": "",
        "action_type": "block",
        "action_detail": "⚠ Challan number is missing. Entry cannot be processed without a valid challan number.",
    },
    {
        "name": "Challan - Format Invalid",
        "work": "Challan",
        "condition_field": "challan_number",
        "condition_operator": "regex",
        "condition_value": "[A-Za-z0-9]{3,}",
        "action_type": "notify",
        "action_detail": "Challan number format appears invalid. Confirm with the issuing party.",
    },
    {
        "name": "Challan - Weight Mismatch",
        "work": "Challan",
        "condition_field": "weight_mismatch",
        "condition_operator": "==",
        "condition_value": "true",
        "action_type": "notify",
        "action_detail": "⚠ Declared vs received weight mismatch. Notify logistics & supplier for reconciliation.",
    },
    {
        "name": "Challan - Quantity Mismatch",
        "work": "Challan",
        "condition_field": "quantity_mismatch",
        "condition_operator": "==",
        "condition_value": "true",
        "action_type": "block",
        "action_detail": "⚠ Quantity mismatch on challan. Halt processing until discrepancy is resolved.",
    },
    {
        "name": "Challan - Destination Mismatch",
        "work": "Challan",
        "condition_field": "destination_mismatch",
        "condition_operator": "==",
        "condition_value": "true",
        "action_type": "notify",
        "action_detail": "⚠ Challan destination does not match expected store. Confirm routing before acceptance.",
    },
    {
        "name": "Challan - Packing Condition",
        "work": "Challan",
        "condition_field": "packing_ok",
        "condition_operator": "==",
        "condition_value": "false",
        "action_type": "block",
        "action_detail": "⚠ Packing condition is damaged. Do not accept; record damage and notify QA.",
    },
]


class DecisionEngine:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    def get_rules(self) -> List[Dict]:
        """Load rules from DB if available, else fall back to defaults."""
        if self.db is not None:
            try:
                rules = self.db.query(DecisionRule).filter(DecisionRule.is_active == True).all()
                if rules:
                    return [
                        {
                            "name": r.name,
                            "work": r.work,
                            "condition_field": r.condition_field,
                            "condition_operator": r.condition_operator,
                            "condition_value": r.condition_value,
                            "action_type": r.action_type,
                            "action_detail": r.action_detail,
                        }
                        for r in rules
                    ]
            except Exception:
                pass
        return DEFAULT_RULES

    def evaluate(self, context: Dict) -> List[Dict]:
        """
        Evaluate all rules against the given context.
        Returns a list of triggered actions.
        """
        rules = self.get_rules()
        triggered = []
        work = str(context.get("work", "*"))

        for rule in rules:
            rule_work = rule.get("work", "*")
            if rule_work != "*" and work != rule_work:
                continue
            field = rule["condition_field"]
            op = rule["condition_operator"]
            expected = rule["condition_value"]
            if evaluate_condition(field, op, expected, context):
                triggered.append({
                    "rule": rule["name"],
                    "action_type": rule["action_type"],
                    "message": rule["action_detail"],
                })
        return triggered


decision_engine = DecisionEngine()
