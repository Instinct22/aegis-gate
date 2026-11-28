FROM python:3.12-alpine

WORKDIR /app
COPY server.py billing.py tariffs.html /app/

ENV CABINET_HOST=0.0.0.0
ENV CABINET_PORT=8766
ENV CABINET_DATA=/data
ENV MASTER_BASE=https://master.aegis-gate.ru

EXPOSE 8766
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8766/api/health')"

CMD ["python", "-u", "server.py"]
