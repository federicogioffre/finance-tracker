"""
Modulo di scoring composito per LandHunter.

Aggrega i punteggi dei vari moduli (GIS, LLM, Finanziario, CER)
in un unico score normalizzato per ogni terreno.
"""

import csv
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from landhunter.config import ScoringConfig, CERConfig

logger = logging.getLogger(__name__)


@dataclass
class DealScore:
    """Punteggio composito di un terreno."""
    # Score parziali (0-10)
    electrical_score: int = 0       # Distanza cabina primaria
    llm_score: int = 0              # Analisi semantica LLM
    financial_score: float = 0.0    # Prezzo/mq
    cer_score: float = 0.0          # Potenziale CER/Autoconsumo

    # Pesi per la media ponderata
    weights: dict = field(default_factory=lambda: {
        "electrical": 0.35,
        "llm": 0.25,
        "financial": 0.25,
        "cer": 0.15,
    })

    # Metadati
    is_discarded: bool = False
    discard_reason: str = ""

    @property
    def total_score(self) -> float:
        """Calcola lo score composito ponderato (0-10)."""
        if self.is_discarded:
            return 0.0
        w = self.weights
        total = (
            self.electrical_score * w["electrical"]
            + self.llm_score * w["llm"]
            + self.financial_score * w["financial"]
            + self.cer_score * w["cer"]
        )
        return round(total, 2)

    @property
    def is_deal(self) -> bool:
        """Verifica se il terreno e' un 'deal' (score >= soglia)."""
        return self.total_score >= 8.0

    def summary(self) -> str:
        if self.is_discarded:
            return f"SCARTATO: {self.discard_reason}"
        return (
            f"Score: {self.total_score}/10 "
            f"[Elettr: {self.electrical_score}, LLM: {self.llm_score}, "
            f"Fin: {self.financial_score:.1f}, CER: {self.cer_score:.1f}]"
        )


class ScoringEngine:
    """Motore di scoring composito."""

    def __init__(
        self,
        scoring_config: Optional[ScoringConfig] = None,
        cer_config: Optional[CERConfig] = None,
    ):
        self.scoring_config = scoring_config or ScoringConfig()
        self.cer_config = cer_config or CERConfig()
        self._cer_areas: Optional[dict[str, dict]] = None

    def compute_financial_score(
        self, price: Optional[float], area_sqm: Optional[float]
    ) -> float:
        """
        Calcola il punteggio finanziario basato sul prezzo/mq.

        Score 10: prezzo/mq <= 5 EUR
        Score 7:  prezzo/mq <= 10 EUR
        Score 5:  prezzo/mq <= 15 EUR (soglia)
        Score 3:  prezzo/mq <= 25 EUR
        Score 0:  prezzo/mq > 25 EUR o dati mancanti
        """
        if not price or not area_sqm or area_sqm <= 0:
            return 0.0

        price_per_sqm = price / area_sqm

        if price_per_sqm <= 5:
            return 10.0
        elif price_per_sqm <= 10:
            return 7.0
        elif price_per_sqm <= self.scoring_config.max_price_per_sqm:
            return 5.0
        elif price_per_sqm <= 25:
            return 3.0
        else:
            return 0.0

    def load_cer_areas(self, filepath: Optional[str] = None) -> dict[str, dict]:
        """
        Carica la lista delle aree CER/Autoconsumo Diffuso.

        Il CSV deve avere le colonne: area_code, comune, provincia, status.
        """
        filepath = filepath or self.cer_config.cer_areas_file
        path = Path(filepath)

        if not path.exists():
            logger.warning("File aree CER non trovato: %s", filepath)
            self._cer_areas = {}
            return {}

        areas: dict[str, dict] = {}
        with open(filepath, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row.get("area_code", "").strip()
                if code:
                    areas[code] = {
                        "comune": row.get("comune", ""),
                        "provincia": row.get("provincia", ""),
                        "status": row.get("status", "active"),
                    }

        self._cer_areas = areas
        logger.info("Caricate %d aree CER da %s", len(areas), filepath)
        return areas

    def check_cer_potential(self, comune: str) -> tuple[float, str]:
        """
        Verifica se un comune appartiene a un'area CER.

        Args:
            comune: Nome del comune.

        Returns:
            Tupla (score 0-10, codice_area o "").
        """
        if self._cer_areas is None:
            self.load_cer_areas()

        if not self._cer_areas:
            return 0.0, ""

        comune_lower = comune.lower().strip()
        for code, info in self._cer_areas.items():
            if info.get("comune", "").lower().strip() == comune_lower:
                if info.get("status", "") == "active":
                    logger.info(
                        "Comune %s in area CER %s (attiva)", comune, code
                    )
                    return 10.0, code
                else:
                    return 5.0, code

        return 0.0, ""

    def compute_deal_score(
        self,
        electrical_score: int,
        llm_score: int,
        price: Optional[float],
        area_sqm: Optional[float],
        comune: str = "",
    ) -> DealScore:
        """
        Calcola lo score composito per un terreno.

        Args:
            electrical_score: Score distanza cabina (0-10).
            llm_score: Score analisi semantica (0-10).
            price: Prezzo in EUR.
            area_sqm: Superficie in mq.
            comune: Nome del comune per check CER.

        Returns:
            DealScore con punteggio composito.
        """
        # Scarta se score elettrico e' 0 (troppo lontano)
        if electrical_score == 0:
            return DealScore(
                electrical_score=0,
                is_discarded=True,
                discard_reason="Distanza cabina primaria > 3km",
            )

        # Scarta se superficie troppo piccola
        if area_sqm and area_sqm < self.scoring_config.min_area_sqm:
            return DealScore(
                electrical_score=electrical_score,
                is_discarded=True,
                discard_reason=(
                    f"Superficie {area_sqm}mq < minimo "
                    f"{self.scoring_config.min_area_sqm}mq"
                ),
            )

        financial = self.compute_financial_score(price, area_sqm)
        cer_score, cer_code = self.check_cer_potential(comune)

        deal = DealScore(
            electrical_score=electrical_score,
            llm_score=llm_score,
            financial_score=financial,
            cer_score=cer_score,
        )

        logger.info("Deal score calcolato: %s", deal.summary())
        return deal


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    engine = ScoringEngine()

    # Test scoring
    score = engine.compute_deal_score(
        electrical_score=10,
        llm_score=8,
        price=100000,
        area_sqm=15000,
        comune="Mongrando",
    )
    print(f"  {score.summary()}")
    print(f"  E' un deal? {score.is_deal}")
