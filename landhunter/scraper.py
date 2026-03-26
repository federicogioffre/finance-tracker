"""
Modulo di scraping per LandHunter.

Utilizza Playwright per estrarre annunci di terreni industriali/agricoli
da portali immobiliari italiani (Immobiliare.it).
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field, asdict
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser

from landhunter.config import ScrapingConfig, load_config

logger = logging.getLogger(__name__)


@dataclass
class LandListing:
    """Rappresenta un singolo annuncio di terreno."""
    title: str = ""
    price: Optional[float] = None
    area_sqm: Optional[float] = None
    location: str = ""
    comune: str = ""
    provincia: str = ""
    description: str = ""
    url: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: str = "immobiliare.it"
    raw_price: str = ""
    raw_area: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def price_per_sqm(self) -> Optional[float]:
        if self.price and self.area_sqm and self.area_sqm > 0:
            return round(self.price / self.area_sqm, 2)
        return None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["price_per_sqm"] = self.price_per_sqm
        return d


def parse_price(raw: str) -> Optional[float]:
    """Estrae il valore numerico da una stringa di prezzo (es. '€ 150.000')."""
    if not raw:
        return None
    cleaned = raw.replace("€", "").replace(".", "").replace(",", ".").strip()
    match = re.search(r"[\d]+(?:\.[\d]+)?", cleaned)
    if match:
        return float(match.group())
    return None


def parse_area(raw: str) -> Optional[float]:
    """Estrae la superficie in mq da una stringa (es. '10.000 m²')."""
    if not raw:
        return None
    cleaned = raw.replace(".", "").replace(",", ".").strip()
    match = re.search(r"([\d]+(?:\.[\d]+)?)\s*m", cleaned, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def extract_comune_provincia(location: str) -> tuple[str, str]:
    """
    Estrae comune e provincia da una stringa di localita'.
    Formato tipico: 'Comune (Provincia)' o 'Zona, Comune (XX)'
    """
    comune = ""
    provincia = ""

    prov_match = re.search(r"\(([A-Z]{2})\)", location)
    if prov_match:
        provincia = prov_match.group(1)

    cleaned = re.sub(r"\([^)]*\)", "", location).strip()
    parts = [p.strip() for p in cleaned.split(",")]
    if parts:
        comune = parts[-1] if len(parts) > 1 else parts[0]

    return comune.strip(), provincia.strip()


class ImmobiliareScraper:
    """Scraper per Immobiliare.it basato su Playwright."""

    def __init__(self, config: Optional[ScrapingConfig] = None):
        self.config = config or ScrapingConfig()
        self._browser: Optional[Browser] = None

    async def _launch_browser(self) -> Browser:
        """Avvia il browser Playwright."""
        pw = await async_playwright().start()
        browser = await pw.chromium.launch(headless=self.config.headless)
        logger.info("Browser Chromium avviato (headless=%s)", self.config.headless)
        return browser

    async def _create_page(self, browser: Browser) -> Page:
        """Crea una nuova pagina con user-agent personalizzato."""
        context = await browser.new_context(
            user_agent=self.config.user_agent,
            viewport={"width": 1920, "height": 1080},
            locale="it-IT",
        )
        page = await context.new_page()
        page.set_default_timeout(self.config.timeout_ms)
        return page

    def _build_search_url(self) -> str:
        """Costruisce l'URL di ricerca per terreni industriali in Piemonte."""
        base = f"{self.config.base_url}{self.config.search_path}"
        params = "&".join(
            f"{k}={v}" for k, v in self.config.query_params.items()
        )
        url = f"{base}?{params}" if params else base
        logger.info("URL di ricerca: %s", url)
        return url

    async def _extract_listings_from_page(self, page: Page) -> list[LandListing]:
        """Estrae gli annunci dalla pagina dei risultati."""
        listings: list[LandListing] = []

        # Attendi il caricamento degli annunci
        try:
            await page.wait_for_selector(
                "li.nd-list__item.in-realEstateResults__item",
                timeout=self.config.timeout_ms,
            )
        except Exception:
            logger.warning(
                "Selettore primario non trovato, provo selettore alternativo"
            )
            try:
                await page.wait_for_selector(
                    "[class*='RealEstateResults']",
                    timeout=self.config.timeout_ms,
                )
            except Exception:
                logger.error("Nessun risultato trovato nella pagina")
                return listings

        # Selettori per gli elementi degli annunci
        cards = await page.query_selector_all(
            "li.nd-list__item.in-realEstateResults__item"
        )

        if not cards:
            # Fallback: prova selettori alternativi
            cards = await page.query_selector_all(
                "[class*='in-realEstateResults'] > li"
            )

        logger.info("Trovati %d annunci nella pagina", len(cards))

        for i, card in enumerate(cards[: self.config.max_results]):
            try:
                listing = await self._parse_card(card)
                if listing:
                    listings.append(listing)
                    logger.debug("Annuncio %d estratto: %s", i + 1, listing.title)
            except Exception as e:
                logger.warning("Errore parsing annuncio %d: %s", i + 1, e)

        return listings

    async def _parse_card(self, card) -> Optional[LandListing]:
        """Parsa una singola card di annuncio."""
        listing = LandListing()

        # Titolo e URL
        title_el = await card.query_selector("a.in-card__title, a[class*='title']")
        if title_el:
            listing.title = (await title_el.inner_text()).strip()
            href = await title_el.get_attribute("href")
            if href:
                listing.url = (
                    href if href.startswith("http")
                    else f"{self.config.base_url}{href}"
                )

        # Prezzo
        price_el = await card.query_selector(
            "div.in-realEstateListCard__price, [class*='price']"
        )
        if price_el:
            listing.raw_price = (await price_el.inner_text()).strip()
            listing.price = parse_price(listing.raw_price)

        # Localita'
        location_el = await card.query_selector(
            "span.in-realEstateListCard__address, [class*='address']"
        )
        if location_el:
            listing.location = (await location_el.inner_text()).strip()
            listing.comune, listing.provincia = extract_comune_provincia(
                listing.location
            )

        # Superficie
        features = await card.query_selector_all(
            "li.in-realEstateListCard__feature, [class*='feature']"
        )
        for feat in features:
            text = (await feat.inner_text()).strip()
            if "m²" in text.lower() or "mq" in text.lower():
                listing.raw_area = text
                listing.area_sqm = parse_area(text)
                break

        # Descrizione breve (se presente nella card)
        desc_el = await card.query_selector(
            "p.in-realEstateListCard__descr, [class*='descr']"
        )
        if desc_el:
            listing.description = (await desc_el.inner_text()).strip()

        if not listing.title:
            return None

        return listing

    async def _extract_detail_description(
        self, page: Page, url: str
    ) -> str:
        """Naviga alla pagina di dettaglio e estrae la descrizione completa."""
        try:
            await page.goto(url, wait_until="domcontentloaded")
            desc_el = await page.query_selector(
                "div.in-readAll, [class*='description']"
            )
            if desc_el:
                return (await desc_el.inner_text()).strip()
        except Exception as e:
            logger.warning("Errore estrazione dettaglio da %s: %s", url, e)
        return ""

    async def scrape_listings(
        self, enrich_descriptions: bool = False
    ) -> list[LandListing]:
        """
        Esegue lo scraping completo e restituisce gli annunci trovati.

        Args:
            enrich_descriptions: Se True, naviga a ogni pagina di dettaglio
                per estrarre la descrizione completa.

        Returns:
            Lista di LandListing con i dati estratti.
        """
        browser = await self._launch_browser()
        try:
            page = await self._create_page(browser)
            url = self._build_search_url()

            logger.info("Navigazione a: %s", url)
            await page.goto(url, wait_until="domcontentloaded")

            # Gestisci eventuale cookie banner
            try:
                cookie_btn = await page.query_selector(
                    "button#didomi-notice-agree-button, "
                    "[class*='cookie'] button[class*='accept']"
                )
                if cookie_btn:
                    await cookie_btn.click()
                    logger.info("Cookie banner accettato")
                    await page.wait_for_timeout(1000)
            except Exception:
                pass

            listings = await self._extract_listings_from_page(page)

            # Arricchisci con descrizioni dettagliate (opzionale)
            if enrich_descriptions:
                detail_page = await self._create_page(browser)
                for listing in listings:
                    if listing.url:
                        desc = await self._extract_detail_description(
                            detail_page, listing.url
                        )
                        if desc:
                            listing.description = desc
                        await asyncio.sleep(1)  # Rate limiting
                await detail_page.close()

            logger.info(
                "Scraping completato: %d annunci estratti", len(listings)
            )
            return listings

        finally:
            await browser.close()
            logger.info("Browser chiuso")


async def run_scraper(
    config: Optional[ScrapingConfig] = None,
    enrich: bool = False,
) -> list[LandListing]:
    """Entry point per eseguire lo scraper."""
    scraper = ImmobiliareScraper(config)
    return await scraper.scrape_listings(enrich_descriptions=enrich)


def scrape_sync(
    config: Optional[ScrapingConfig] = None,
    enrich: bool = False,
) -> list[LandListing]:
    """Versione sincrona del runner dello scraper."""
    return asyncio.run(run_scraper(config, enrich))


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    results = scrape_sync(enrich=False)
    for i, r in enumerate(results, 1):
        print(f"\n{'='*60}")
        print(f"Annuncio #{i}")
        print(json.dumps(r.to_dict(), indent=2, ensure_ascii=False))
