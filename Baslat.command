#!/bin/zsh

PROJECT_FOLDER="${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js ve npm bulunamadı. Node.js 22 veya daha yeni bir sürüm kurun."
  echo "https://nodejs.org/"
  read -r "?Kapatmak için Enter tuşuna basın."
  exit 1
fi

cd "$PROJECT_FOLDER" || exit 1

if [[ ! -d node_modules ]]; then
  echo "Paketler hazırlanıyor..."
  if ! npm ci --ignore-scripts; then
    echo "Paketler kurulamadı. En olası neden: kütüphane GitHub Packages'tan geliyor ve bir token istiyor."
    echo "~/.npmrc dosyasında şu satır olmalı: //npm.pkg.github.com/:_authToken=ghp_... (read:packages yetkili classic token, < > işaretleri olmadan)"
    read -r "?Kapatmak için Enter tuşuna basın."
    exit 1
  fi
fi

echo "Map başlatılıyor..."
echo "Tarayıcı adresi: http://localhost:3008/"
echo "Durdurmak için Control + C tuşlarına basın."
echo

npm run dev
