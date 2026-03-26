"""
Modulo GIS per LandHunter.

Calcola distanze spaziali tra terreni e cabine primarie elettriche
utilizzando GeoPandas e Shapely per operazioni geospaziali.
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

from landhunter.config import GISConfig

logger = logging.getLogger(__name__)


@dataclass
class SubstationMatch:
    """Risultato del match con la cabina primaria piu' vicina."""
    substation_name: str
    substation_id: str
    distance_m: float
    score: int
    substation_lat: float
    substation_lon: float
    operator: str = ""

    @property
    def is_viable(self) -> bool:
        return self.score > 0


class GISEngine:
    """
    Motore GIS per calcoli spaziali.
    Carica il dataset delle cabine primarie e calcola distanze euclidee.
    """

    def __init__(self, config: Optional[GISConfig] = None):
        self.config = config or GISConfig()
        self._substations_gdf: Optional[gpd.GeoDataFrame] = None

    def load_substations(self, filepath: Optional[str] = None) -> gpd.GeoDataFrame:
        """
        Carica il dataset delle cabine primarie da CSV o GeoJSON.

        Il CSV deve avere le colonne: id, name, latitude, longitude, operator.
        Il GeoJSON deve avere geometrie Point.

        Args:
            filepath: Percorso al file. Se None, usa il path dalla config.

        Returns:
            GeoDataFrame delle cabine primarie in CRS proiettato (UTM).
        """
        filepath = filepath or self.config.cabine_file
        path = Path(filepath)

        if not path.exists():
            raise FileNotFoundError(
                f"File cabine primarie non trovato: {filepath}"
            )

        if path.suffix == ".csv":
            df = pd.read_csv(filepath)
            geometry = [
                Point(row["longitude"], row["latitude"])
                for _, row in df.iterrows()
            ]
            gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
        elif path.suffix in (".geojson", ".json"):
            gdf = gpd.read_file(filepath)
            if gdf.crs is None:
                gdf = gdf.set_crs("EPSG:4326")
        else:
            raise ValueError(f"Formato file non supportato: {path.suffix}")

        # Proietta in UTM per calcoli metrici accurati
        gdf = gdf.to_crs(epsg=self.config.epsg_projected)
        self._substations_gdf = gdf

        logger.info(
            "Caricate %d cabine primarie da %s", len(gdf), filepath
        )
        return gdf

    def find_nearest_substation(
        self, lat: float, lon: float
    ) -> Optional[SubstationMatch]:
        """
        Trova la cabina primaria piu' vicina a un punto dato.

        Args:
            lat: Latitudine del terreno (WGS84).
            lon: Longitudine del terreno (WGS84).

        Returns:
            SubstationMatch con distanza e score, o None se dataset non caricato.
        """
        if self._substations_gdf is None:
            self.load_substations()

        if self._substations_gdf is None or self._substations_gdf.empty:
            logger.error("Dataset cabine primarie vuoto o non caricato")
            return None

        # Crea punto del terreno e proietta in UTM
        land_point = gpd.GeoSeries(
            [Point(lon, lat)], crs="EPSG:4326"
        ).to_crs(epsg=self.config.epsg_projected)[0]

        # Calcola distanze da tutte le cabine
        distances = self._substations_gdf.geometry.distance(land_point)
        nearest_idx = distances.idxmin()
        nearest_distance = distances[nearest_idx]
        nearest_row = self._substations_gdf.loc[nearest_idx]

        # Calcola score basato sulla distanza
        score = self._compute_distance_score(nearest_distance)

        # Recupera coordinate originali (WGS84)
        original_point = (
            self._substations_gdf.loc[[nearest_idx]]
            .to_crs("EPSG:4326")
            .geometry.iloc[0]
        )

        match = SubstationMatch(
            substation_name=str(nearest_row.get("name", "N/A")),
            substation_id=str(nearest_row.get("id", "N/A")),
            distance_m=round(nearest_distance, 1),
            score=score,
            substation_lat=original_point.y,
            substation_lon=original_point.x,
            operator=str(nearest_row.get("operator", "")),
        )

        logger.info(
            "Cabina piu' vicina a (%.4f, %.4f): %s a %.0fm (score=%d)",
            lat, lon, match.substation_name, match.distance_m, match.score,
        )
        return match

    def _compute_distance_score(self, distance_m: float) -> int:
        """
        Calcola il punteggio elettrico basato sulla distanza.

        Score 10: < 500m
        Score 5:  500m - 2km
        Score 0:  > 3km (scartato)
        Interpolazione lineare tra 2km e 3km -> score 1-4
        """
        if distance_m < self.config.threshold_near_m:
            return self.config.score_near  # 10
        elif distance_m < self.config.threshold_medium_m:
            return self.config.score_medium  # 5
        elif distance_m < self.config.threshold_discard_m:
            # Interpolazione lineare tra 2km (score 4) e 3km (score 1)
            ratio = (
                (self.config.threshold_discard_m - distance_m)
                / (self.config.threshold_discard_m - self.config.threshold_medium_m)
            )
            return max(1, int(ratio * 4))
        else:
            return 0  # Scartato

    def batch_find_nearest(
        self, coordinates: list[tuple[float, float]]
    ) -> list[Optional[SubstationMatch]]:
        """
        Trova la cabina primaria piu' vicina per una lista di coordinate.

        Args:
            coordinates: Lista di tuple (latitudine, longitudine).

        Returns:
            Lista di SubstationMatch (o None per coordinate invalide).
        """
        results = []
        for lat, lon in coordinates:
            try:
                match = self.find_nearest_substation(lat, lon)
                results.append(match)
            except Exception as e:
                logger.error(
                    "Errore calcolo distanza per (%.4f, %.4f): %s",
                    lat, lon, e,
                )
                results.append(None)
        return results


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    engine = GISEngine()

    # Test: Mongrando (BI) - coordinate approssimative
    test_coords = [
        (45.5156, 8.0075),   # Mongrando
        (45.1100, 7.6900),   # Torino area
        (44.8900, 8.6100),   # Alessandria area
    ]

    try:
        engine.load_substations()
        for lat, lon in test_coords:
            result = engine.find_nearest_substation(lat, lon)
            if result:
                print(
                    f"  ({lat}, {lon}) -> {result.substation_name} "
                    f"a {result.distance_m:.0f}m (score: {result.score})"
                )
    except FileNotFoundError:
        print("File cabine primarie non trovato. Creare il dataset prima.")
