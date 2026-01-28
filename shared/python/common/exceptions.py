"""Custom exceptions and error handling"""

from fastapi import HTTPException, status


class AuthenticationError(HTTPException):
    """Authentication failed"""

    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthorizationError(HTTPException):
    """Authorization failed"""

    def __init__(self, detail: str = "Not authorized"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class NotFoundError(HTTPException):
    """Resource not found"""

    def __init__(self, detail: str = "Resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class ConflictError(HTTPException):
    """Resource conflict"""

    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )


class ValidationError(HTTPException):
    """Validation error"""

    def __init__(self, detail: str = "Validation failed"):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )
