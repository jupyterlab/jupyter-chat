/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';
import { UUID } from '@lumino/coreutils';

import { openChat, USER } from './test-utils';

const FILENAME = 'my-chat.chat';
const USERNAME = USER.identity.username;
const BUNDLES = [
  {
    bundle: {
      'application/json': {
        'nested value': {
          Hello: 'World'
        },
        version: 1.0
      }
    },
    class: '.jp-RenderedJSON'
  },
  {
    bundle: {
      'text/html':
        '<div><div style="color: blue; font-weight: bold">This is pure HTML</div><details><summary>Hello</summary>World !!</details></div>'
    },
    class: '.jp-RenderedHTML'
  },
  {
    bundle: {
      'image/png':
        'iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAYAAADDhn8LAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAdnJLH8AAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+oCBgoPBKnCw/gAAAe1SURBVHja7d19jB5FAcfxb/VaitfCgWNR0rEgvjSgYhOggjWgQlEgEImY4AuM2qhEDRYLxFqJIvKqtMqbsSijJCIajaat1So1thW0ghBiAwoidai0lwHbXkvfPOsfOyBp7u6Z67PP7vPc8/skl1zzzN5sZ5/fzs7u7C6IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI1G+cmkBGIzp7MDAdmAZMBialn93A1vTTDzxifPiXAlJu438auGk/F98N7AKeATYCjwEPA6uB+40PgxWv2zLjw1kltcvtwMdGKLLO+PDGFm2Tw4EzgDOBE4DDR7H4ZmAdsAq4B/i98WFnJwWkZwzt3Cakn8nAEcBbX/TZpujsXcAi48P6itbnzOjsbOPDig7sJcalUMwDTm5iR9oHvC39fB7YGZ1dCtwB/KrZnVYVXtIlRwaHAZ8FHovOXhednVhRvTdGZ1/aYeE4DfgLsBQ4peSjjInA+4BlwA87oT26JSDPGw9cBqyOzh5WQX3HAJ/okGAcEp31wArg6AqqvFsBaV/HAUujswdWUNeX08C2ncPxOmAtcGFFVT4N/EwBaf+QfK+CegxwRRuHYyZwL/DaCqtdbHz4jwLS/s6Lzr67gno+k/bS7RaOo9J4wFRY7SCwuFO+IJ14FmsXcPMQY4uDgdcDM9JgMNeVwC8rGPt8DTinjcLRl8Lx8lEuuh34OfA74EFgE8W1j17gUGBK6p1nUpwBO3Sf5ZcYH55SQFpnp/Fh3ggbfhJwAXAVcEjG3zs+OnuS8eHeFq/32dHZdxofVrZJO34deMMoyv8buBa4xfiwfYjPNwMb0u/3pG0xHjgd+CDF2ase4NZO+rKNuUMs48M248OtqSfZkLnY7IpWb2F0tvY2j86+HfjIKBZZCRxtfLh+mHAMty32GB+WGh/OT2G8BviNAtIeQVmfepIcp1W0Wm8G5rRB83yD/OsbdwGzjQ8bm9weTxgf5hsf9iog7ROSlcADGUXLOO9/DbAjo9xXorMH1dh7vCP1rjlWAB/uhCveCsj+y+nS+6KzzY7Hnk0D8UamAAtqbI+LM8tt6vZwdEtAcudeNXuqsxe4DsiZwXpxdPY1NfQefRSTDnMsMD700+W6ISDbMsuNbzYgaQD7hYyyE4AbamiL2eSdufw7xYRCFJCxL7dnGCihB4Hi6vyfM8qfG509ueK2eE9mudu7/dCqmwKSMwDfBmxpsp5J6cTAXmBu5jJVn/Y9IbPcDxSNLghIdHZC5jH3oyWcfux9ocvyYRXwk4xlZgCuorboIW++1ePGh38qGt3Rg3wOeFVGudUl1NW7z78vo5gW08hX09X/VjsqjX0auU+x6IKARGc/TjHdJMfysgNifHgC+GbGcq8E5lfQJFMzy/1Nsfi/njEWih7gVIpbRd+VuVggzR0qYwyyj6vSIdQrGiw7Nzr7bePDky1snsmZ5dZntLOn+XtHnjE+GAWkfBOjsy++IDcBOAg4EnhL+n00bjY+/LcFh1gYH7ZGZ68Abmv0fwKuB94/zOeDLQrwUAaQjg7IAWlsUYZ/UMxLohUBSRYDnwIaPXXkvOjsLOPDmiE+21HC+uXePfmcYtE9g/SR7AYuMD7samVA0vWESzL/xsL0RJFWfGn3ZJYbr1goIIPAnGH21vtr2C+W8eHXFDcnNXIcQ89A3l7C+uXuCCYqFt0dkAHgHOPDnRXXOw/IuQ/76uhsbwt6kNwLoVMUi+4NyC+AY4wPy6qu2PjwaMZgHYonF17egoDk3s8xVbHo7EH6aO0ElgA3Gh/+UPO6fAn4EI1vBZ4XnV1sfAglHmLlPid3ekaZ5UAc4XPL8GfkFJAa7El72e1pT/k4xQWvNcAq48OOdlhJ48Oz0dkrgYUNih5IMXX+A6McP4xU98bo7FYanwafkfG37maEB79FZ09RQOqzxfjQ18FtfgtwEcUTWEZyfnT2JuPDfakXLMM64MQGZY6Mzh7R4ouWGoPIsHvfPWnAnuP5075lBeRPmeXO0pZSQOoMyRLyprfMTIdZZV2ryZ1SM0dbSQGp2yVAzhSXa0vcTr/N7I2Ojc6erk2kgNTZizwMfCej6FTg0pLqHKB4rUGORRW+JkIBkSEtoHhsZyNnlFjndzPLTQe+pYBInb1IP3B1xXUuBx7KLH5hdPa2dngapALSvRZRzCquuufK9UlgTXT22G7cOD36ftbei+yKzl4O/KjCOpdFZ38KnJu5yInAQ9HZNRQvvllLcaPZ5vT5ARRPj5kGvIni1W0KiJT2hf1x+vLNqrDai4DjKaaF5JpV8TrqEEteMBfYW2Eo+4H3kv9gPY1BpNZe5H7gzorrfIDi/R1btQUUkE4wn4pveU0vDjoJ+KuaXwFp915kA8XDG6qudx3F3YyLyLupSwGR2twAPFVDSLYZH+ZSvOTnDop79ss2SPFG3S9S3UuLmqKzWO3XizwXnZ0PfL+m+h8BPhqdvZTipaNnU5zmHe2tuHspXoH3IMVp4bXAH40PWzppe4zTV1JyRGdfTfH40mlAH/CytIMdTL3NAMV97/3A08CTxgc9QkhERERERERERERERERERERERERERERERERERERERERERERERERERERERERERMaO/wFuEw+XyQ709gAAAABJRU5ErkJggg=='
    },
    class: '.jp-RenderedImage'
  }
];

test.describe('#mime-renderer', () => {
  let baseTime = 1714116341;
  const messagesList: any[] = [];
  for (let bundle of BUNDLES) {
    messagesList.push({
      type: 'msg',
      id: UUID.uuid4(),
      sender: USERNAME,
      body: { data: bundle.bundle },
      time: baseTime * 60
    });
    baseTime += 1;
  }

  const chatContent = {
    messages: messagesList,
    users: {}
  };
  chatContent.users[USERNAME] = USER.identity;

  test.beforeEach(async ({ page }) => {
    // Create a chat file with content
    await page.filebrowser.contents.uploadContent(
      JSON.stringify(chatContent),
      'text',
      FILENAME
    );
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('Should render mime bundles', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator('.jp-chat-message');

    await expect(messages).toHaveCount(BUNDLES.length);
    for (let i = 0; i < (await messages.count()); i++) {
      const rendered = messages.nth(i).locator(BUNDLES[i].class);
      await expect(rendered).toBeAttached();
    }
  });
});
