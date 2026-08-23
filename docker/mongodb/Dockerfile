FROM mongo:latest

# Local-only replica-set internal authentication key.
# A fresh key is generated whenever this image is built.
RUN umask 177 \
  && head -c 756 /dev/urandom | base64 | head -c 756 > /etc/mongodb-keyfile \
  && chown mongodb:mongodb /etc/mongodb-keyfile \
  && chmod 400 /etc/mongodb-keyfile
