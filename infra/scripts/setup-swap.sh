#!/bin/bash
# Adds 2GB swap on Ubuntu EC2 (run once if Keycloak dies with "Killed" during startup).
set -euo pipefail

if swapon --show | grep -q '/swapfile'; then
  echo "Swap already enabled:"
  swapon --show
  free -h
  exit 0
fi

sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "Swap enabled:"
free -h
