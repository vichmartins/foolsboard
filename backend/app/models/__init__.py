"""Import every model here so that `Base.metadata` is fully populated.

Alembic's autogenerate and `create_all` both rely on the models being
imported; this single import point guarantees that.
"""
from .asset import Asset
from .board import Board
from .edge import Edge
from .invite import InviteCode
from .node import Node
from .user import User

__all__ = ["Asset", "Board", "Edge", "InviteCode", "Node", "User"]
