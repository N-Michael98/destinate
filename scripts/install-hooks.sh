#!/usr/bin/env bash
# Installiert den Pre-Commit-Hook. Einmal ausführen:
#   bash scripts/install-hooks.sh
#
# Der Hook läuft vor jedem `git commit` die Regressionsprüfung (rund 2,5 s) und
# bricht den Commit ab, wenn ein Befund vorliegt.
#
# Bewusst OHNE das Werkzeug `pre-commit` aus PyPI: ein nativer Git-Hook braucht
# keine Installation, keine zusätzliche Abhängigkeit und kann jederzeit mit
# einem einzigen `rm` wieder entfernt werden.
#
# Notausgang, falls der Hook je im Weg steht:
#   git commit --no-verify        (einmalig umgehen)
#   rm .git/hooks/pre-commit      (dauerhaft entfernen)
set -e

WURZEL="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$WURZEL/.git/hooks/pre-commit"

if [ ! -d "$WURZEL/.git" ]; then
  echo "Kein Git-Repository gefunden unter $WURZEL"
  exit 1
fi

cat > "$HOOK" <<'HOOKENDE'
#!/usr/bin/env bash
# Automatisch erzeugt von scripts/install-hooks.sh
# Umgehen: git commit --no-verify   |   Entfernen: rm .git/hooks/pre-commit
WURZEL="$(git rev-parse --show-toplevel)"

if ! command -v node >/dev/null 2>&1; then
  echo "[pre-commit] node nicht gefunden — Prüfung übersprungen."
  exit 0
fi

node "$WURZEL/scripts/checks/run-all.js"
ERGEBNIS=$?

if [ $ERGEBNIS -ne 0 ]; then
  echo ""
  echo "  Commit abgebrochen: die Regressionsprüfung meldet Befunde."
  echo "  Erst beheben, dann erneut committen."
  echo "  Nur wenn du sicher bist: git commit --no-verify"
  echo ""
  exit 1
fi
exit 0
HOOKENDE

chmod +x "$HOOK"
echo "Pre-Commit-Hook installiert: $HOOK"
echo "Test:  bash $HOOK"
