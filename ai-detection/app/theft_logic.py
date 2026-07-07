"""
Машина состояний кражи на трек (перенос из прототипа ../shopguard/Yolo/yolo.py).

Правило: человек пробыл у полки >= shelf_dwell_seconds ("взял товар"),
затем находится в зоне выхода >= exit_confirm_seconds → подозрение на кражу.
Кулдаун ограничивает повторные алерты по одной камере.
Треки, не обновлявшиеся дольше max_person_lost_seconds, сбрасываются.
"""
from dataclasses import dataclass


@dataclass
class _TrackState:
    shelf_enter: float | None = None
    was_at_shelf: bool = False
    exit_enter: float | None = None
    in_exit_prev: bool = False
    alerted: bool = False
    last_seen: float = 0.0


@dataclass
class Signals:
    theft: bool = False
    took_product: bool = False  # достиг порога у полки (взял товар)
    entered_exit: bool = False  # вошёл в зону выхода


@dataclass
class Behavior:
    shelf_dwell_seconds: float
    exit_confirm_seconds: float
    max_person_lost_seconds: float

    @classmethod
    def from_config(cls, b: dict) -> "Behavior":
        return cls(
            shelf_dwell_seconds=float(b["shelfDwellSeconds"]),
            exit_confirm_seconds=float(b["exitConfirmSeconds"]),
            max_person_lost_seconds=float(b["maxPersonLostSeconds"]),
        )


class TheftDetector:
    def __init__(self, behavior: Behavior, cooldown_seconds: float):
        self.behavior = behavior
        self.cooldown = cooldown_seconds
        self._tracks: dict[int, _TrackState] = {}
        self._last_alert: float = 0.0

    def update(
        self, track_id: int, in_shelf: bool, in_exit: bool, now: float
    ) -> Signals:
        """Обновляет состояние трека и возвращает сигналы событий."""
        st = self._tracks.get(track_id)
        if st is None:
            st = _TrackState()
            self._tracks[track_id] = st
        st.last_seen = now
        sig = Signals()

        # У полки
        if in_shelf:
            if st.shelf_enter is None:
                st.shelf_enter = now
            if (
                not st.was_at_shelf
                and now - st.shelf_enter >= self.behavior.shelf_dwell_seconds
            ):
                st.was_at_shelf = True
                sig.took_product = True  # переход: взял товар
        else:
            st.shelf_enter = None

        # Вход в зону выхода (переход False→True)
        if in_exit and not st.in_exit_prev:
            sig.entered_exit = True
        st.in_exit_prev = in_exit

        # У выхода после полки → кража
        if st.was_at_shelf and in_exit:
            if st.exit_enter is None:
                st.exit_enter = now
            if (
                now - st.exit_enter >= self.behavior.exit_confirm_seconds
                and not st.alerted
                and now - self._last_alert >= self.cooldown
            ):
                self._last_alert = now
                st.alerted = True
                sig.theft = True
        elif not in_exit:
            st.exit_enter = None

        return sig

    def prune(self, now: float) -> None:
        """Убирает треки, потерянные дольше max_person_lost_seconds."""
        limit = self.behavior.max_person_lost_seconds
        lost = [
            tid
            for tid, st in self._tracks.items()
            if now - st.last_seen > limit
        ]
        for tid in lost:
            del self._tracks[tid]
