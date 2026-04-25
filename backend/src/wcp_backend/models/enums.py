from enum import StrEnum


class VerdictStatus(StrEnum):
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"


class CheckStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"


class CheckType(StrEnum):
    WAGE = "wage_check"
    OVERTIME = "overtime_check"
    FRINGE = "fringe_check"
    SIGNATURE = "signature_check"
    TOTAL = "total_check"
    CLASSIFICATION = "classification_check"
    DATA_INTEGRITY = "data_integrity_check"
    MINIMUM_WAGE = "minimum_wage_check"


class TrustBand(StrEnum):
    AUTO_APPROVE = "auto_approve"
    FLAG_FOR_REVIEW = "flag_for_review"
    REQUIRE_HUMAN_REVIEW = "require_human_review"


class JobStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class OverallStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    WARNINGS = "warnings"
