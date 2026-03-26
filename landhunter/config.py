"""
Configurazione centralizzata per LandHunter.
Carica variabili d'ambiente e definisce costanti di scoring.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


@dataclass
class ScrapingConfig:
    """Configurazione per il modulo di scraping."""
    base_url: str = "https://www.immobiliare.it"
    search_path: str = "/vendita-terreni/piemonte/"
    query_params: dict = field(default_factory=lambda: {
        "tipologia": "terreno-industriale",
    })
    max_results: int = 10
    headless: bool = True
    timeout_ms: int = 30_000
    user_agent: str = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )


@dataclass
class GeocodingConfig:
    """Configurazione per il geocoder."""
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    user_agent: str = "LandHunter/0.1 (research-project)"
    rate_limit_seconds: float = 1.1  # Nominatim richiede >= 1s tra richieste
    country_code: str = "it"


@dataclass
class GISConfig:
    """Configurazione per il motore GIS - soglie distanza cabine primarie."""
    cabine_file: str = str(DATA_DIR / "cabine_primarie.csv")
    score_near: int = 10       # < 500m
    score_medium: int = 5      # 500m - 2km
    threshold_near_m: float = 500.0
    threshold_medium_m: float = 2000.0
    threshold_discard_m: float = 3000.0
    epsg_projected: int = 32632  # UTM zone 32N (Italia Nord)


@dataclass
class LLMConfig:
    """Configurazione per l'analisi semantica con Gemini."""
    api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    model: str = "gemini-1.5-pro"
    temperature: float = 0.2
    positive_keywords: list = field(default_factory=lambda: [
        "industriale", "zona d", "ex cava", "area degradata",
        "capannone dismesso", "zona artigianale", "area produttiva",
        "terreno pianeggiante", "zona pip",
    ])
    red_flags: list = field(default_factory=lambda: [
        "bosco", "vincolo paesaggistico", "pendenza elevata",
        "zona protetta", "parco naturale", "area sic",
        "vincolo idrogeologico", "zona esondabile",
    ])


@dataclass
class ScoringConfig:
    """Configurazione per il punteggio finanziario."""
    max_price_per_sqm: float = 15.0  # EUR/mq soglia
    min_area_sqm: float = 5000.0     # Superficie minima utile
    deal_threshold: float = 8.0       # Score minimo per notifica


@dataclass
class TelegramConfig:
    """Configurazione per le notifiche Telegram."""
    bot_token: str = field(default_factory=lambda: os.getenv("TELEGRAM_BOT_TOKEN", ""))
    chat_id: str = field(default_factory=lambda: os.getenv("TELEGRAM_CHAT_ID", ""))
    gmaps_base: str = "https://www.google.com/maps/search/?api=1&query="


@dataclass
class DatabaseConfig:
    """Configurazione per il database SQLite/SpatiaLite."""
    db_path: str = str(DATA_DIR / "landhunter.db")
    spatialite_extension: str = "mod_spatialite"


@dataclass
class CERConfig:
    """Configurazione per le Comunita' Energetiche Rinnovabili."""
    cer_areas_file: str = str(DATA_DIR / "cer_areas.csv")
    # Codice area di test per Mongrando
    test_area_code: str = "AC001E01322"


@dataclass
class LandHunterConfig:
    """Configurazione globale che aggrega tutti i sotto-moduli."""
    scraping: ScrapingConfig = field(default_factory=ScrapingConfig)
    geocoding: GeocodingConfig = field(default_factory=GeocodingConfig)
    gis: GISConfig = field(default_factory=GISConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    scoring: ScoringConfig = field(default_factory=ScoringConfig)
    telegram: TelegramConfig = field(default_factory=TelegramConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    cer: CERConfig = field(default_factory=CERConfig)


def load_config() -> LandHunterConfig:
    """Carica e restituisce la configurazione globale."""
    return LandHunterConfig()
