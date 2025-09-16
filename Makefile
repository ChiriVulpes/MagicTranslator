# Install all dependencies
install:
	@. ~/.nvm/nvm.sh && nvm install
	@. ~/.nvm/nvm.sh && nvm use
	@npm ci
	@cd script/window && npm ci

# Runs the electron applicaiton
run:
	@npm run rebuild && npm run app

# Automatically launches electron & relaunches on file change
run-dev:
	@npm run watch

# Builds (bundles) the electron applicaiton
build-all:
	@\
	MAGIC_TRANSLATOR_BUILD_MACOS=true \
	MAGIC_TRANSLATOR_BUILD_LINUX=true \
	MAGIC_TRANSLATOR_BUILD_WINDOWS=true \
	npm run bundle

# Builds (bundles) the electron applicaiton for macos
build-mac:
	@\
	MAGIC_TRANSLATOR_BUILD_MACOS=true \
	npm run bundle

# Builds (bundles) the electron applicaiton for linux
build-linux:
	@\
	MAGIC_TRANSLATOR_BUILD_LINUX=true \
	npm run bundle

# Builds (bundles) the electron applicaiton for windows
build-windows:
	@\
	MAGIC_TRANSLATOR_BUILD_WINDOWS=true \
	npm run bundle

clean:
	@npm run clean