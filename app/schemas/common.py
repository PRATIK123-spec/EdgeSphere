from typing import Annotated

from pydantic import AfterValidator, StringConstraints


def _reject_control_characters(value: str) -> str:
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise ValueError("must not contain control characters")
    return value


def BoundedText(max_length: int):
    """Trimmed, non-empty, length-limited single-line text."""
    return Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length),
        AfterValidator(_reject_control_characters),
    ]


# Header carrying the total number of rows matching a paginated list query.
TOTAL_COUNT_HEADER = "X-Total-Count"
