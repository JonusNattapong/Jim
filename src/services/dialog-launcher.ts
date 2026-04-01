/**
 * Dialog Launcher System
 * Provides a way to launch interactive dialogs/prompts in the CLI
 */

export type DialogType =
  | "confirm"
  | "input"
  | "select"
  | "multiselect"
  | "file-picker"
  | "color-picker";

export interface DialogOptions {
  type: DialogType;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  options?: DialogOption[];
  validation?: (value: string) => string | null;
  required?: boolean;
}

export interface DialogOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface DialogResult {
  confirmed: boolean;
  value?: string | string[];
  cancelled: boolean;
}

export type DialogCallback = (result: DialogResult) => void;

class DialogLauncher {
  private activeDialog: DialogOptions | null = null;
  private callback: DialogCallback | null = null;

  /**
   * Launch a confirmation dialog
   */
  async confirm(title: string, message: string): Promise<DialogResult> {
    return this.launch({
      type: "confirm",
      title,
      message,
    });
  }

  /**
   * Launch an input dialog
   */
  async input(
    title: string,
    message: string,
    placeholder?: string,
    defaultValue?: string,
    validation?: (value: string) => string | null,
  ): Promise<DialogResult> {
    return this.launch({
      type: "input",
      title,
      message,
      placeholder,
      defaultValue,
      validation,
    });
  }

  /**
   * Launch a select dialog
   */
  async select(title: string, options: DialogOption[]): Promise<DialogResult> {
    return this.launch({
      type: "select",
      title,
      options,
    });
  }

  /**
   * Launch a multi-select dialog
   */
  async multiselect(
    title: string,
    options: DialogOption[],
  ): Promise<DialogResult> {
    return this.launch({
      type: "multiselect",
      title,
      options,
    });
  }

  /**
   * Launch a file picker dialog
   */
  async filePicker(title: string, startPath?: string): Promise<DialogResult> {
    return this.launch({
      type: "file-picker",
      title,
      placeholder: startPath,
    });
  }

  /**
   * Launch a color picker dialog
   */
  async colorPicker(
    title: string,
    defaultColor?: string,
  ): Promise<DialogResult> {
    return this.launch({
      type: "color-picker",
      title,
      defaultValue: defaultColor,
    });
  }

  /**
   * Launch a dialog
   */
  private async launch(options: DialogOptions): Promise<DialogResult> {
    return new Promise((resolve) => {
      this.activeDialog = options;
      this.callback = (result: DialogResult) => {
        this.activeDialog = null;
        this.callback = null;
        resolve(result);
      };
    });
  }

  /**
   * Handle user input for the active dialog
   */
  handleInput(input: string): boolean {
    if (!this.activeDialog || !this.callback) return false;

    const dialog = this.activeDialog;

    switch (dialog.type) {
      case "confirm":
        if (input.toLowerCase() === "y" || input.toLowerCase() === "yes") {
          this.callback({ confirmed: true, value: "yes", cancelled: false });
          return true;
        }
        if (input.toLowerCase() === "n" || input.toLowerCase() === "no") {
          this.callback({ confirmed: false, value: "no", cancelled: false });
          return true;
        }
        if (input.toLowerCase() === "cancel" || input === "\x1b") {
          this.callback({ confirmed: false, cancelled: true });
          return true;
        }
        return false;

      case "input":
        if (input === "\x1b") {
          this.callback({ confirmed: false, cancelled: true });
          return true;
        }
        const validationError = dialog.validation?.(input);
        if (validationError) {
          // Return false to show validation error in UI
          return false;
        }
        this.callback({ confirmed: true, value: input, cancelled: false });
        return true;

      case "select":
        if (input === "\x1b") {
          this.callback({ confirmed: false, cancelled: true });
          return true;
        }
        const selectedIndex = parseInt(input, 10);
        if (
          !isNaN(selectedIndex) &&
          dialog.options &&
          selectedIndex >= 0 &&
          selectedIndex < dialog.options.length
        ) {
          const selected = dialog.options[selectedIndex];
          if (!selected.disabled) {
            this.callback({
              confirmed: true,
              value: selected.value,
              cancelled: false,
            });
            return true;
          }
        }
        return false;

      case "multiselect":
        if (input === "\x1b") {
          this.callback({ confirmed: false, cancelled: true });
          return true;
        }
        if (input === "") {
          // Confirm selection
          this.callback({ confirmed: true, value: [], cancelled: false });
          return true;
        }
        const indices = input
          .split(",")
          .map((i) => parseInt(i.trim(), 10))
          .filter((i) => !isNaN(i));
        if (dialog.options) {
          const selectedValues = indices
            .filter((i) => i >= 0 && i < dialog.options!.length)
            .map((i) => dialog.options![i].value);
          this.callback({
            confirmed: true,
            value: selectedValues,
            cancelled: false,
          });
          return true;
        }
        return false;

      case "file-picker":
        if (input === "\x1b") {
          this.callback({ confirmed: false, cancelled: true });
          return true;
        }
        this.callback({ confirmed: true, value: input, cancelled: false });
        return true;

      case "color-picker":
        if (input === "\x1b") {
          this.callback({ confirmed: false, cancelled: true });
          return true;
        }
        // Validate hex color
        if (/^#[0-9A-Fa-f]{6}$/.test(input)) {
          this.callback({ confirmed: true, value: input, cancelled: false });
          return true;
        }
        return false;
    }

    return false;
  }

  /**
   * Check if a dialog is currently active
   */
  isActive(): boolean {
    return this.activeDialog !== null;
  }

  /**
   * Get the current active dialog
   */
  getActiveDialog(): DialogOptions | null {
    return this.activeDialog;
  }

  /**
   * Cancel the current dialog
   */
  cancel(): void {
    if (this.callback) {
      this.callback({ confirmed: false, cancelled: true });
    }
  }
}

export const dialogLauncher = new DialogLauncher();
