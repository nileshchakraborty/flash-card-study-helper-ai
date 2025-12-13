export class BaseView {
  protected elements: Record<string, HTMLElement | null> = {};
  
  constructor() {
    // The `elements` property is now typed and initialized directly.
    // This constructor line can be removed or kept if other initialization is needed.
    // For this change, I'll assume the direct initialization is sufficient.
  }
  
  getElement(selector: string): HTMLElement | null {
    return document.querySelector(selector);
  }
  
  getAllElements(selector: string): NodeListOf<Element> {
    return document.querySelectorAll(selector);
  }
  
  show(element: HTMLElement | null): void {
    if (element) {
      element.classList.remove('hidden');
      (element as HTMLElement).style.pointerEvents = 'auto';
      (element as HTMLElement).style.display = '';
    }
  }

  hide(element: HTMLElement | null): void {
    if (element) {
      element.classList.add('hidden');
      (element as HTMLElement).style.pointerEvents = 'none';
      (element as HTMLElement).style.display = 'none';
    }
  }

  setText(selector: string, text: string): void {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }
  
  bind(element: HTMLElement | null, event: string, handler: EventListener): void {
    if (element) {
      element.addEventListener(event, handler);
    }
  }
}
