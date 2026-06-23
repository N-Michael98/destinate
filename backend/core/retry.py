"""
Tenacity Auto-Retry — G2G
Wrapper für API Calls die gelegentlich fehlschlagen.
"""

from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type, before_sleep_log,
)
import logging

logger = logging.getLogger(__name__)

# Standard Retry: 3 Versuche, exponentielles Warten (1s, 2s, 4s)
def api_retry(max_attempts: int = 3, min_wait: float = 1, max_wait: float = 8):
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )

# Verwendung: @api_retry() als Decorator über eine Funktion
