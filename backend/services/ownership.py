"""Ownership helpers for per-account mobile data isolation."""

from core import db


def claim_unowned_resources(user_id: int) -> None:
    """Assign legacy resources to the first account that registers.

    Existing installations with accounts already in `web_users` are migrated
    to their oldest user in `core.db`; this handles fresh installs where the
    first user is created only after database initialization.
    """
    with db.connect() as conn:
        first_user = conn.execute("SELECT MIN(id) AS id FROM web_users").fetchone()
        if first_user is None or first_user["id"] != user_id:
            return
        conn.execute(
            "UPDATE accounts SET owner_user_id = ? WHERE owner_user_id IS NULL",
            (user_id,),
        )
        conn.execute(
            "UPDATE projects SET owner_user_id = ? WHERE owner_user_id IS NULL",
            (user_id,),
        )
