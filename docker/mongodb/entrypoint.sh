#!/bin/bash
set -Eeuo pipefail

keyfile_path=/data/configdb/mongodb-keyfile

# Replica sets with authorization require an internal member-authentication key.
# Store it in a named volume so container recreation does not rotate the key.
if [[ ! -s "$keyfile_path" ]]; then
  umask 177
  head -c 512 /dev/urandom | base64 > "$keyfile_path"
fi

chown mongodb:mongodb "$keyfile_path"
chmod 400 "$keyfile_path"

exec /usr/local/bin/docker-entrypoint.sh "$@"
