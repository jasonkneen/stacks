# Bug Fix: AI Prompt Not Triggering on Post-it Click

## Issue
When clicking the + button handles on post-it notes to trigger AI generation, the prompt popup wouldn't appear.

## Root Cause
The connection handles had both `onMouseDown` (for dragging connections) and `onClick` (for AI prompt) handlers. The `onMouseDown` handler was interfering with the `onClick` event.

**Problem flow:**
1. User clicks + button
2. `onMouseDown` fires → starts connection drag logic
3. `onClick` either doesn't fire or fires inconsistently
4. AI prompt popup never appears

## Solution
Replace `onClick` with `onMouseUp` and add distance tracking to distinguish between clicks and drags:

```typescript
onMouseDown={(e) => {
  e.preventDefault();
  // Track start position
  (e.currentTarget as any)._mouseDownPos = { x: e.clientX, y: e.clientY };
  onConnectStart(e, item.id);
}}
onMouseUp={(e) => {
  const startPos = (e.currentTarget as any)._mouseDownPos;
  if (startPos) {
    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
    // If moved less than 5px, treat as click (not drag)
    if (dist < 5) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      onAIPromptStart(e, item.id, { x: rect.right, y: rect.top + rect.height / 2 });
    }
  }
  delete (e.currentTarget as any)._mouseDownPos;
}}
```

## Files Modified
- `components/ItemRenderer.tsx` - Updated all 4 connection handles (top, right, bottom, left)

## Behavior Now
- **Quick click** (< 5px movement) → Opens AI prompt popup
- **Click and drag** (≥ 5px movement) → Creates connection line

## Testing
1. Hover over a post-it note
2. Click (don't drag) any + button
3. AI prompt popup should appear
4. Type prompt and press Enter
5. New note with AI response should be created

## Additional Fix
Also updated `App.tsx` line 585 to use new multi-provider AI:
- Changed from: `import('./utils/gemini')`
- Changed to: `import('./utils/aiProvider')`

This ensures the AI generation uses the new Anthropic/OpenAI/Google provider system.
