from app.models.user import User


def get_current_user_profile(
    current_user: User
):
    return current_user