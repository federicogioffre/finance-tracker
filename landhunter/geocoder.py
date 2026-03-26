"""
Modulo di geocodifica per LandHunter.

Converte indirizzi/localita' in coordinate geografiche (lat, lon)
utilizzando Nominatim (OpenStreetMap) come servizio di geocodifica.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional

import httpx

from landhunter.config import GeocodingConfig

logger = logging.getLogger(__name__)


@dataclass
class GeocodingResult:
    """Risultato di una geocodifica."""
    latitude: float
    longitude: float
    display_name: str
    place_id: int
    osm_type: str = ""
    osm_id: int = 0
    confidence: float = 0.0  # 0-1 basato su importance di Nominatim

    @property
    def coords(self) -> tuple[float, float]:
        return (self.latitude, self.longitude)

    def __str__(self) -> str:
        return f"{self.display_name} ({self.latitude:.6f}, {self.longitude:.6f})"


class Geocoder:
    """
    Geocoder basato su Nominatim (OpenStreetMap).
    Rispetta il rate limiting di 1 richiesta/secondo.
    """

    def __init__(self, config: Optional[GeocodingConfig] = None):
        self.config = config or GeocodingConfig()
        self._last_request_time: float = 0.0

    def _rate_limit(self) -> None:
        """Applica il rate limiting tra le richieste."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.config.rate_limit_seconds:
            wait = self.config.rate_limit_seconds - elapsed
            logger.debug("Rate limiting: attesa %.2f secondi", wait)
            time.sleep(wait)
        self._last_request_time = time.time()

    async def _async_rate_limit(self) -> None:
        """Versione asincrona del rate limiting."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.config.rate_limit_seconds:
            wait = self.config.rate_limit_seconds - elapsed
            logger.debug("Rate limiting: attesa %.2f secondi", wait)
            await asyncio.sleep(wait)
        self._last_request_time = time.time()

    def geocode(self, address: str) -> Optional[GeocodingResult]:
        """
        Geocodifica sincrona di un indirizzo.

        Args:
            address: Indirizzo o localita' da geocodificare
                     (es. "Via Roma 1, Torino, Italia").

        Returns:
            GeocodingResult con le coordinate, o None se non trovato.
        """
        self._rate_limit()

        params = {
            "q": address,
            "format": "json",
            "addressdetails": 1,
            "limit": 1,
            "countrycodes": self.config.country_code,
        }

        headers = {"User-Agent": self.config.user_agent}

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(
                    self.config.nominatim_url,
                    params=params,
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()

            if not data:
                logger.warning("Nessun risultato per: %s", address)
                return None

            result = data[0]
            geocoded = GeocodingResult(
                latitude=float(result["lat"]),
                longitude=float(result["lon"]),
                display_name=result.get("display_name", ""),
                place_id=int(result.get("place_id", 0)),
                osm_type=result.get("osm_type", ""),
                osm_id=int(result.get("osm_id", 0)),
                confidence=float(result.get("importance", 0.0)),
            )

            logger.info("Geocodificato '%s' -> %s", address, geocoded)
            return geocoded

        except httpx.HTTPStatusError as e:
            logger.error("Errore HTTP geocodifica '%s': %s", address, e)
        except httpx.RequestError as e:
            logger.error("Errore rete geocodifica '%s': %s", address, e)
        except (KeyError, ValueError, IndexError) as e:
            logger.error("Errore parsing risposta per '%s': %s", address, e)

        return None

    async def geocode_async(self, address: str) -> Optional[GeocodingResult]:
        """
        Geocodifica asincrona di un indirizzo.

        Args:
            address: Indirizzo o localita' da geocodificare.

        Returns:
            GeocodingResult con le coordinate, o None se non trovato.
        """
        await self._async_rate_limit()

        params = {
            "q": address,
            "format": "json",
            "addressdetails": 1,
            "limit": 1,
            "countrycodes": self.config.country_code,
        }

        headers = {"User-Agent": self.config.user_agent}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.config.nominatim_url,
                    params=params,
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()

            if not data:
                logger.warning("Nessun risultato per: %s", address)
                return None

            result = data[0]
            geocoded = GeocodingResult(
                latitude=float(result["lat"]),
                longitude=float(result["lon"]),
                display_name=result.get("display_name", ""),
                place_id=int(result.get("place_id", 0)),
                osm_type=result.get("osm_type", ""),
                osm_id=int(result.get("osm_id", 0)),
                confidence=float(result.get("importance", 0.0)),
            )

            logger.info("Geocodificato '%s' -> %s", address, geocoded)
            return geocoded

        except httpx.HTTPStatusError as e:
            logger.error("Errore HTTP geocodifica '%s': %s", address, e)
        except httpx.RequestError as e:
            logger.error("Errore rete geocodifica '%s': %s", address, e)
        except (KeyError, ValueError, IndexError) as e:
            logger.error("Errore parsing risposta per '%s': %s", address, e)

        return None

    def geocode_batch(
        self, addresses: list[str]
    ) -> dict[str, Optional[GeocodingResult]]:
        """
        Geocodifica sincrona di una lista di indirizzi.

        Args:
            addresses: Lista di indirizzi da geocodificare.

        Returns:
            Dizionario {indirizzo: GeocodingResult o None}.
        """
        results: dict[str, Optional[GeocodingResult]] = {}
        for addr in addresses:
            results[addr] = self.geocode(addr)
        logger.info(
            "Batch geocodifica completata: %d/%d riuscite",
            sum(1 for v in results.values() if v is not None),
            len(addresses),
        )
        return results

    async def geocode_batch_async(
        self, addresses: list[str]
    ) -> dict[str, Optional[GeocodingResult]]:
        """
        Geocodifica asincrona di una lista di indirizzi.
        Le richieste sono sequenziali per rispettare il rate limiting.

        Args:
            addresses: Lista di indirizzi da geocodificare.

        Returns:
            Dizionario {indirizzo: GeocodingResult o None}.
        """
        results: dict[str, Optional[GeocodingResult]] = {}
        for addr in addresses:
            results[addr] = await self.geocode_async(addr)
        logger.info(
            "Batch geocodifica completata: %d/%d riuscite",
            sum(1 for v in results.values() if v is not None),
            len(addresses),
        )
        return results


def geocode_address(address: str) -> Optional[GeocodingResult]:
    """Funzione di utilita' per geocodifica singola."""
    geocoder = Geocoder()
    return geocoder.geocode(address)


def geocode_listing_address(
    comune: str, provincia: str = "", extra: str = ""
) -> Optional[GeocodingResult]:
    """
    Geocodifica un indirizzo composto da comune, provincia e info extra.

    Args:
        comune: Nome del comune (es. "Mongrando").
        provincia: Sigla provincia (es. "BI").
        extra: Informazioni aggiuntive (via, zona, ecc.).

    Returns:
        GeocodingResult o None.
    """
    parts = [p for p in [extra, comune, provincia, "Italia"] if p]
    full_address = ", ".join(parts)
    return geocode_address(full_address)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Test geocodifica
    test_addresses = [
        "Mongrando, BI, Italia",
        "Settimo Torinese, TO, Italia",
        "Tortona, AL, Italia",
        "Novara, NO, Italia",
        "Casale Monferrato, AL, Italia",
    ]

    geocoder = Geocoder()
    results = geocoder.geocode_batch(test_addresses)

    for addr, result in results.items():
        if result:
            print(f"  {addr} -> ({result.latitude:.6f}, {result.longitude:.6f})")
        else:
            print(f"  {addr} -> NON TROVATO")
