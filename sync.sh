#!/bin/bash

set -euo pipefail
IFS=$'\n'

convertCore() {
	cp sqd-pipes/packages/core ./
	cd core
	rm -r .turbo
	cp ../package.json.core ./package.json
	echo "\nexport { BlockRef } from './portal-client'" >> ./src/index.ts
	npm install
	cd ..
}

installCore() {
	cd core
	npm run build
	npm link
	cd ..
}

convertStreams() {
	cp sqd-pipes/packages/streams ./
	cd streams
	rm -r .turbo
	cp ../package.json.streams ./package.json
	for file in `grep -lr '@sqd-pipes/core'`; do
		sed -i 's/@sqd-pipes\/core/@abernatskiy\/hybrid-pipes-core/g' "$file"
	done
# write code for removing them from the indexes before running this
#	for invalidStreamDir in `grep -lr PortalAbstractStream ./src/streams/ | cut -d '/' -f -5`; do
#		rm -r "$invalidStreamDir"
#	done
	npm install
	npm link @abernatskiy/hybrid-pipes-core
	cd ../
}

git clone -b new https://github.com/subsquid-labs/sqd-pipes &&
convertCore &&
installCore &&
convertStreams &&
rm -rf sqd-pipes