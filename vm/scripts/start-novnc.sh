#!/bin/bash
set -euo pipefail

VNC_PORT=5902
NOVNC_PORT=6080
PIDFILE="/workspace/vm/config/novnc.pid"

if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
fi

echo "Starting noVNC on port $NOVNC_PORT -> VNC localhost:$VNC_PORT"
nohup websockify --web=/usr/share/novnc/ "$NOVNC_PORT" "localhost:$VNC_PORT" \
    > /workspace/vm/config/novnc.log 2>&1 &
echo $! > "$PIDFILE"
echo "noVNC PID: $(cat $PIDFILE)"
