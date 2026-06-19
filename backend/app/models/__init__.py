"""Import every model here so that `Base.metadata` is fully populated.

Alembic's autogenerate and `create_all` both rely on the models being
imported; this single import point guarantees that.
"""
from .asset import Asset
from .board import Board
from .edge import Edge
from .invite import InviteCode
from .logs import ActivityLog, ErrorLog, RequestLog
from .node import Node
from .user import User

__all__ = [
    "ActivityLog",
    "Asset",
    "Board",
    "Edge",
    "ErrorLog",
    "InviteCode",
    "Node",
    "RequestLog",
    "User",
]
