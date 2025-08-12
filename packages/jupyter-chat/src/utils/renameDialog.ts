/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import '../../style/input.css';

export async function showRenameDialog(
  currentName: string
): Promise<string | null> {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'rename-modal';

    const dialog = document.createElement('div');
    dialog.className = 'rename-dialog';
    modal.appendChild(dialog);

    const title = document.createElement('h3');
    title.textContent = 'Rename Chat';
    dialog.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    dialog.appendChild(input);

    const buttons = document.createElement('div');
    buttons.className = 'rename-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'cancel-btn';
    cancelBtn.onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };
    buttons.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.textContent = 'Rename';
    okBtn.className = 'rename-ok';
    okBtn.onclick = () => {
      const val = input.value.trim();
      if (val) {
        document.body.removeChild(modal);
        resolve(val);
      } else {
        input.focus();
      }
    };
    buttons.appendChild(okBtn);

    dialog.appendChild(buttons);

    document.body.appendChild(modal);
    input.focus();

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        okBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });
  });
}
