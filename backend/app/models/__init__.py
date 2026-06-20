"""Import every model here so that `Base.metadata` is fully populated.

Alembic's autogenerate and `create_all` both rely on the models being
imported; this single import point guarantees that.
"""
from .asset import Asset
from .board import Board
from .edge import Edge
from .folder import Folder
from .invite import InviteCode
from .logs import ActivityLog, ErrorLog, RequestLog
from .node import Node
from .share import Share
from .user import User

__all__ = [
    "ActivityLog",
    "Asset",
    "Board",
    "Edge",
    "ErrorLog",
    "Folder",
    "InviteCode",
    "Node",
    "RequestLog",
    "Share",
    "User",
]
