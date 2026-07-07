"""Геометрия зон: точка-в-полигоне и классификация SHELF/EXIT."""
from typing import Sequence

Polygon = Sequence[Sequence[float]]
Bbox = Sequence[float]  # x1, y1, x2, y2


def point_in_polygon(x: float, y: float, polygon: Polygon) -> bool:
    """Ray casting: точка внутри полигона (полигон — список [x, y])."""
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][0], polygon[i][1]
        xj, yj = polygon[j][0], polygon[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def bbox_center(bbox: Bbox) -> tuple[float, float]:
    x1, y1, x2, y2 = bbox
    return (x1 + x2) / 2, (y1 + y2) / 2


class ZoneMap:
    """Полигоны полок/выхода одной камеры + проверка попадания центра бокса."""

    def __init__(self, zones: list[dict]):
        self.shelves = [z["polygon"] for z in zones if z["type"] == "SHELF"]
        self.exits = [z["polygon"] for z in zones if z["type"] == "EXIT"]

    def in_shelf(self, bbox: Bbox) -> bool:
        cx, cy = bbox_center(bbox)
        return any(point_in_polygon(cx, cy, p) for p in self.shelves)

    def in_exit(self, bbox: Bbox) -> bool:
        cx, cy = bbox_center(bbox)
        return any(point_in_polygon(cx, cy, p) for p in self.exits)
