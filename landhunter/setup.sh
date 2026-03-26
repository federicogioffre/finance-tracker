#!/usr/bin/env bash
# ============================================================
# LandHunter - Script di Setup Rapido
# ============================================================
# Uso: cd landhunter && bash setup.sh
# ============================================================

set -e

echo "=========================================="
echo " LandHunter - Setup"
echo "=========================================="

# 1. Crea virtual environment
if [ ! -d ".venv" ]; then
    echo "[1/4] Creazione virtual environment..."
    python3 -m venv .venv
else
    echo "[1/4] Virtual environment gia' presente."
fi

# Attiva venv
source .venv/bin/activate

# 2. Installa dipendenze Python
echo "[2/4] Installazione dipendenze Python..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

# 3. Installa browser Playwright
echo "[3/4] Installazione browser Playwright (Chromium)..."
playwright install chromium

# 4. Crea file .env se non esiste
if [ ! -f ".env" ]; then
    echo "[4/4] Creazione file .env da template..."
    cp .env.example .env
    echo ""
    echo "=========================================="
    echo " AZIONE RICHIESTA: Configura le API keys"
    echo "=========================================="
    echo ""
    echo " Apri il file landhunter/.env e inserisci:"
    echo ""
    echo " 1. GEMINI_API_KEY"
    echo "    -> https://aistudio.google.com/app/apikey"
    echo ""
    echo " 2. TELEGRAM_BOT_TOKEN"
    echo "    -> Crea un bot con @BotFather su Telegram"
    echo ""
    echo " 3. TELEGRAM_CHAT_ID"
    echo "    -> Vedi istruzioni nel file .env"
    echo ""
else
    echo "[4/4] File .env gia' presente."
fi

echo ""
echo "=========================================="
echo " Setup completato!"
echo "=========================================="
echo ""
echo " Per attivare l'ambiente:"
echo "   source .venv/bin/activate"
echo ""
echo " Comandi disponibili:"
echo "   python -m landhunter scrape -n 10       # Solo scraping"
echo "   python -m landhunter geocode 'Torino'   # Geocodifica"
echo "   python -m landhunter run -n 10          # Pipeline completo"
echo ""
