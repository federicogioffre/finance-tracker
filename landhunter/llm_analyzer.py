"""
Modulo di analisi semantica con LLM per LandHunter.

Integra l'API Gemini 1.5 Pro per analizzare le descrizioni degli annunci
e classificare l'idoneita' del terreno per impianti FV/BESS.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from landhunter.config import LLMConfig

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """\
Sei un esperto analista immobiliare specializzato in terreni per impianti \
fotovoltaici e sistemi di accumulo energetico (BESS) in Italia.

Analizza la seguente descrizione di un terreno e restituisci un JSON con:

1. "land_type": classificazione del terreno (industriale/agricolo/misto/residenziale/altro)
2. "zoning": zona urbanistica se menzionata (es. "D1", "D2", "E1", "agricolo")
3. "positive_signals": lista di segnali positivi per FV/BESS
4. "red_flags": lista di segnali negativi/vincoli
5. "terrain_flat": booleano, se il terreno sembra pianeggiante
6. "existing_structures": descrizione di strutture esistenti (capannoni, ecc.)
7. "access_road": booleano, se c'e' accesso stradale
8. "suitability_score": punteggio 1-10 di idoneita' per FV/BESS
9. "reasoning": breve motivazione del punteggio

DESCRIZIONE TERRENO:
{description}

LOCALITA': {location}
SUPERFICIE: {area_sqm} mq
PREZZO: {price} EUR

Rispondi SOLO con il JSON valido, senza testo aggiuntivo.
"""


@dataclass
class LLMAnalysis:
    """Risultato dell'analisi LLM di un terreno."""
    land_type: str = "sconosciuto"
    zoning: str = ""
    positive_signals: list[str] = field(default_factory=list)
    red_flags: list[str] = field(default_factory=list)
    terrain_flat: bool = False
    existing_structures: str = ""
    access_road: bool = False
    suitability_score: int = 0
    reasoning: str = ""
    raw_response: str = ""

    @property
    def has_red_flags(self) -> bool:
        return len(self.red_flags) > 0

    @property
    def is_suitable(self) -> bool:
        return self.suitability_score >= 5 and not self.has_critical_flags

    @property
    def has_critical_flags(self) -> bool:
        critical = {"bosco", "vincolo paesaggistico", "zona protetta", "parco naturale"}
        return any(
            any(c in flag.lower() for c in critical)
            for flag in self.red_flags
        )


class LLMAnalyzer:
    """Analizzatore semantico basato su Gemini 1.5 Pro."""

    GEMINI_API_URL = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "{model}:generateContent"
    )

    def __init__(self, config: Optional[LLMConfig] = None):
        self.config = config or LLMConfig()

    def _build_url(self) -> str:
        return self.GEMINI_API_URL.format(model=self.config.model)

    def analyze_description(
        self,
        description: str,
        location: str = "",
        area_sqm: float = 0,
        price: float = 0,
    ) -> LLMAnalysis:
        """
        Analizza la descrizione di un terreno con Gemini.

        Args:
            description: Testo della descrizione dell'annuncio.
            location: Localita' del terreno.
            area_sqm: Superficie in mq.
            price: Prezzo in EUR.

        Returns:
            LLMAnalysis con classificazione e score.
        """
        if not self.config.api_key:
            logger.warning(
                "GEMINI_API_KEY non configurata, uso analisi keyword-based"
            )
            return self._keyword_fallback(description)

        prompt = ANALYSIS_PROMPT.format(
            description=description,
            location=location,
            area_sqm=area_sqm or "N/D",
            price=price or "N/D",
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": 1024,
            },
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    self._build_url(),
                    params={"key": self.config.api_key},
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

            # Estrai testo dalla risposta Gemini
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            return self._parse_response(text)

        except httpx.HTTPStatusError as e:
            logger.error("Errore API Gemini: %s", e)
        except Exception as e:
            logger.error("Errore analisi LLM: %s", e)

        return self._keyword_fallback(description)

    def _parse_response(self, text: str) -> LLMAnalysis:
        """Parsa la risposta JSON di Gemini in un LLMAnalysis."""
        # Rimuovi eventuali markdown code fences
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1])

        try:
            data = json.loads(cleaned)
            return LLMAnalysis(
                land_type=data.get("land_type", "sconosciuto"),
                zoning=data.get("zoning", ""),
                positive_signals=data.get("positive_signals", []),
                red_flags=data.get("red_flags", []),
                terrain_flat=data.get("terrain_flat", False),
                existing_structures=data.get("existing_structures", ""),
                access_road=data.get("access_road", False),
                suitability_score=int(data.get("suitability_score", 0)),
                reasoning=data.get("reasoning", ""),
                raw_response=text,
            )
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("Errore parsing risposta LLM: %s", e)
            return LLMAnalysis(raw_response=text)

    def _keyword_fallback(self, description: str) -> LLMAnalysis:
        """
        Analisi basata su keyword quando l'LLM non e' disponibile.
        Fallback deterministico per funzionare senza API key.
        """
        desc_lower = description.lower()

        positive = [
            kw for kw in self.config.positive_keywords
            if kw in desc_lower
        ]
        reds = [
            kw for kw in self.config.red_flags
            if kw in desc_lower
        ]

        # Determina tipo terreno
        land_type = "sconosciuto"
        if any(k in desc_lower for k in ["industriale", "zona d", "artigianale"]):
            land_type = "industriale"
        elif any(k in desc_lower for k in ["agricolo", "coltiv", "zona e"]):
            land_type = "agricolo"

        # Calcola score semplificato
        score = 5  # Base
        score += min(len(positive) * 1, 3)
        score -= min(len(reds) * 2, 4)
        score = max(1, min(10, score))

        # Controlla pianura
        flat = any(
            k in desc_lower
            for k in ["pianeggiante", "piano", "pianura", "livellato"]
        )

        return LLMAnalysis(
            land_type=land_type,
            positive_signals=positive,
            red_flags=reds,
            terrain_flat=flat,
            suitability_score=score,
            reasoning="Analisi keyword-based (LLM non disponibile)",
        )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    analyzer = LLMAnalyzer()

    test_desc = (
        "Terreno industriale pianeggiante in zona D1, ex area artigianale "
        "con accesso diretto da strada provinciale. Superficie totale 15.000 mq, "
        "completamente recintato. Ideale per attivita' produttive o logistica."
    )

    result = analyzer.analyze_description(
        description=test_desc,
        location="Settimo Torinese (TO)",
        area_sqm=15000,
        price=200000,
    )

    print(f"  Tipo: {result.land_type}")
    print(f"  Score: {result.suitability_score}/10")
    print(f"  Positivi: {result.positive_signals}")
    print(f"  Red flags: {result.red_flags}")
    print(f"  Reasoning: {result.reasoning}")
