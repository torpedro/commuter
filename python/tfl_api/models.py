from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TflModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class StopPoint(TflModel):
    id: str
    naptan_id: str | None = Field(default=None, alias="naptanId")
    common_name: str | None = Field(default=None, alias="commonName")
    stop_letter: str | None = Field(default=None, alias="stopLetter")
    stop_type: str | None = Field(default=None, alias="stopType")
    modes: list[str] = Field(default_factory=list)
    children: list["StopPoint"] = Field(default_factory=list)
    lat: float | None = None
    lon: float | None = None

    @property
    def best_id(self) -> str:
        return self.naptan_id or self.id

    @property
    def is_bus_stop(self) -> bool:
        modes = {mode.lower() for mode in self.modes}
        stop_type = (self.stop_type or "").lower()
        return "bus" in modes or "bus" in stop_type

    def display_name(self, fallback: str | None = None) -> str:
        name = self.common_name or fallback or self.best_id
        if self.stop_letter and self.stop_letter.strip() not in name:
            return f"{name} stop {self.stop_letter}"
        return name


class ArrivalPrediction(TflModel):
    id: str | None = None
    line_name: str = Field(alias="lineName")
    destination_name: str = Field(default="Unknown destination", alias="destinationName")
    station_name: str = Field(default="Unknown stop", alias="stationName")
    time_to_station: int = Field(default=0, alias="timeToStation")
