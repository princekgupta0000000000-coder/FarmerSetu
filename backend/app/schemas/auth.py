from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    mobile: str = Field(min_length=10, max_length=15)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    state: str = Field(min_length=2, max_length=100)
    district: str = Field(min_length=2, max_length=100)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        digits = value.strip().replace(" ", "")
        if digits.startswith("+"):
            digits = digits[1:]
        if not digits.isdigit() or not 10 <= len(digits) <= 15:
            raise ValueError("Enter a valid mobile number")
        return digits


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    full_name: str
    mobile: str
    email: EmailStr | None = None
    state: str
    district: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
