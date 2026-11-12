export interface Movement {
  x: number;
  z: number;
}

export interface Input {
  getMovement: () => Movement;
  isTyping: () => boolean;
  destroy: () => void;
}

const MOVEMENT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

function isTextTarget(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  );
}

export function createInput(): Input {
  const keys = new Set<string>();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (isTextTarget()) {
      return;
    }
    const key = event.key.toLowerCase();
    keys.add(key);
    if (MOVEMENT_KEYS.has(key)) {
      event.preventDefault();
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    keys.delete(event.key.toLowerCase());
  };

  const onBlur = (): void => {
    keys.clear();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    getMovement(): Movement {
      if (isTextTarget()) {
        return { x: 0, z: 0 };
      }

      let x = 0;
      let z = 0;

      if (keys.has("w") || keys.has("arrowup")) {
        z -= 1;
      }
      if (keys.has("s") || keys.has("arrowdown")) {
        z += 1;
      }
      if (keys.has("a") || keys.has("arrowleft")) {
        x -= 1;
      }
      if (keys.has("d") || keys.has("arrowright")) {
        x += 1;
      }

      return { x, z };
    },
    isTyping: isTextTarget,
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
