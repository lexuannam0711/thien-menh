/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Priority stack cho Input Context:
 * GAMEPLAY = 0 < DIALOGUE = 1 < MENU = 2 < SETTINGS = 3 < MODAL = 4.
 */

export const INPUT_CONTEXT_PRIORITY = Object.freeze({
  GAMEPLAY: 0,
  DIALOGUE: 1,
  MENU: 2,
  SETTINGS: 3,
  MODAL: 4,
} as const);

export type InputContext = keyof typeof INPUT_CONTEXT_PRIORITY;

export const InputContext = Object.freeze({
  GAMEPLAY: 'GAMEPLAY',
  DIALOGUE: 'DIALOGUE',
  MENU: 'MENU',
  SETTINGS: 'SETTINGS',
  MODAL: 'MODAL',
} as const);

export type ContextChangeListener = (current: InputContext, previous: InputContext) => void;

export class InputContextManager {
  private stack: InputContext[];
  private listeners: Set<ContextChangeListener> = new Set();

  constructor(initial: InputContext = 'GAMEPLAY') {
    this.stack = [initial];
  }

  get current(): InputContext {
    return this.peek();
  }

  peek(): InputContext {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : 'GAMEPLAY';
  }

  get priority(): number {
    return INPUT_CONTEXT_PRIORITY[this.peek()];
  }

  push(context: InputContext): void {
    const prev = this.peek();
    this.stack.push(context);
    this.notify(this.peek(), prev);
  }

  pop(context?: InputContext): InputContext | null {
    if (this.stack.length <= 1) {
      // Giữ lại context GAMEPLAY gốc, không bao giờ pop rỗng stack
      return null;
    }
    const prev = this.peek();
    if (context !== undefined) {
      const idx = this.stack.lastIndexOf(context);
      if (idx > 0) {
        const removed = this.stack.splice(idx, 1)[0];
        this.notify(this.peek(), prev);
        return removed;
      }
      return null;
    }
    const popped = this.stack.pop() ?? null;
    this.notify(this.peek(), prev);
    return popped;
  }

  reset(base: InputContext = 'GAMEPLAY'): void {
    const prev = this.peek();
    this.stack = [base];
    this.notify(this.peek(), prev);
  }

  isGameplayAllowed(): boolean {
    return this.peek() === 'GAMEPLAY';
  }

  /**
   * Xử lý phím Escape:
   * Nếu có context tầng trên (MODAL/SETTINGS/MENU/DIALOGUE), đóng context trên cùng trước (handled = true).
   * Nếu đang ở GAMEPLAY gốc, trả về handled = false để game có thể kích hoạt Pause.
   */
  handleEscape(): { handled: boolean; closedContext?: InputContext } {
    if (this.peek() !== 'GAMEPLAY') {
      const closed = this.pop();
      return { handled: true, closedContext: closed ?? undefined };
    }
    return { handled: false };
  }

  onChange(listener: ContextChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(curr: InputContext, prev: InputContext): void {
    if (curr !== prev) {
      for (const listener of this.listeners) {
        try {
          listener(curr, prev);
        } catch {
          // Tránh để listener ngoại vi làm gián đoạn luồng chính
        }
      }
    }
  }

  getStack(): readonly InputContext[] {
    return [...this.stack];
  }
}
