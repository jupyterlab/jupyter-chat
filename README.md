# jupyter_chat

[![Github Actions Status](https://github.com/QuantStack/jupyter-chat/workflows/Build/badge.svg)](https://github.com/QuantStack/jupyter-chat/actions/workflows/build.yml)

A chat extension for Jupyterlab

This package is composed of a Python package named `jupyter_chat`
for the server side and a NPM package named `@jupyter/chat`
for the frontend side.

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the package, execute:

```bash
pip install jupyter_chat
```

## Uninstall

To remove the package, execute:

```bash
pip uninstall jupyter_chat
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyter_chat directory
# Install package in development mode
pip install -e ".[test]"
# Rebuild Typescript source after making changes
jlpm build
```

By default, the `jlpm build` command generates the source maps for this package to make it easier to debug using the browser dev tools.

### Development uninstall

```bash
pip uninstall jupyter_chat
```

### Testing the package

#### Server tests

This extension is using [Pytest](https://docs.pytest.org/) for Python code testing.

Install test dependencies (needed only once):

```sh
pip install -e ".[test]"
```

To execute them, run:

```sh
pytest -vv -r ap --cov jupyter_chat
```

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
