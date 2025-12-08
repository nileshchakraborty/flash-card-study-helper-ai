/**
 * Skeleton Loading Component
 * Provides reusable skeleton loaders for better UX during async operations
 */

export class SkeletonLoader {
    /**
     * Create a skeleton flashcard
     */
    static createFlashcardSkeleton(): HTMLElement {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-flashcard';
        skeleton.setAttribute('data-skeleton', 'true');

        skeleton.innerHTML = `
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text" style="width: 40%;"></div>
    `;

        return skeleton;
    }

    /**
     * Create a grid of skeleton flashcards
     */
    static createFlashcardGrid(count: number = 6): HTMLElement {
        const grid = document.createElement('div');
        grid.className = 'skeleton-grid';
        grid.setAttribute('role', 'status');
        grid.setAttribute('aria-label', 'Loading flashcards');

        for (let i = 0; i < count; i++) {
            grid.appendChild(this.createFlashcardSkeleton());
        }

        return grid;
    }

    /**
     * Create a skeleton list item
     */
    static createListItemSkeleton(): HTMLElement {
        const item = document.createElement('div');
        item.className = 'skeleton-list-item';

        item.innerHTML = `
      <div class="skeleton skeleton-avatar"></div>
      <div class="skeleton-list-content">
        <div class="skeleton skeleton-title" style="width: 70%;"></div>
        <div class="skeleton skeleton-text" style="width: 50%;"></div>
      </div>
    `;

        return item;
    }

    /**
     * Create a loading overlay
     */
    static createLoadingOverlay(message: string = 'Loading...'): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.setAttribute('role', 'status');

        overlay.innerHTML = `
      <div class="text-center">
        <div class="spinner mx-auto mb-4"></div>
        <p class="text-gray-600 font-medium">${message}</p>
      </div>
    `;

        return overlay;
    }

    /**
     * Show loading state on a container
     */
    static showLoading(container: HTMLElement, skeletonType: 'grid' | 'list' | 'overlay' = 'grid', count?: number) {
        // Clear existing content
        container.innerHTML = '';

        // Add appropriate skeleton
        switch (skeletonType) {
            case 'grid':
                container.appendChild(this.createFlashcardGrid(count));
                break;
            case 'list':
                for (let i = 0; i < (count || 3); i++) {
                    container.appendChild(this.createListItemSkeleton());
                }
                break;
            case 'overlay':
                document.body.appendChild(this.createLoadingOverlay());
                break;
        }
    }

    /**
     * Hide loading overlay
     */
    static hideLoadingOverlay() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Replace skeleton with actual content (with fade-in)
     */
    static replaceWithContent(container: HTMLElement, content: HTMLElement | HTMLElement[]) {
        // Remove skeletons
        const skeletons = container.querySelectorAll('[data-skeleton]');
        skeletons.forEach(s => s.remove());

        // Add content with fade-in
        if (Array.isArray(content)) {
            content.forEach((el, index) => {
                el.classList.add('fade-in');
                el.style.animationDelay = `${index * 0.05}s`;
                container.appendChild(el);
            });
        } else {
            content.classList.add('fade-in');
            container.appendChild(content);
        }
    }

    /**
     * Add loading state to a button
     */
    static setButtonLoading(button: HTMLButtonElement, loading: boolean) {
        if (loading) {
            button.classList.add('btn-loading');
            button.disabled = true;
            button.setAttribute('data-original-text', button.textContent || '');
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
            const originalText = button.getAttribute('data-original-text');
            if (originalText) {
                button.textContent = originalText;
            }
        }
    }
}

// Export for ESM
export default SkeletonLoader;
