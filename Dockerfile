FROM docker/sandbox-templates:codex
USER root
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_25.x | bash - && \
    apt-get install -y nodejs
USER agent
