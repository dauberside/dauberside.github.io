# Custom n8n image with Python 3 and pandas
FROM n8nio/n8n:1.122.5

USER root

# Install Python 3 and pandas via Alpine packages
RUN apk add --no-cache \
    python3 \
    py3-pandas \
    && ln -sf python3 /usr/bin/python

USER node

# Default CMD from base image is preserved
