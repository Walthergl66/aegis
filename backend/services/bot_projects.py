"""Acceso del bot a proyectos sin propietario de la app móvil.

Las cuentas de Telegram y de la app son identidades distintas. Hasta que haya
un vínculo explícito entre ellas, el bot no debe leer proyectos propiedad de un
usuario móvil, aunque el usuario de Telegram tenga rol admin.
"""

from core import db
from services import projects as projects_srv


def list_active() -> list[dict]:
    rows = db.fetch_all(
        f"{projects_srv._base_select()} "
        "WHERE p.owner_user_id IS NULL AND p.activo = 1 ORDER BY p.slug"
    )
    return [projects_srv._dict(row) for row in rows]


def get_active_by_slug(slug: str) -> dict | None:
    row = db.fetch_one(
        "SELECT id FROM projects "
        "WHERE slug = ? AND owner_user_id IS NULL AND activo = 1",
        (slug,),
    )
    return get_active_by_id(row["id"]) if row else None


def get_active_by_id(project_id: int, *, include_secret: bool = False) -> dict | None:
    """Carga un proyecto solo mientras siga sin propietario móvil."""
    row = db.fetch_one(
        f"{projects_srv._base_select()} "
        "WHERE p.id = ? AND p.owner_user_id IS NULL AND p.activo = 1",
        (project_id,),
    )
    return projects_srv._dict(row, include_secret=include_secret)


def is_unowned(project_id: int) -> bool:
    return db.fetch_one(
        "SELECT 1 FROM projects WHERE id = ? AND owner_user_id IS NULL",
        (project_id,),
    ) is not None
