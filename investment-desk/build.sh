#!/usr/bin/env bash
# Wraps app.html (the page body published as a Claude artifact) into index.html,
# a complete document you can open in any browser to use an OpenRouter or OpenAI key.
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  cat app.html
  printf '%s\n' '</body></html>'
} > index.html
echo "Built index.html"
