"""
Modulo database per LandHunter.

Gestisce la persistenza dei dati con SQLite.
Supporta SpatiaLite per query geospaziali avanzate.
"""

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from landhunter.config import DatabaseConfig

logger = logging.getLogger(__name__)


class LandHunterDB:
    """Gestore database SQLite per LandHunter."""

    def __init__(self, config: Optional[DatabaseConfig] = None):
        self.config = config or DatabaseConfig()
        self._ensure_dir()
        self._init_db()

    def _ensure_dir(self) -> None:
        Path(self.config.db_path).parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def _connection(self):
        conn = sqlite3.connect(self.config.db_path)
        conn.row_factory = sqlite3.Row

        # Tenta di caricare SpatiaLite (opzionale)
        try:
            conn.enable_load_extension(True)
            conn.load_extension(self.config.spatialite_extension)
            logger.debug("SpatiaLite caricato")
        except Exception:
            logger.debug("SpatiaLite non disponibile, uso SQLite standard")

        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Crea le tabelle se non esistono."""
        with self._connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS listings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    price REAL,
                    area_sqm REAL,
                    price_per_sqm REAL,
                    location TEXT,
                    comune TEXT,
                    provincia TEXT,
                    description TEXT,
                    url TEXT UNIQUE,
                    latitude REAL,
                    longitude REAL,
                    source TEXT DEFAULT 'immobiliare.it',
                    raw_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS analyses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    listing_id INTEGER NOT NULL,
                    electrical_score INTEGER DEFAULT 0,
                    nearest_substation TEXT,
                    substation_distance_m REAL,
                    llm_score INTEGER DEFAULT 0,
                    llm_land_type TEXT,
                    llm_positive_signals TEXT,
                    llm_red_flags TEXT,
                    financial_score REAL DEFAULT 0,
                    cer_score REAL DEFAULT 0,
                    cer_area_code TEXT,
                    total_score REAL DEFAULT 0,
                    is_deal BOOLEAN DEFAULT 0,
                    is_discarded BOOLEAN DEFAULT 0,
                    discard_reason TEXT,
                    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (listing_id) REFERENCES listings(id)
                );

                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    listing_id INTEGER NOT NULL,
                    analysis_id INTEGER NOT NULL,
                    channel TEXT DEFAULT 'telegram',
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    message_id TEXT,
                    FOREIGN KEY (listing_id) REFERENCES listings(id),
                    FOREIGN KEY (analysis_id) REFERENCES analyses(id)
                );

                CREATE INDEX IF NOT EXISTS idx_listings_url ON listings(url);
                CREATE INDEX IF NOT EXISTS idx_listings_comune ON listings(comune);
                CREATE INDEX IF NOT EXISTS idx_analyses_total_score
                    ON analyses(total_score);
                CREATE INDEX IF NOT EXISTS idx_analyses_is_deal ON analyses(is_deal);
            """)
        logger.info("Database inizializzato: %s", self.config.db_path)

    def insert_listing(self, listing_data: dict) -> int:
        """Inserisce un annuncio nel database. Restituisce l'ID."""
        with self._connection() as conn:
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO listings
                    (title, price, area_sqm, price_per_sqm, location,
                     comune, provincia, description, url, latitude,
                     longitude, source, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    listing_data.get("title", ""),
                    listing_data.get("price"),
                    listing_data.get("area_sqm"),
                    listing_data.get("price_per_sqm"),
                    listing_data.get("location", ""),
                    listing_data.get("comune", ""),
                    listing_data.get("provincia", ""),
                    listing_data.get("description", ""),
                    listing_data.get("url", ""),
                    listing_data.get("latitude"),
                    listing_data.get("longitude"),
                    listing_data.get("source", "immobiliare.it"),
                    json.dumps(listing_data.get("extra", {})),
                ),
            )
            return cursor.lastrowid

    def insert_analysis(self, analysis_data: dict) -> int:
        """Inserisce un'analisi nel database. Restituisce l'ID."""
        with self._connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO analyses
                    (listing_id, electrical_score, nearest_substation,
                     substation_distance_m, llm_score, llm_land_type,
                     llm_positive_signals, llm_red_flags, financial_score,
                     cer_score, cer_area_code, total_score, is_deal,
                     is_discarded, discard_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    analysis_data["listing_id"],
                    analysis_data.get("electrical_score", 0),
                    analysis_data.get("nearest_substation", ""),
                    analysis_data.get("substation_distance_m"),
                    analysis_data.get("llm_score", 0),
                    analysis_data.get("llm_land_type", ""),
                    json.dumps(analysis_data.get("llm_positive_signals", [])),
                    json.dumps(analysis_data.get("llm_red_flags", [])),
                    analysis_data.get("financial_score", 0),
                    analysis_data.get("cer_score", 0),
                    analysis_data.get("cer_area_code", ""),
                    analysis_data.get("total_score", 0),
                    analysis_data.get("is_deal", False),
                    analysis_data.get("is_discarded", False),
                    analysis_data.get("discard_reason", ""),
                ),
            )
            return cursor.lastrowid

    def get_deals(self, min_score: float = 8.0) -> list[dict]:
        """Restituisce i deal con score >= soglia."""
        with self._connection() as conn:
            rows = conn.execute(
                """
                SELECT l.*, a.total_score, a.electrical_score,
                       a.llm_score, a.financial_score, a.cer_score,
                       a.nearest_substation, a.substation_distance_m,
                       a.is_discarded, a.discard_reason
                FROM listings l
                JOIN analyses a ON a.listing_id = l.id
                WHERE a.is_deal = 1 AND a.total_score >= ?
                ORDER BY a.total_score DESC
                """,
                (min_score,),
            ).fetchall()
            return [dict(r) for r in rows]

    def listing_exists(self, url: str) -> bool:
        """Verifica se un annuncio esiste gia' nel database."""
        with self._connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM listings WHERE url = ?", (url,)
            ).fetchone()
            return row is not None

    def record_notification(
        self, listing_id: int, analysis_id: int, message_id: str = ""
    ) -> None:
        """Registra l'invio di una notifica."""
        with self._connection() as conn:
            conn.execute(
                """
                INSERT INTO notifications
                    (listing_id, analysis_id, channel, message_id)
                VALUES (?, ?, 'telegram', ?)
                """,
                (listing_id, analysis_id, message_id),
            )

    def get_stats(self) -> dict:
        """Restituisce statistiche del database."""
        with self._connection() as conn:
            stats = {}
            stats["total_listings"] = conn.execute(
                "SELECT COUNT(*) FROM listings"
            ).fetchone()[0]
            stats["total_analyses"] = conn.execute(
                "SELECT COUNT(*) FROM analyses"
            ).fetchone()[0]
            stats["total_deals"] = conn.execute(
                "SELECT COUNT(*) FROM analyses WHERE is_deal = 1"
            ).fetchone()[0]
            stats["total_discarded"] = conn.execute(
                "SELECT COUNT(*) FROM analyses WHERE is_discarded = 1"
            ).fetchone()[0]
            stats["avg_score"] = conn.execute(
                "SELECT AVG(total_score) FROM analyses WHERE NOT is_discarded"
            ).fetchone()[0] or 0
            return stats
