"""
LandHunter Agent - Orchestratore principale.

Coordina tutti i moduli per eseguire il pipeline completo:
Scraping -> Geocodifica -> GIS -> LLM -> Scoring -> Notifiche.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from landhunter.config import load_config, LandHunterConfig
from landhunter.scraper import ImmobiliareScraper, LandListing
from landhunter.geocoder import Geocoder, GeocodingResult
from landhunter.gis_engine import GISEngine
from landhunter.llm_analyzer import LLMAnalyzer
from landhunter.scoring import ScoringEngine, DealScore
from landhunter.database import LandHunterDB
from landhunter.notifier import TelegramNotifier

logger = logging.getLogger(__name__)


@dataclass
class AnalyzedListing:
    """Annuncio completamente analizzato."""
    listing: LandListing
    geocoding: Optional[GeocodingResult] = None
    gis_match: Optional[object] = None  # SubstationMatch
    llm_analysis: Optional[object] = None  # LLMAnalysis
    deal_score: Optional[DealScore] = None
    listing_db_id: Optional[int] = None
    analysis_db_id: Optional[int] = None


class LandHunterAgent:
    """
    Agente AI per la ricerca di terreni idonei a impianti FV/BESS.

    Pipeline di esecuzione:
    1. Scraping annunci da portali immobiliari
    2. Geocodifica indirizzi mancanti di coordinate
    3. Filtro elettrico (distanza cabina primaria)
    4. Analisi semantica LLM della descrizione
    5. Scoring composito (elettrico + LLM + finanziario + CER)
    6. Persistenza su database
    7. Notifica Telegram per deal con score >= soglia
    """

    def __init__(self, config: Optional[LandHunterConfig] = None):
        self.config = config or load_config()
        self.scraper = ImmobiliareScraper(self.config.scraping)
        self.geocoder = Geocoder(self.config.geocoding)
        self.gis = GISEngine(self.config.gis)
        self.llm = LLMAnalyzer(self.config.llm)
        self.scoring = ScoringEngine(
            self.config.scoring, self.config.cer
        )
        self.db = LandHunterDB(self.config.database)
        self.notifier = TelegramNotifier(self.config.telegram)

    async def run(self, enrich_descriptions: bool = True) -> list[AnalyzedListing]:
        """
        Esegue il pipeline completo dell'agente.

        Args:
            enrich_descriptions: Se True, naviga alle pagine di dettaglio
                per descrizioni complete (piu' lento ma piu' accurato).

        Returns:
            Lista di AnalyzedListing con tutti i risultati.
        """
        logger.info("=" * 60)
        logger.info("LandHunter Agent - Avvio pipeline")
        logger.info("=" * 60)

        # Step 1: Scraping
        logger.info("[1/6] Scraping annunci...")
        listings = await self.scraper.scrape_listings(
            enrich_descriptions=enrich_descriptions
        )
        logger.info("Trovati %d annunci", len(listings))

        if not listings:
            logger.warning("Nessun annuncio trovato. Pipeline terminato.")
            return []

        # Step 2: Geocodifica
        logger.info("[2/6] Geocodifica indirizzi...")
        for listing in listings:
            if listing.latitude and listing.longitude:
                continue
            address = self._build_geocode_address(listing)
            result = await self.geocoder.geocode_async(address)
            if result:
                listing.latitude = result.latitude
                listing.longitude = result.longitude

        geocoded_count = sum(
            1 for l in listings if l.latitude and l.longitude
        )
        logger.info("Geocodificati %d/%d annunci", geocoded_count, len(listings))

        # Step 3-6: Analisi per ogni annuncio
        logger.info("[3-6/6] Analisi completa annunci...")
        analyzed: list[AnalyzedListing] = []

        # Carica dataset GIS e CER
        try:
            self.gis.load_substations()
        except FileNotFoundError:
            logger.warning(
                "Dataset cabine primarie non trovato. "
                "Score elettrico sara' 0 per tutti gli annunci."
            )

        self.scoring.load_cer_areas()

        for listing in listings:
            result = self._analyze_single(listing)
            analyzed.append(result)

        # Report
        deals = [a for a in analyzed if a.deal_score and a.deal_score.is_deal]
        discarded = [
            a for a in analyzed if a.deal_score and a.deal_score.is_discarded
        ]
        logger.info(
            "Analisi completata: %d deal, %d scartati, %d totali",
            len(deals), len(discarded), len(analyzed),
        )

        # Step 7: Notifiche
        logger.info("[7/7] Invio notifiche Telegram...")
        for a in deals:
            self._send_notification(a)

        # Riepilogo
        stats = self.db.get_stats()
        self.notifier.send_summary(stats)

        logger.info("=" * 60)
        logger.info("LandHunter Agent - Pipeline completato")
        logger.info("=" * 60)

        return analyzed

    def _build_geocode_address(self, listing: LandListing) -> str:
        """Costruisce l'indirizzo per la geocodifica."""
        parts = []
        if listing.location:
            parts.append(listing.location)
        elif listing.comune:
            parts.append(listing.comune)
            if listing.provincia:
                parts.append(listing.provincia)
        parts.append("Italia")
        return ", ".join(parts)

    def _analyze_single(self, listing: LandListing) -> AnalyzedListing:
        """Esegue l'analisi completa di un singolo annuncio."""
        result = AnalyzedListing(listing=listing)

        # Skip se gia' nel database
        if listing.url and self.db.listing_exists(listing.url):
            logger.debug("Annuncio gia' presente: %s", listing.url)
            return result

        # Salva nel database
        result.listing_db_id = self.db.insert_listing(listing.to_dict())

        # GIS: Distanza cabina primaria
        electrical_score = 0
        if listing.latitude and listing.longitude:
            gis_match = self.gis.find_nearest_substation(
                listing.latitude, listing.longitude
            )
            if gis_match:
                result.gis_match = gis_match
                electrical_score = gis_match.score

        # LLM: Analisi semantica
        llm_analysis = self.llm.analyze_description(
            description=listing.description,
            location=listing.location,
            area_sqm=listing.area_sqm or 0,
            price=listing.price or 0,
        )
        result.llm_analysis = llm_analysis
        llm_score = llm_analysis.suitability_score

        # Scoring composito
        deal_score = self.scoring.compute_deal_score(
            electrical_score=electrical_score,
            llm_score=llm_score,
            price=listing.price,
            area_sqm=listing.area_sqm,
            comune=listing.comune,
        )
        result.deal_score = deal_score

        # Salva analisi nel database
        analysis_data = {
            "listing_id": result.listing_db_id,
            "electrical_score": electrical_score,
            "nearest_substation": (
                result.gis_match.substation_name if result.gis_match else ""
            ),
            "substation_distance_m": (
                result.gis_match.distance_m if result.gis_match else None
            ),
            "llm_score": llm_score,
            "llm_land_type": llm_analysis.land_type,
            "llm_positive_signals": llm_analysis.positive_signals,
            "llm_red_flags": llm_analysis.red_flags,
            "financial_score": deal_score.financial_score,
            "cer_score": deal_score.cer_score,
            "total_score": deal_score.total_score,
            "is_deal": deal_score.is_deal,
            "is_discarded": deal_score.is_discarded,
            "discard_reason": deal_score.discard_reason,
        }
        result.analysis_db_id = self.db.insert_analysis(analysis_data)

        logger.info(
            "  %s -> %s",
            listing.title[:50],
            deal_score.summary(),
        )
        return result

    def _send_notification(self, analyzed: AnalyzedListing) -> None:
        """Invia notifica Telegram per un deal."""
        listing = analyzed.listing
        deal = analyzed.deal_score
        gis = analyzed.gis_match

        deal_data = {
            "title": listing.title,
            "location": listing.location,
            "comune": listing.comune,
            "provincia": listing.provincia,
            "price": listing.price,
            "area_sqm": listing.area_sqm,
            "price_per_sqm": listing.price_per_sqm,
            "url": listing.url,
            "latitude": listing.latitude,
            "longitude": listing.longitude,
            "total_score": deal.total_score if deal else 0,
            "electrical_score": deal.electrical_score if deal else 0,
            "llm_score": deal.llm_score if deal else 0,
            "financial_score": deal.financial_score if deal else 0,
            "cer_score": deal.cer_score if deal else 0,
            "nearest_substation": gis.substation_name if gis else "",
            "substation_distance_m": gis.distance_m if gis else None,
        }

        msg_id = self.notifier.send_deal_notification(deal_data)
        if msg_id and analyzed.listing_db_id and analyzed.analysis_db_id:
            self.db.record_notification(
                analyzed.listing_db_id, analyzed.analysis_db_id, msg_id
            )


def run_agent(config: Optional[LandHunterConfig] = None) -> list[AnalyzedListing]:
    """Entry point sincrono per eseguire l'agente."""
    agent = LandHunterAgent(config)
    return asyncio.run(agent.run())


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    results = run_agent()
    print(f"\nRisultati: {len(results)} annunci analizzati")
    for r in results:
        if r.deal_score:
            print(f"  {r.listing.title[:50]} -> {r.deal_score.summary()}")
