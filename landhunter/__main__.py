"""
Entry point per esecuzione diretta: python -m landhunter
"""

import argparse
import asyncio
import logging
import sys

from landhunter.config import load_config
from landhunter.agent import LandHunterAgent
from landhunter.scraper import scrape_sync
from landhunter.geocoder import Geocoder


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def cmd_scrape(args: argparse.Namespace) -> None:
    """Esegue solo il modulo di scraping."""
    import json

    config = load_config()
    config.scraping.max_results = args.max_results
    config.scraping.headless = not args.show_browser

    listings = scrape_sync(config.scraping, enrich=args.enrich)
    for i, listing in enumerate(listings, 1):
        print(f"\n{'='*60}")
        print(f"Annuncio #{i}")
        print(json.dumps(listing.to_dict(), indent=2, ensure_ascii=False))

    print(f"\nTotale: {len(listings)} annunci estratti")


def cmd_geocode(args: argparse.Namespace) -> None:
    """Esegue la geocodifica di un indirizzo."""
    geocoder = Geocoder()
    result = geocoder.geocode(args.address)
    if result:
        print(f"Indirizzo: {args.address}")
        print(f"Coordinate: ({result.latitude:.6f}, {result.longitude:.6f})")
        print(f"Nome completo: {result.display_name}")
        print(f"Confidenza: {result.confidence:.2f}")
    else:
        print(f"Indirizzo non trovato: {args.address}")
        sys.exit(1)


def cmd_run(args: argparse.Namespace) -> None:
    """Esegue il pipeline completo dell'agente."""
    config = load_config()
    config.scraping.max_results = args.max_results
    config.scraping.headless = not args.show_browser

    agent = LandHunterAgent(config)
    results = asyncio.run(agent.run(enrich_descriptions=args.enrich))

    deals = [r for r in results if r.deal_score and r.deal_score.is_deal]
    print(f"\n{'='*60}")
    print(f"Pipeline completato: {len(results)} analizzati, {len(deals)} deal")
    for r in deals:
        print(
            f"  -> {r.listing.title[:50]} | "
            f"Score: {r.deal_score.total_score}/10"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="landhunter",
        description=(
            "LandHunter - AI Agent per identificare terreni idonei "
            "per impianti FV/BESS in Italia"
        ),
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Output dettagliato"
    )

    subparsers = parser.add_subparsers(dest="command", help="Comando da eseguire")

    # Comando: scrape
    p_scrape = subparsers.add_parser(
        "scrape", help="Estrai annunci da portali immobiliari"
    )
    p_scrape.add_argument(
        "-n", "--max-results", type=int, default=10,
        help="Numero massimo di risultati (default: 10)",
    )
    p_scrape.add_argument(
        "--enrich", action="store_true",
        help="Arricchisci con descrizioni dettagliate",
    )
    p_scrape.add_argument(
        "--show-browser", action="store_true",
        help="Mostra il browser durante lo scraping",
    )

    # Comando: geocode
    p_geo = subparsers.add_parser("geocode", help="Geocodifica un indirizzo")
    p_geo.add_argument("address", help="Indirizzo da geocodificare")

    # Comando: run
    p_run = subparsers.add_parser("run", help="Esegui il pipeline completo")
    p_run.add_argument(
        "-n", "--max-results", type=int, default=10,
        help="Numero massimo di risultati (default: 10)",
    )
    p_run.add_argument(
        "--enrich", action="store_true",
        help="Arricchisci con descrizioni dettagliate",
    )
    p_run.add_argument(
        "--show-browser", action="store_true",
        help="Mostra il browser durante lo scraping",
    )

    args = parser.parse_args()
    setup_logging(args.verbose)

    if args.command == "scrape":
        cmd_scrape(args)
    elif args.command == "geocode":
        cmd_geocode(args)
    elif args.command == "run":
        cmd_run(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
