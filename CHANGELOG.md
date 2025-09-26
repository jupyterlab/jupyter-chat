# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## 0.18.1

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.18.0...6db821627f81a304e3a08daa0bded3f20df07648))

### Bugs fixed

- Fix the main input height [#284](https://github.com/jupyterlab/jupyter-chat/pull/284) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-09-25&to=2025-09-26&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-09-25..2025-09-26&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-09-25..2025-09-26&type=Issues)

<!-- <END NEW CHANGELOG ENTRY> -->

## 0.18.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.17.0...e99b0b174f290a369e61e42b074949bb497d089e))

### Enhancements made

- Move the input toolbar below the input prompt [#278](https://github.com/jupyterlab/jupyter-chat/pull/278) ([@brichet](https://github.com/brichet))
- Multichatpanel followup [#275](https://github.com/jupyterlab/jupyter-chat/pull/275) ([@brichet](https://github.com/brichet))
- Adding multi chats panel in `@jupyter/chat` package [#262](https://github.com/jupyterlab/jupyter-chat/pull/262) ([@nakul-py](https://github.com/nakul-py))

### Bugs fixed

- Fix chat focus behavior to allow copy/paste from messages [#268](https://github.com/jupyterlab/jupyter-chat/pull/268) ([@nakul-py](https://github.com/nakul-py))

### Maintenance and upkeep improvements

- Ignore `www.npmjs.com` links [#280](https://github.com/jupyterlab/jupyter-chat/pull/280) ([@jtpio](https://github.com/jtpio))
- Update Materiel UI v7 [#277](https://github.com/jupyterlab/jupyter-chat/pull/277) ([@brichet](https://github.com/brichet))
- Require Python 3.9, test on 3.10 - 3.13 [#274](https://github.com/jupyterlab/jupyter-chat/pull/274) ([@jtpio](https://github.com/jtpio))

### API and Breaking Changes

- Update Materiel UI v7 [#277](https://github.com/jupyterlab/jupyter-chat/pull/277) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-07-29&to=2025-09-25&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-07-29..2025-09-25&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-07-29..2025-09-25&type=Issues) | [@jtpio](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Ajtpio+updated%3A2025-07-29..2025-09-25&type=Issues) | [@nakul-py](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Anakul-py+updated%3A2025-07-29..2025-09-25&type=Issues)

## 0.17.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.16.0...8a7005fbf7f03d0664611eca667aad2ed5da15ab))

### Enhancements made

- Log warning instead of showing error dialog when chat file path not found during startup restoration [#259](https://github.com/jupyterlab/jupyter-chat/pull/259) ([@andrii-i](https://github.com/andrii-i))
- Return docmanager widget from createChat/openChat commands to ensure launcher disposal [#258](https://github.com/jupyterlab/jupyter-chat/pull/258) ([@andrii-i](https://github.com/andrii-i))

### Bugs fixed

- Improve file event handling in side panel [#260](https://github.com/jupyterlab/jupyter-chat/pull/260) ([@brichet](https://github.com/brichet))
- Filters current user from @mention display list [#250](https://github.com/jupyterlab/jupyter-chat/pull/250) ([@3coins](https://github.com/3coins))

### Maintenance and upkeep improvements

- Bump form-data from 4.0.0 to 4.0.4 in the npm_and_yarn group across 1 directory [#255](https://github.com/jupyterlab/jupyter-chat/pull/255) ([@dependabot](https://github.com/dependabot))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-07-07&to=2025-07-29&type=c))

[@3coins](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3A3coins+updated%3A2025-07-07..2025-07-29&type=Issues) | [@andrii-i](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Aandrii-i+updated%3A2025-07-07..2025-07-29&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-07-07..2025-07-29&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2025-07-07..2025-07-29&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-07-07..2025-07-29&type=Issues)

## 0.16.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.15.0...2b54aa4e427caa9a1b96ff0fdc4b713df2c173ae))

### Enhancements made

- Create chat message attachments via drag-and-drop from files, notebook cells [#248](https://github.com/jupyterlab/jupyter-chat/pull/248) ([@andrii-i](https://github.com/andrii-i))
- Update attachments API to support cells & selection ranges [#247](https://github.com/jupyterlab/jupyter-chat/pull/247) ([@dlqqq](https://github.com/dlqqq))

### Maintenance and upkeep improvements

- Make `user.mention_name` optional in frontend [#246](https://github.com/jupyterlab/jupyter-chat/pull/246) ([@dlqqq](https://github.com/dlqqq))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-06-25&to=2025-07-07&type=c))

[@andrii-i](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Aandrii-i+updated%3A2025-06-25..2025-07-07&type=Issues) | [@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2025-06-25..2025-07-07&type=Issues) | [@ellisonbg](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Aellisonbg+updated%3A2025-06-25..2025-07-07&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-06-25..2025-07-07&type=Issues)

## 0.15.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.14.0...ce0e13d21f1989c17d699f85fd3e38f004b8f02e))

### Enhancements made

- Side panel spinner [#240](https://github.com/jupyterlab/jupyter-chat/pull/240) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix v0.14.0 bugs [#242](https://github.com/jupyterlab/jupyter-chat/pull/242) ([@dlqqq](https://github.com/dlqqq))
- Create new chat files in filebrowser's current directory when creating from launcher [#238](https://github.com/jupyterlab/jupyter-chat/pull/238) ([@andrii-i](https://github.com/andrii-i))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-06-23&to=2025-06-25&type=c))

[@andrii-i](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Aandrii-i+updated%3A2025-06-23..2025-06-25&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-06-23..2025-06-25&type=Issues) | [@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2025-06-23..2025-06-25&type=Issues) | [@ellisonbg](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Aellisonbg+updated%3A2025-06-23..2025-06-25&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-06-23..2025-06-25&type=Issues)

## 0.14.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.13.0...23a5c18036a34420a1ee94dd3b3e6dc19d11ae0a))

### Enhancements made

- Allow users to be mentioned via Python API [#235](https://github.com/jupyterlab/jupyter-chat/pull/235) ([@dlqqq](https://github.com/dlqqq))
- Typing notification improvements [#232](https://github.com/jupyterlab/jupyter-chat/pull/232) ([@jtpio](https://github.com/jtpio))
- Run chat commands on message submission [#231](https://github.com/jupyterlab/jupyter-chat/pull/231) ([@dlqqq](https://github.com/dlqqq))

### Bugs fixed

- Code highlight in message [#226](https://github.com/jupyterlab/jupyter-chat/pull/226) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Fix the Binder environment [#233](https://github.com/jupyterlab/jupyter-chat/pull/233) ([@jtpio](https://github.com/jtpio))
- Bump brace-expansion from 2.0.1 to 2.0.2 in /ui-tests in the npm_and_yarn group across 1 directory [#229](https://github.com/jupyterlab/jupyter-chat/pull/229) ([@dependabot](https://github.com/dependabot))
- Jupyter chat package reorganization [#225](https://github.com/jupyterlab/jupyter-chat/pull/225) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-06-11&to=2025-06-23&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-06-11..2025-06-23&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2025-06-11..2025-06-23&type=Issues) | [@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2025-06-11..2025-06-23&type=Issues) | [@ellisonbg](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Aellisonbg+updated%3A2025-06-11..2025-06-23&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-06-11..2025-06-23&type=Issues) | [@jtpio](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Ajtpio+updated%3A2025-06-11..2025-06-23&type=Issues)

## 0.13.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.12.0...2b688d7ef2914f78150c9c5e227d44b81ff26231))

### Enhancements made

- Upgrade to Jupyter Collaboration 4 [#227](https://github.com/jupyterlab/jupyter-chat/pull/227) ([@dlqqq](https://github.com/dlqqq))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-06-03&to=2025-06-11&type=c))

[@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2025-06-03..2025-06-11&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-06-03..2025-06-11&type=Issues)

## 0.12.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.11.0...2867f2edc63cfdad16c81d91c00074d0911726ff))

### Enhancements made

- Add a welcome message [#221](https://github.com/jupyterlab/jupyter-chat/pull/221) ([@brichet](https://github.com/brichet))
- Display user writing notification when editing a message [#208](https://github.com/jupyterlab/jupyter-chat/pull/208) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix scrollbar in empty chat [#223](https://github.com/jupyterlab/jupyter-chat/pull/223) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-04-28&to=2025-06-03&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-04-28..2025-06-03&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-04-28..2025-06-03&type=Issues)

## 0.11.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.10.1...1a3d91843e9ae70147b0d92158126002068661b6))

### Enhancements made

- Allow Users to delete messages if sender is a bot, add optional `bot` bool to user models [#214](https://github.com/jupyterlab/jupyter-chat/pull/214) ([@andrii-i](https://github.com/andrii-i))
- Add a message footer registry, to allow extensions to provides their footers [#210](https://github.com/jupyterlab/jupyter-chat/pull/210) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-04-17&to=2025-04-28&type=c))

[@andrii-i](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Aandrii-i+updated%3A2025-04-17..2025-04-28&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-04-17..2025-04-28&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-04-17..2025-04-28&type=Issues)

## 0.10.1

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.10.0...171ebfaef4e88a2e3e0ccef6016500119f4a2155))

### Bugs fixed

- Fix case-sensitivity in user mention commands [#211](https://github.com/jupyterlab/jupyter-chat/pull/211) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-04-11&to=2025-04-17&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-04-11..2025-04-17&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-04-11..2025-04-17&type=Issues)

## 0.10.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.9.0...c713dba7549b8ea829621b02e3cb838bfefb5fbb))

### Enhancements made

- Mention users in messages (using @) [#190](https://github.com/jupyterlab/jupyter-chat/pull/190) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix the toolbar registry for main area chat [#206](https://github.com/jupyterlab/jupyter-chat/pull/206) ([@brichet](https://github.com/brichet))
- Fix the attachments on message edition and on python Message model [#200](https://github.com/jupyterlab/jupyter-chat/pull/200) ([@brichet](https://github.com/brichet))
- Fix duplication after message edition [#194](https://github.com/jupyterlab/jupyter-chat/pull/194) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Fix \_version.py file version bump [#207](https://github.com/jupyterlab/jupyter-chat/pull/207) ([@brichet](https://github.com/brichet))
- Fix the wrong version of python package [#205](https://github.com/jupyterlab/jupyter-chat/pull/205) ([@brichet](https://github.com/brichet))
- Abstract ChatModel class [#197](https://github.com/jupyterlab/jupyter-chat/pull/197) ([@brichet](https://github.com/brichet))
- Move jupyterlab-chat-extension to packages directory [#196](https://github.com/jupyterlab/jupyter-chat/pull/196) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-03-31&to=2025-04-11&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-03-31..2025-04-11&type=Issues) | [@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2025-03-31..2025-04-11&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-03-31..2025-04-11&type=Issues)

## 0.9.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.8.1...e182c03aa81119250818bf78da9d932a74f9cef4))

### Enhancements made

- Input toolbar registry [#198](https://github.com/jupyterlab/jupyter-chat/pull/198) ([@brichet](https://github.com/brichet))
- Add a clearMessages() method in ChatModel [#195](https://github.com/jupyterlab/jupyter-chat/pull/195) ([@brichet](https://github.com/brichet))
- Disable the copy button in insecure contexts [#192](https://github.com/jupyterlab/jupyter-chat/pull/192) ([@keerthi-swarna](https://github.com/keerthi-swarna))

### Bugs fixed

- Fix the trailing hyphen in completion without description [#191](https://github.com/jupyterlab/jupyter-chat/pull/191) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Bump vega from 5.28.0 to 5.33.0 in /ui-tests in the npm_and_yarn group across 1 directory [#199](https://github.com/jupyterlab/jupyter-chat/pull/199) ([@dependabot](https://github.com/dependabot))
- Bump the npm_and_yarn group across 1 directory with 2 updates [#193](https://github.com/jupyterlab/jupyter-chat/pull/193) ([@dependabot](https://github.com/dependabot))
- Bump axios from 1.7.4 to 1.8.2 in the npm_and_yarn group across 1 directory [#189](https://github.com/jupyterlab/jupyter-chat/pull/189) ([@dependabot](https://github.com/dependabot))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-03-11&to=2025-03-28&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-03-11..2025-03-28&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2025-03-11..2025-03-28&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2025-03-11..2025-03-28&type=Issues) | [@keerthi-swarna](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Akeerthi-swarna+updated%3A2025-03-11..2025-03-28&type=Issues)

## 0.8.1

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.8.0...d7b867a567b179a3c5c449a2e59bdbe01071aa43))

### Bugs fixed

- Move the CSS rules of chat commands in @jupyter/chat [#188](https://github.com/jupyterlab/jupyter-chat/pull/188) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2025-03-03&to=2025-03-11&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2025-03-03..2025-03-11&type=Issues)

## 0.8.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.7.1...9a4aebf3df7f29640ddbe5dcf4b66f3fc3e63625))

### Enhancements made

- Add icons & descriptions to chat commands menu [#185](https://github.com/jupyterlab/jupyter-chat/pull/185) ([@keerthi-swarna](https://github.com/keerthi-swarna))
- Add new `InputModel` class for managing input state [#171](https://github.com/jupyterlab/jupyter-chat/pull/171) ([@brichet](https://github.com/brichet))
- Define a new framework for chat commands [#161](https://github.com/jupyterlab/jupyter-chat/pull/161) ([@dlqqq](https://github.com/dlqqq))
- Implement message attachments [#148](https://github.com/jupyterlab/jupyter-chat/pull/148) ([@brichet](https://github.com/brichet))
- Adds side panel widgets to the tracker [#146](https://github.com/jupyterlab/jupyter-chat/pull/146) ([@brichet](https://github.com/brichet))
- Move the Chat card in the 'Other' section of the launcher [#141](https://github.com/jupyterlab/jupyter-chat/pull/141) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix disabled code toolbar buttons [#160](https://github.com/jupyterlab/jupyter-chat/pull/160) ([@brichet](https://github.com/brichet))
- Allow use of up and down arrow in chat input [#158](https://github.com/jupyterlab/jupyter-chat/pull/158) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Remove old autocomplete registry [#187](https://github.com/jupyterlab/jupyter-chat/pull/187) ([@brichet](https://github.com/brichet))
- Update eslint rules to avoid importing MUI icons [#159](https://github.com/jupyterlab/jupyter-chat/pull/159) ([@brichet](https://github.com/brichet))
- Update to `actions/upload-artifact@v4` and `actions/download-artifact@v4` [#152](https://github.com/jupyterlab/jupyter-chat/pull/152) ([@jtpio](https://github.com/jtpio))
- Add `Untitled*.ipynb` and `*.chat` to the `.gitignore` [#151](https://github.com/jupyterlab/jupyter-chat/pull/151) ([@jtpio](https://github.com/jtpio))
- Improve the test execution [#150](https://github.com/jupyterlab/jupyter-chat/pull/150) ([@brichet](https://github.com/brichet))
- Lint the whole project instead of individual packages [#142](https://github.com/jupyterlab/jupyter-chat/pull/142) ([@brichet](https://github.com/brichet))

### Documentation improvements

- Lite deployment in doc [#162](https://github.com/jupyterlab/jupyter-chat/pull/162) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-12-25&to=2025-03-03&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-12-25..2025-03-03&type=Issues) | [@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2024-12-25..2025-03-03&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-12-25..2025-03-03&type=Issues) | [@jtpio](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Ajtpio+updated%3A2024-12-25..2025-03-03&type=Issues) | [@keerthi-swarna](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Akeerthi-swarna+updated%3A2024-12-25..2025-03-03&type=Issues)

## 0.7.1

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.7.0...b9373cfc7304a3fd3f8cccfe0d74782120b2ec76))

### Bugs fixed

- Fix support for Python 3.9 [#136](https://github.com/jupyterlab/jupyter-chat/pull/136) ([@dlqqq](https://github.com/dlqqq))

### Maintenance and upkeep improvements

- Bump systeminformation from 5.22.7 to 5.23.14 in /ui-tests in the npm_and_yarn group across 1 directory [#133](https://github.com/jupyterlab/jupyter-chat/pull/133) ([@dependabot](https://github.com/dependabot))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-12-20&to=2024-12-24&type=c))

[@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2024-12-20..2024-12-24&type=Issues) | [@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2024-12-20..2024-12-24&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-12-20..2024-12-24&type=Issues)

## 0.7.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.6.2...9d524d6b7f23d43ac7c0b21a26d1b94d37e98685))

### Enhancements made

- Remove need for message index in YChat API methods [#125](https://github.com/jupyterlab/jupyter-chat/pull/125) ([@brichet](https://github.com/brichet))
- Compatibility with notebook [#112](https://github.com/jupyterlab/jupyter-chat/pull/112) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix math rendering using Latex delimiters [#129](https://github.com/jupyterlab/jupyter-chat/pull/129) ([@brichet](https://github.com/brichet))
- Prevent sending empty message [#126](https://github.com/jupyterlab/jupyter-chat/pull/126) ([@brichet](https://github.com/brichet))
- Improve (and fix) unread messages and navigation [#123](https://github.com/jupyterlab/jupyter-chat/pull/123) ([@brichet](https://github.com/brichet))
- Fix rendering of code blocks in JupyterLab>= 4.3.0 [#111](https://github.com/jupyterlab/jupyter-chat/pull/111) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Export components from @jupyter/chat [#132](https://github.com/jupyterlab/jupyter-chat/pull/132) ([@brichet](https://github.com/brichet))
- Add the video of failing tests in playwright report [#127](https://github.com/jupyterlab/jupyter-chat/pull/127) ([@brichet](https://github.com/brichet))
- Bump nanoid from 3.3.7 to 3.3.8 in /ui-tests in the npm_and_yarn group across 1 directory [#124](https://github.com/jupyterlab/jupyter-chat/pull/124) ([@dependabot](https://github.com/dependabot))
- Bump nanoid from 3.3.7 to 3.3.8 in the npm_and_yarn group across 1 directory [#122](https://github.com/jupyterlab/jupyter-chat/pull/122) ([@dependabot](https://github.com/dependabot))
- Use dataclass models in YChat [#119](https://github.com/jupyterlab/jupyter-chat/pull/119) ([@brichet](https://github.com/brichet))
- Rename server config file after renaming the extension [#108](https://github.com/jupyterlab/jupyter-chat/pull/108) ([@brichet](https://github.com/brichet))
- Upgrade to Jupyter Collaboration 3 [#94](https://github.com/jupyterlab/jupyter-chat/pull/94) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-11-25&to=2024-12-20&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-11-25..2024-12-20&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2024-11-25..2024-12-20&type=Issues) | [@dlqqq](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adlqqq+updated%3A2024-11-25..2024-12-20&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-11-25..2024-12-20&type=Issues)

## 0.6.2

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.6.1...7248d2d7c4b6eaffeb4033a8776b36ede7ebf23f))

### Maintenance and upkeep improvements

- Fix typing for python 3.9 [#107](https://github.com/jupyterlab/jupyter-chat/pull/107) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-11-25&to=2024-11-25&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-11-25..2024-11-25&type=Issues)

## 0.6.1

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/v0.6.0...2961450cd8a877a6390314bf60b66b21436c3e19))

### Maintenance and upkeep improvements

- Typing [#106](https://github.com/jupyterlab/jupyter-chat/pull/106) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-11-22&to=2024-11-25&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-11-22..2024-11-25&type=Issues)

## 0.6.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.5.0...7017ee16130fb28189fa699869e93fa9e59fd2a9))

> [!IMPORTANT]
>
> - The extension based on collaborative documents has been renamed `jupyterlab-chat`.
>   The PyPI package is now https://pypi.org/project/jupyterlab-chat/
>   The npmjs packages are now:
>
>   - https://www.npmjs.com/package/jupyterlab-chat
>   - https://www.npmjs.com/package/jupyterlab-chat-extension
>
> - The websocket chat extension has been removed from this repository.
>   The repo for this extension is now https://github.com/brichet/jupyterlab-ws-chat

### Enhancements made

- Improve padding around code toolbar buttons [#96](https://github.com/jupyterlab/jupyter-chat/pull/96) ([@brichet](https://github.com/brichet))
- Chats directory config [#91](https://github.com/jupyterlab/jupyter-chat/pull/91) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Revert 'Allow `$` to literally denote quantities of USD in chat' (#95) [#99](https://github.com/jupyterlab/jupyter-chat/pull/99) ([@brichet](https://github.com/brichet))
- Allow `$` to literally denote quantities of USD in chat [#95](https://github.com/jupyterlab/jupyter-chat/pull/95) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Bump cross-spawn from 6.0.5 to 6.0.6 in the npm_and_yarn group across 1 directory [#103](https://github.com/jupyterlab/jupyter-chat/pull/103) ([@dependabot](https://github.com/dependabot))
- Rename the extension to jupyterlab-chat [#102](https://github.com/jupyterlab/jupyter-chat/pull/102) ([@brichet](https://github.com/brichet))
- Bump cross-spawn from 7.0.3 to 7.0.6 in /python/jupyterlab-collaborative-chat/ui-tests in the npm_and_yarn group across 1 directory [#101](https://github.com/jupyterlab/jupyter-chat/pull/101) ([@dependabot](https://github.com/dependabot))
- Remove websocket chat extension [#100](https://github.com/jupyterlab/jupyter-chat/pull/100) ([@brichet](https://github.com/brichet))
- Fix the ui tests for jupyterlab 4.3 [#97](https://github.com/jupyterlab/jupyter-chat/pull/97) ([@brichet](https://github.com/brichet))

### Documentation improvements

- Update README.md [#104](https://github.com/jupyterlab/jupyter-chat/pull/104) ([@brichet](https://github.com/brichet))
- Add notes about current development status and breaking changes [#93](https://github.com/jupyterlab/jupyter-chat/pull/93) ([@brichet](https://github.com/brichet))

### Other merged PRs

- Remove leftover in ui test [#98](https://github.com/jupyterlab/jupyter-chat/pull/98) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-10-21&to=2024-11-22&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-10-21..2024-11-22&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2024-10-21..2024-11-22&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-10-21..2024-11-22&type=Issues)

## 0.5.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.4.0...52019670352c8011c5f22726bf87b5b1141b63ae))

### Enhancements made

- Add typing notifications [#85](https://github.com/jupyterlab/jupyter-chat/pull/85) ([@brichet](https://github.com/brichet))
- Send with selection [#82](https://github.com/jupyterlab/jupyter-chat/pull/82) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix duplicated chats [#87](https://github.com/jupyterlab/jupyter-chat/pull/87) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Update jupyter_collaboration dependency [#90](https://github.com/jupyterlab/jupyter-chat/pull/90) ([@brichet](https://github.com/brichet))
- Bundle @jupyter/chat [#89](https://github.com/jupyterlab/jupyter-chat/pull/89) ([@brichet](https://github.com/brichet))
- Improve dev script [#88](https://github.com/jupyterlab/jupyter-chat/pull/88) ([@brichet](https://github.com/brichet))
- Refactor UI tests [#86](https://github.com/jupyterlab/jupyter-chat/pull/86) ([@brichet](https://github.com/brichet))
- Fix the update snapshot workflow [#84](https://github.com/jupyterlab/jupyter-chat/pull/84) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-09-13&to=2024-10-21&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-09-13..2024-10-21&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-09-13..2024-10-21&type=Issues)

## 0.4.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.3.1...67dbc0d100da651bfbaaf8a52ddf1490b18128ee))

### Enhancements made

- Ychat update messages [#81](https://github.com/jupyterlab/jupyter-chat/pull/81) ([@brichet](https://github.com/brichet))
- Use getter and setter for the config in the collaborative chat [#77](https://github.com/jupyterlab/jupyter-chat/pull/77) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Shortcut to focus on the chat input [#80](https://github.com/jupyterlab/jupyter-chat/pull/80) ([@brichet](https://github.com/brichet))
- Fix labextension in develop mode in dev install [#79](https://github.com/jupyterlab/jupyter-chat/pull/79) ([@brichet](https://github.com/brichet))
- Reoganize the project to split typescript packages and extensions [#78](https://github.com/jupyterlab/jupyter-chat/pull/78) ([@brichet](https://github.com/brichet))
- Bump micromatch from 4.0.7 to 4.0.8 in the npm_and_yarn group across 1 directory [#76](https://github.com/jupyterlab/jupyter-chat/pull/76) ([@dependabot](https://github.com/dependabot))
- Bump webpack from 5.93.0 to 5.94.0 in the npm_and_yarn group across 1 directory [#75](https://github.com/jupyterlab/jupyter-chat/pull/75) ([@dependabot](https://github.com/dependabot))
- Bump the npm_and_yarn group across 3 directories with 3 updates [#73](https://github.com/jupyterlab/jupyter-chat/pull/73) ([@dependabot](https://github.com/dependabot))

### Documentation improvements

- Fix ReadTheDocs [#74](https://github.com/jupyterlab/jupyter-chat/pull/74) ([@jtpio](https://github.com/jtpio))
- Add documentation [#71](https://github.com/jupyterlab/jupyter-chat/pull/71) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-08-07&to=2024-09-13&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-08-07..2024-09-13&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2024-08-07..2024-09-13&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-08-07..2024-09-13&type=Issues) | [@jtpio](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Ajtpio+updated%3A2024-08-07..2024-09-13&type=Issues)

## 0.3.1

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.3.0...fe37f7ddc158787bf2a5a77343391379a6216b14))

### Enhancements made

- Improve ychat class on server side [#69](https://github.com/jupyterlab/jupyter-chat/pull/69) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-08-05&to=2024-08-06&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-08-05..2024-08-06&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-08-05..2024-08-06&type=Issues)

## 0.3.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.2.0...08b371dd6a9616b70d42a93165c5b18274ff00f9))

### Enhancements made

- Add a configChanged signal to the model [#68](https://github.com/jupyterlab/jupyter-chat/pull/68) ([@brichet](https://github.com/brichet))
- Code toolbar [#67](https://github.com/jupyterlab/jupyter-chat/pull/67) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Update to jupyterlab 4.2.x [#66](https://github.com/jupyterlab/jupyter-chat/pull/66) ([@brichet](https://github.com/brichet))
- Updated integration tests workflow [#65](https://github.com/jupyterlab/jupyter-chat/pull/65) ([@krassowski](https://github.com/krassowski))
- Bump the npm_and_yarn group across 2 directories with 4 updates [#63](https://github.com/jupyterlab/jupyter-chat/pull/63) ([@dependabot](https://github.com/dependabot))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-07-04&to=2024-08-05&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-07-04..2024-08-05&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2024-07-04..2024-08-05&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-07-04..2024-08-05&type=Issues) | [@krassowski](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Akrassowski+updated%3A2024-07-04..2024-08-05&type=Issues)

## 0.2.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/@jupyter/chat@0.1.0...234e231ccadb198409e6a4250fdcbe05c32895e7))

### Enhancements made

- Autocomplete commands [#57](https://github.com/jupyterlab/jupyter-chat/pull/57) ([@brichet](https://github.com/brichet))
- Buttons to mark chat as read [#56](https://github.com/jupyterlab/jupyter-chat/pull/56) ([@brichet](https://github.com/brichet))
- Add metadata to ychat, id to model and store last unread in localStorage [#54](https://github.com/jupyterlab/jupyter-chat/pull/54) ([@brichet](https://github.com/brichet))
- Add the panel tracker to the chat factory token [#47](https://github.com/jupyterlab/jupyter-chat/pull/47) ([@brichet](https://github.com/brichet))
- Notifications for unread messages [#43](https://github.com/jupyterlab/jupyter-chat/pull/43) ([@brichet](https://github.com/brichet))
- Stack consecutive messages from same user [#40](https://github.com/jupyterlab/jupyter-chat/pull/40) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix the initialization of the messages component [#60](https://github.com/jupyterlab/jupyter-chat/pull/60) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Fix bump version [#62](https://github.com/jupyterlab/jupyter-chat/pull/62) ([@brichet](https://github.com/brichet))
- Prevent dependabot from using yarn 4 [#59](https://github.com/jupyterlab/jupyter-chat/pull/59) ([@brichet](https://github.com/brichet))
- Use the Chat.IOptions as option for the Widget and Sidebar [#55](https://github.com/jupyterlab/jupyter-chat/pull/55) ([@brichet](https://github.com/brichet))
- Depend on `pydantic` directly instead of `langchain` [#48](https://github.com/jupyterlab/jupyter-chat/pull/48) ([@jtpio](https://github.com/jtpio))
- Refactoring to avoid unecessary react rendering [#44](https://github.com/jupyterlab/jupyter-chat/pull/44) ([@brichet](https://github.com/brichet))
- Add binder link in README and on PR [#41](https://github.com/jupyterlab/jupyter-chat/pull/41) ([@brichet](https://github.com/brichet))
- Fix the release workflow [#39](https://github.com/jupyterlab/jupyter-chat/pull/39) ([@brichet](https://github.com/brichet))
- Code refactoring [#38](https://github.com/jupyterlab/jupyter-chat/pull/38) ([@brichet](https://github.com/brichet))

### Documentation improvements

- Add screenshot to the README [#46](https://github.com/jupyterlab/jupyter-chat/pull/46) ([@jtpio](https://github.com/jtpio))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2024-05-16&to=2024-07-04&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2024-05-16..2024-07-04&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Agithub-actions+updated%3A2024-05-16..2024-07-04&type=Issues) | [@jtpio](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Ajtpio+updated%3A2024-05-16..2024-07-04&type=Issues) | [@welcome](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Awelcome+updated%3A2024-05-16..2024-07-04&type=Issues)

## 0.1.0

([Full Changelog](https://github.com/jupyterlab/jupyter-chat/compare/877bbc1a13706c69ad5b41b79a697ab64ac447e8...0b72a3b62a3615688d3e744d6fa52f76427f9cf5))

### Prior to this release

A lot of the UI components of this project come from [jupyter-ai](https://github.com/jupyterlab/jupyter-ai).

**Contributors** of the initial UI components, in the order of [Github contributors](https://github.com/jupyterlab/jupyter-chat/graphs/contributors):

@dlqqq | @3coins | @JasonWeill | @krassowski | @ellisonbg | @andrii-i | @aws-khatria | @garsonbyte | @markqiu | @aychang95 | @mschroering

### Enhancements made

- Messages as a list in collaborative chat document [#31](https://github.com/jupyterlab/jupyter-chat/pull/31) ([@brichet](https://github.com/brichet))
- Remove requirement to global awareness, which often fails to activate [#28](https://github.com/jupyterlab/jupyter-chat/pull/28) ([@brichet](https://github.com/brichet))
- Use the server time in collaborative chat [#26](https://github.com/jupyterlab/jupyter-chat/pull/26) ([@brichet](https://github.com/brichet))
- Edition and deletion of messages [#22](https://github.com/jupyterlab/jupyter-chat/pull/22) ([@brichet](https://github.com/brichet))
- Improve ychat [#18](https://github.com/jupyterlab/jupyter-chat/pull/18) ([@brichet](https://github.com/brichet))
- Toolbar factory [#16](https://github.com/jupyterlab/jupyter-chat/pull/16) ([@brichet](https://github.com/brichet))
- Propagate the config to all existing and newly created chat widget [#14](https://github.com/jupyterlab/jupyter-chat/pull/14) ([@brichet](https://github.com/brichet))
- Add commands, menu entry and launcher [#12](https://github.com/jupyterlab/jupyter-chat/pull/12) ([@brichet](https://github.com/brichet))
- Collaborative chat sidepanel [#11](https://github.com/jupyterlab/jupyter-chat/pull/11) ([@brichet](https://github.com/brichet))
- add a collaborative chat extension [#9](https://github.com/jupyterlab/jupyter-chat/pull/9) ([@brichet](https://github.com/brichet))
- Split the project in two packages: UI (npm) and jupyterlab extension [#3](https://github.com/jupyterlab/jupyter-chat/pull/3) ([@brichet](https://github.com/brichet))
- Add a model to the chat panel [#1](https://github.com/jupyterlab/jupyter-chat/pull/1) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Fix message datetime [#29](https://github.com/jupyterlab/jupyter-chat/pull/29) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Set the release workflows to use the jupyterlab releaser bot [#35](https://github.com/jupyterlab/jupyter-chat/pull/35) ([@brichet](https://github.com/brichet))
- Bump tar from 6.2.0 to 6.2.1 in /packages/jupyterlab-ws-chat/ui-tests in the npm_and_yarn group across 1 directory [#21](https://github.com/jupyterlab/jupyter-chat/pull/21) ([@dependabot](https://github.com/dependabot))
- Update the github organization from 'jupyterlab-contrib' to 'jupyterlab' [#20](https://github.com/jupyterlab/jupyter-chat/pull/20) ([@brichet](https://github.com/brichet))
- Add the @jupyter namespace to the NPM chat package [#17](https://github.com/jupyterlab/jupyter-chat/pull/17) ([@brichet](https://github.com/brichet))
- Integration tests [#13](https://github.com/jupyterlab/jupyter-chat/pull/13) ([@brichet](https://github.com/brichet))
- Monorepo improvements [#10](https://github.com/jupyterlab/jupyter-chat/pull/10) ([@brichet](https://github.com/brichet))
- Rename extension package [#8](https://github.com/jupyterlab/jupyter-chat/pull/8) ([@brichet](https://github.com/brichet))
- Remove @jupyter namespace from the package name [#6](https://github.com/jupyterlab/jupyter-chat/pull/6) ([@brichet](https://github.com/brichet))
- Update the github repo from QuantStack to jupyterlab-contrib [#5](https://github.com/jupyterlab/jupyter-chat/pull/5) ([@brichet](https://github.com/brichet))
- Add license-header action [#4](https://github.com/jupyterlab/jupyter-chat/pull/4) ([@brichet](https://github.com/brichet))
- Remove non relevant tests [#2](https://github.com/jupyterlab/jupyter-chat/pull/2) ([@brichet](https://github.com/brichet))

### Documentation improvements

- Monorepo improvements [#10](https://github.com/jupyterlab/jupyter-chat/pull/10) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyter-chat/graphs/contributors?from=2023-02-10&to=2024-05-16&type=c))

[@brichet](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Abrichet+updated%3A2023-02-10..2024-05-16&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Adependabot+updated%3A2023-02-10..2024-05-16&type=Issues) | [@welcome](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyter-chat+involves%3Awelcome+updated%3A2023-02-10..2024-05-16&type=Issues)
