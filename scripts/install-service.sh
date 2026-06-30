#!/bin/bash
# Install TechYzer as a systemd service
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/techyzer.service"

echo "Installing TechYzer service..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/techyzer.service
sudo systemctl daemon-reload
sudo systemctl enable techyzer
sudo systemctl start techyzer
echo "Done! Service status:"
sudo systemctl status techyzer --no-pager
echo ""
echo "Commands:"
echo "  sudo systemctl status techyzer"
echo "  sudo systemctl restart techyzer"
echo "  sudo journalctl -u techyzer -f"
