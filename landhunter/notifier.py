"""
Modulo di notifiche Telegram per LandHunter.

Invia notifiche sui deal ad alto score tramite un Telegram Bot,
includendo link Google Maps e riepilogo del punteggio.
"""

import logging
from typing import Optional

import httpx

from landhunter.config import TelegramConfig

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Notificatore via Telegram Bot API."""

    API_URL = "https://api.telegram.org/bot{token}/{method}"

    def __init__(self, config: Optional[TelegramConfig] = None):
        self.config = config or TelegramConfig()

    def _build_url(self, method: str) -> str:
        return self.API_URL.format(token=self.config.bot_token, method=method)

    def _gmaps_link(self, lat: float, lon: float) -> str:
        """Genera un link Google Maps per le coordinate."""
        return f"{self.config.gmaps_base}{lat},{lon}"

    def format_deal_message(self, deal: dict) -> str:
        """
        Formatta un messaggio Telegram per un deal.

        Args:
            deal: Dizionario con i dati del deal (listing + analysis).

        Returns:
            Messaggio formattato in Markdown.
        """
        title = deal.get("title", "N/D")
        location = deal.get("location", "N/D")
        comune = deal.get("comune", "")
        provincia = deal.get("provincia", "")
        price = deal.get("price")
        area = deal.get("area_sqm")
        price_sqm = deal.get("price_per_sqm")
        url = deal.get("url", "")
        lat = deal.get("latitude")
        lon = deal.get("longitude")
        total_score = deal.get("total_score", 0)
        electrical = deal.get("electrical_score", 0)
        llm_score = deal.get("llm_score", 0)
        financial = deal.get("financial_score", 0)
        cer = deal.get("cer_score", 0)
        substation = deal.get("nearest_substation", "")
        sub_dist = deal.get("substation_distance_m")

        # Header con emoji score
        score_emoji = "🔥" if total_score >= 9 else "⭐" if total_score >= 8 else "📊"
        msg = f"{score_emoji} *DEAL TROVATO - Score: {total_score}/10*\n\n"

        # Info terreno
        msg += f"📍 *{title}*\n"
        msg += f"📌 {location}"
        if comune and provincia:
            msg += f" ({comune}, {provincia})"
        msg += "\n"

        if price:
            msg += f"💰 Prezzo: €{price:,.0f}\n"
        if area:
            msg += f"📐 Superficie: {area:,.0f} mq\n"
        if price_sqm:
            msg += f"📊 Prezzo/mq: €{price_sqm:.2f}\n"

        # Scores dettagliati
        msg += f"\n*Punteggi:*\n"
        msg += f"  ⚡ Elettrico: {electrical}/10"
        if substation:
            msg += f" ({substation}"
            if sub_dist:
                msg += f", {sub_dist:.0f}m"
            msg += ")"
        msg += "\n"
        msg += f"  🤖 LLM: {llm_score}/10\n"
        msg += f"  💶 Finanziario: {financial}/10\n"
        msg += f"  🔋 CER: {cer}/10\n"

        # Links
        msg += "\n*Link:*\n"
        if url:
            msg += f"🏠 [Annuncio]({url})\n"
        if lat and lon:
            gmaps = self._gmaps_link(lat, lon)
            msg += f"🗺 [Google Maps]({gmaps})\n"

        return msg

    def send_message(
        self, text: str, parse_mode: str = "Markdown"
    ) -> Optional[str]:
        """
        Invia un messaggio tramite il bot Telegram.

        Args:
            text: Testo del messaggio.
            parse_mode: Formato del testo (Markdown/HTML).

        Returns:
            message_id se inviato con successo, None altrimenti.
        """
        if not self.config.bot_token or not self.config.chat_id:
            logger.warning(
                "Telegram non configurato: imposta TELEGRAM_BOT_TOKEN e "
                "TELEGRAM_CHAT_ID nelle variabili d'ambiente"
            )
            return None

        payload = {
            "chat_id": self.config.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": False,
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.post(
                    self._build_url("sendMessage"),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

            if data.get("ok"):
                msg_id = str(data["result"]["message_id"])
                logger.info("Messaggio Telegram inviato: %s", msg_id)
                return msg_id
            else:
                logger.error(
                    "Errore risposta Telegram: %s",
                    data.get("description", "unknown"),
                )
                return None

        except httpx.HTTPStatusError as e:
            logger.error("Errore HTTP Telegram: %s", e)
        except httpx.RequestError as e:
            logger.error("Errore rete Telegram: %s", e)

        return None

    def send_deal_notification(self, deal: dict) -> Optional[str]:
        """Formatta e invia la notifica di un deal."""
        message = self.format_deal_message(deal)
        return self.send_message(message)

    def send_batch_deals(self, deals: list[dict]) -> list[Optional[str]]:
        """Invia notifiche per una lista di deal."""
        results = []
        for deal in deals:
            msg_id = self.send_deal_notification(deal)
            results.append(msg_id)
        logger.info(
            "Notifiche inviate: %d/%d",
            sum(1 for r in results if r),
            len(deals),
        )
        return results

    def send_summary(self, stats: dict) -> Optional[str]:
        """Invia un messaggio di riepilogo dell'esecuzione."""
        msg = "📋 *LandHunter - Riepilogo Esecuzione*\n\n"
        msg += f"📊 Annunci analizzati: {stats.get('total_listings', 0)}\n"
        msg += f"✅ Deal trovati: {stats.get('total_deals', 0)}\n"
        msg += f"❌ Scartati: {stats.get('total_discarded', 0)}\n"
        msg += f"📈 Score medio: {stats.get('avg_score', 0):.1f}/10\n"
        return self.send_message(msg)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    notifier = TelegramNotifier()

    # Test formattazione (non invia senza token)
    test_deal = {
        "title": "Terreno Industriale Settimo Torinese",
        "location": "Settimo Torinese",
        "comune": "Settimo Torinese",
        "provincia": "TO",
        "price": 150000,
        "area_sqm": 12000,
        "price_per_sqm": 12.5,
        "url": "https://www.immobiliare.it/annunci/12345/",
        "latitude": 45.1350,
        "longitude": 7.7700,
        "total_score": 8.5,
        "electrical_score": 10,
        "llm_score": 7,
        "financial_score": 7,
        "cer_score": 10,
        "nearest_substation": "CP Settimo",
        "substation_distance_m": 350,
    }

    message = notifier.format_deal_message(test_deal)
    print(message)
