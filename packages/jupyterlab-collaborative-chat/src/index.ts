/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { requestAPI } from './handler';

/**
 * Initialization data for the jupyterlab-collaborative-chat extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-collaborative-chat:plugin',
  description: 'A chat extension based on shared documents',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log(
      'JupyterLab extension jupyterlab-collaborative-chat is activated!'
    );

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log(
            'jupyterlab-collaborative-chat settings loaded:',
            settings.composite
          );
        })
        .catch(reason => {
          console.error(
            'Failed to load settings for jupyterlab-collaborative-chat.',
            reason
          );
        });
    }

    requestAPI<any>('get-example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_collaborative_chat server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
