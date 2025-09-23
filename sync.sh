#!/bin/bash

set -euo pipefail
IFS=$'\n'

convertCore() {
	cp -r sqd-pipes/packages/core ./
	cd core
	rm -fr .turbo
	cp ../package.json.core ./package.json
	npm install
	cd ..
}

installCore() {
	cd core
	npm run build
	npm uninstall -g @abernatskiy/hybrid-pipes-core
	npm link
	cd ..
}

convertStreams() {
	cp -r sqd-pipes/packages/streams ./
	cd streams
	rm -fr .turbo
	cp ../package.json.streams ./package.json
	for file in `grep -lr '@sqd-pipes/core'`; do
		sed -i 's/@sqd-pipes\/core/@abernatskiy\/hybrid-pipes-core/g' "$file"
	done
	for invalidStreamDir in `grep -lr PortalAbstractStream ./src/streams/ | cut -d '/' -f -5`; do
		rm -fr "$invalidStreamDir"
	done
	npm install
	npm uninstall -g @abernatskiy/hybrid-pipes-core
	npm link @abernatskiy/hybrid-pipes-core
	cd ../
}

rm -fr core streams &&
git clone -b fix/misc https://github.com/subsquid-labs/sqd-pipes &&
convertCore &&
installCore &&
convertStreams &&
rm -fr sqd-pipes