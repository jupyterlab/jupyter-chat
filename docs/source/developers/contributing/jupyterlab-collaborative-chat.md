# Collaborative chat

The `jupyterlab-collaborative-chat` extension adds collaborative chats to jupyterlab.

## Development installation

Installing this extension in development mode requires an environment with *python* and
*nodejs*.

```bash
# In the following commands, 'mamba' can be replaced with 'conda'
mamba create -n jupyter-chat python nodejs
mamba activate jupyter-chat
```

The following commands install the extension in development mode:

```bash
# Install the extension
./scripts/install.sh collaborative

# Symlink the assets
jupyter labextension develop --overwrite packages/jupyterlab-collaborative-chat
```

To uninstall it, run:

```bash
pip uninstall jupyterlab-collaborative-chat
```

## Building the assets

Changes in typescript sources of `@jupyter/chat` or `jupyterlab-collaborative-chat` must
be built again to be available in the jupyterlab.

```bash
jlpm build:collaborative
```

## Testing locally the extension

`jupyterlab-collaborative-chat` package has unit tests and integration tests.

### Unit tests

There are a few unit tests in *packages/jupyterlab-collaborative-chat/src/\_\_tests\_\_*.

They make use of [jest](https://jestjs.io/).

The following commands run them:

```bash
cd ./packages/jupyterlab-collaborative-chat
jlpm test
```

### Integration tests

The integration tests are located in *packages/jupyterlab-collaborative-chat/ui-tests*.

They make use of [playwright](https://playwright.dev/).

The following commands run them:

```bash
cd ./packages/jupyterlab-collaborative-chat/ui-tests

# Install the tests dependencies
jlpm install

# Install the tests browser
jlpm playwright install

# Run the tests
jlpm test
```
