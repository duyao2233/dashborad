#!/bin/bash
set -euo pipefail

VM_DIR="/workspace/vm"
ISO_DIR="$VM_DIR/iso"
DISK="$VM_DIR/disks/windows.qcow2"
PIDFILE="$VM_DIR/config/qemu.pid"
LOGFILE="$VM_DIR/config/qemu.log"
VNC_PORT=5902

WIN_ISO="$ISO_DIR/WindowsServer2022_ZH-CN.iso"
VIRTIO_ISO="$ISO_DIR/virtio-win.iso"
AUTOUNATTEND_ISO="$ISO_DIR/autounattend.iso"

# Create disk if not exists
if [ ! -f "$DISK" ]; then
    qemu-img create -f qcow2 "$DISK" 80G
fi

# Build autounattend ISO with setup scripts
BUILD_DIR="$VM_DIR/config/autounattend-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/setup" "$BUILD_DIR/\$OEM\$/\$\$/Setup/Scripts"
cp "$VM_DIR/scripts/autounattend.xml" "$BUILD_DIR/autounattend.xml"
cp "$VM_DIR/scripts/post-install.ps1" "$BUILD_DIR/setup/post-install.ps1"
cp "$VM_DIR/scripts/SetupComplete.cmd" "$BUILD_DIR/\$OEM\$/\$\$/Setup/Scripts/SetupComplete.cmd"
genisoimage -o "$AUTOUNATTEND_ISO" -V "SETUP" -J -r "$BUILD_DIR"

# Kill existing VM if running
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    kill "$OLD_PID" 2>/dev/null || true
    sleep 2
fi

echo "Starting Windows Server VM..."
echo "VNC available on port $VNC_PORT (display :1)"

nohup qemu-system-x86_64 \
    -name "junke-clinic-demo" \
    -machine type=q35 \
    -cpu qemu64 \
    -smp 4 \
    -m 8192 \
    -drive file="$DISK",if=virtio,format=qcow2 \
    -drive file="$WIN_ISO",media=cdrom,readonly=on \
    -drive file="$VIRTIO_ISO",media=cdrom,readonly=on \
    -drive file="$AUTOUNATTEND_ISO",media=cdrom,readonly=on \
    -netdev user,id=net0,hostfwd=tcp::3389-:3389 \
    -device virtio-net-pci,netdev=net0 \
    -vnc :$((VNC_PORT - 5900)) \
    -boot d \
    -rtc base=localtime,clock=host \
    -device qemu-xhci \
    -device usb-tablet \
    > "$LOGFILE" 2>&1 &

echo $! > "$PIDFILE"
echo "QEMU started with PID $(cat $PIDFILE)"
echo "Log: $LOGFILE"
